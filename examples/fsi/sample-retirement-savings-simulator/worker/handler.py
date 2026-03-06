"""
LMI Worker AWS Lambda Handler

Processes retirement simulation shards with CloudWatch EMF metrics.
Designed for sustained 10-14 minute execution on LMI.
"""

import json
import boto3
import os
import time
import requests
from datetime import datetime
from typing import Dict, Any, Optional
from simulator import simulate_retirement_savings

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Environment variables
JOBS_TABLE_NAME = os.environ.get('JOBS_TABLE_NAME')
INPUT_BUCKET = os.environ.get('INPUT_BUCKET')
OUTPUT_BUCKET = os.environ.get('OUTPUT_BUCKET')

# Cache for EC2 metadata (fetched once per execution environment)
_ec2_metadata_cache = None


def get_ec2_metadata() -> Dict[str, str]:
    """
    Fetch EC2 instance metadata for LMI placement tracking.
    Cached per execution environment to avoid repeated API calls.
    
    Returns:
        Dictionary with instanceId, instanceType, availabilityZone, executionEnvironment
    """
    global _ec2_metadata_cache
    
    if _ec2_metadata_cache is not None:
        return _ec2_metadata_cache
    
    metadata = {
        'instanceId': 'unknown',
        'instanceType': 'unknown',
        'availabilityZone': 'unknown',
        'executionEnvironment': os.environ.get('AWS_EXECUTION_ENV', 'unknown')
    }
    
    try:
        # EC2 Instance Metadata Service v2 (IMDSv2)
        # First get token
        token_url = 'http://169.254.169.254/latest/api/token'
        token_response = requests.put(
            token_url,
            headers={'X-aws-ec2-metadata-token-ttl-seconds': '21600'},
            timeout=1
        )
        token = token_response.text
        
        # Fetch metadata with token
        headers = {'X-aws-ec2-metadata-token': token}
        
        instance_id_response = requests.get(
            'http://169.254.169.254/latest/meta-data/instance-id',
            headers=headers,
            timeout=1
        )
        metadata['instanceId'] = instance_id_response.text
        
        instance_type_response = requests.get(
            'http://169.254.169.254/latest/meta-data/instance-type',
            headers=headers,
            timeout=1
        )
        metadata['instanceType'] = instance_type_response.text
        
        az_response = requests.get(
            'http://169.254.169.254/latest/meta-data/placement/availability-zone',
            headers=headers,
            timeout=1
        )
        metadata['availabilityZone'] = az_response.text
        
    except Exception as e:
        # If metadata fetch fails, log but continue (might be running in non-LMI environment)
        print(f"Warning: Could not fetch EC2 metadata: {str(e)}")
    
    # Cache for subsequent invocations in same execution environment
    _ec2_metadata_cache = metadata
    return metadata


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Process a shard of retirement simulation scenarios.
    
    Args:
        event: SQS event with Records containing shard messages
        context: Lambda context object
    
    Returns:
        Success/failure status
    """
    start_time = time.time()
    
    # Get EC2 metadata for placement tracking
    ec2_metadata = get_ec2_metadata()
    
    # Process each SQS message (typically one per invocation)
    for record in event['Records']:
        try:
            # Parse message body
            message = json.loads(record['body'])
            job_id = message['jobId']
            shard_id = message['shardId']
            config_s3_key = message['configS3Key']
            scenarios = message['scenarios']
            seed = message['seed']
            
            print(f"Processing shard {shard_id} for job {job_id}")
            
            # Read configuration from S3
            io_start = time.time()
            config_obj = s3_client.get_object(Bucket=INPUT_BUCKET, Key=config_s3_key)
            config = json.loads(config_obj['Body'].read().decode('utf-8'))
            io_time_ms = (time.time() - io_start) * 1000
            
            # Run Monte Carlo simulation
            compute_start = time.time()
            results, final_savings = simulate_retirement_savings(
                initial_savings=config['initialSavings'],
                monthly_contribution=config['monthlyContribution'],
                years_to_retirement=config['yearsToRetirement'],
                annual_return=config['annualReturn'],
                volatility=config['volatility'],
                scenarios=scenarios,
                seed=seed
            )
            compute_time_ms = (time.time() - compute_start) * 1000
            
            # Calculate execution metrics
            execution_time_ms = (time.time() - start_time) * 1000
            scenarios_per_second = scenarios / (compute_time_ms / 1000)
            ms_per_scenario = compute_time_ms / scenarios
            
            # Prepare shard result (includes raw values for accurate aggregation)
            shard_result = {
                'jobId': job_id,
                'shardId': shard_id,
                'scenarios': scenarios,
                'results': results,
                'finalSavings': final_savings,
                'executionMs': int(execution_time_ms),
                'computeMs': int(compute_time_ms),
                'ioMs': int(io_time_ms),
                'scenariosPerSecond': int(scenarios_per_second),
                'msPerScenario': round(ms_per_scenario, 2)
            }
            
            # Write shard result to S3
            output_key = f"jobs/{job_id}/shards/{shard_id}.json"
            s3_client.put_object(
                Bucket=OUTPUT_BUCKET,
                Key=output_key,
                Body=json.dumps(shard_result, indent=2),
                ContentType='application/json'
            )
            
            print(f"Wrote shard result to s3://{OUTPUT_BUCKET}/{output_key}")
            
            # Update DynamoDB job progress (atomic increment)
            table = dynamodb.Table(JOBS_TABLE_NAME)
            response = table.update_item(
                Key={'jobId': job_id},
                UpdateExpression='ADD completedShards :inc SET executionEnvironment = :env, instanceId = :inst, instanceType = :type, availabilityZone = :az, lastUpdated = :updated',
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':env': ec2_metadata['executionEnvironment'],
                    ':inst': ec2_metadata['instanceId'],
                    ':type': ec2_metadata['instanceType'],
                    ':az': ec2_metadata['availabilityZone'],
                    ':updated': datetime.utcnow().isoformat() + 'Z'
                },
                ReturnValues='ALL_NEW'
            )
            
            # Check if all shards are completed and update status
            updated_item = response['Attributes']
            completed = int(updated_item['completedShards'])
            total = int(updated_item['totalShards'])
            
            if completed >= total:
                table.update_item(
                    Key={'jobId': job_id},
                    UpdateExpression='SET #status = :status, completedAt = :completed',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'COMPLETED',
                        ':completed': datetime.utcnow().isoformat() + 'Z'
                    }
                )
                print(f"Job {job_id} completed: {completed}/{total} shards")
            
            
            # Emit CloudWatch EMF metrics
            emit_metrics(
                job_id=job_id,
                shard_id=shard_id,
                memory_size=context.memory_limit_in_mb,
                scenarios=scenarios,
                execution_ms=execution_time_ms,
                compute_ms=compute_time_ms,
                io_ms=io_time_ms,
                scenarios_per_second=scenarios_per_second,
                ms_per_scenario=ms_per_scenario,
                ec2_metadata=ec2_metadata
            )
            
            # Log structured summary
            log_summary(
                job_id=job_id,
                shard_id=shard_id,
                scenarios=scenarios,
                years_simulated=config['yearsToRetirement'],
                compute_time_ms=compute_time_ms,
                io_time_ms=io_time_ms,
                total_execution_ms=execution_time_ms,
                scenarios_per_second=scenarios_per_second,
                ms_per_scenario=ms_per_scenario,
                memory_used_mb=context.memory_limit_in_mb,  # Approximate
                results=results,
                ec2_metadata=ec2_metadata
            )
            
            print(f"Shard {shard_id} completed successfully")
            
        except Exception as e:
            print(f"Error processing shard: {str(e)}")
            # Let SQS retry mechanism handle failures
            raise
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Shard processed successfully'})
    }


def emit_metrics(
    job_id: str,
    shard_id: int,
    memory_size: int,
    scenarios: int,
    execution_ms: float,
    compute_ms: float,
    io_ms: float,
    scenarios_per_second: float,
    ms_per_scenario: float,
    ec2_metadata: Dict[str, str]
) -> None:
    """
    Emit CloudWatch Embedded Metric Format (EMF) metrics.
    
    This avoids PutMetricData API calls and uses structured logging instead.
    """
    emf_log = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [{
                "Namespace": "RetirementSimulator/LMI",
                "Dimensions": [["JobId", "ShardId", "MemorySize", "InstanceId", "InstanceType"]],
                "Metrics": [
                    {"Name": "ScenariosProcessed", "Unit": "Count"},
                    {"Name": "ExecutionDuration", "Unit": "Milliseconds"},
                    {"Name": "ComputeTime", "Unit": "Milliseconds"},
                    {"Name": "IOTime", "Unit": "Milliseconds"},
                    {"Name": "ScenariosPerSecond", "Unit": "Count/Second"},
                    {"Name": "MillisecondsPerScenario", "Unit": "Milliseconds"}
                ]
            }]
        },
        "JobId": job_id,
        "ShardId": str(shard_id),
        "MemorySize": str(memory_size),
        "InstanceId": ec2_metadata['instanceId'],
        "InstanceType": ec2_metadata['instanceType'],
        "AvailabilityZone": ec2_metadata['availabilityZone'],
        "ExecutionEnvironment": ec2_metadata['executionEnvironment'],
        "ScenariosProcessed": scenarios,
        "ExecutionDuration": execution_ms,
        "ComputeTime": compute_ms,
        "IOTime": io_ms,
        "ScenariosPerSecond": scenarios_per_second,
        "MillisecondsPerScenario": ms_per_scenario
    }
    
    # Print EMF log (CloudWatch will parse it automatically)
    print(json.dumps(emf_log))


def log_summary(
    job_id: str,
    shard_id: int,
    scenarios: int,
    years_simulated: int,
    compute_time_ms: float,
    io_time_ms: float,
    total_execution_ms: float,
    scenarios_per_second: float,
    ms_per_scenario: float,
    memory_used_mb: int,
    results: Dict,
    ec2_metadata: Dict[str, str]
) -> None:
    """
    Log structured summary for CloudWatch Insights queries.
    """
    summary = {
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "level": "INFO",
        "message": "Shard processing complete",
        "jobId": job_id,
        "shardId": shard_id,
        "scenarios": scenarios,
        "yearsSimulated": years_simulated,
        "computeTimeMs": int(compute_time_ms),
        "ioTimeMs": int(io_time_ms),
        "totalExecutionMs": int(total_execution_ms),
        "scenariosPerSecond": int(scenarios_per_second),
        "msPerScenario": round(ms_per_scenario, 2),
        "memoryUsedMB": memory_used_mb,
        "instanceId": ec2_metadata['instanceId'],
        "instanceType": ec2_metadata['instanceType'],
        "availabilityZone": ec2_metadata['availabilityZone'],
        "executionEnvironment": ec2_metadata['executionEnvironment'],
        "results": {
            "p5": int(results['p5']),
            "p50": int(results['p50']),
            "p95": int(results['p95']),
            "mean": int(results['mean'])
        }
    }
    
    print(json.dumps(summary))
