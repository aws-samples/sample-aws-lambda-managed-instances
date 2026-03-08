"""
LMI Worker AWS Lambda Handler

Processes retirement simulation shards with AWS Lambda Powertools metrics.
Designed for sustained 10-14 minute execution on LMI.
"""

import json
import boto3
import os
import time
import requests
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from simulator import simulate_retirement_savings
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.metrics import MetricUnit
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Environment variables
JOBS_TABLE_NAME = os.environ.get('JOBS_TABLE_NAME')
INPUT_BUCKET = os.environ.get('INPUT_BUCKET')
OUTPUT_BUCKET = os.environ.get('OUTPUT_BUCKET')

logger = Logger()
tracer = Tracer()
metrics = Metrics()
processor = BatchProcessor(event_type=EventType.SQS, raise_on_entire_batch_failure=False)

# Cache for EC2 metadata (fetched once per execution environment)
_ec2_metadata_cache = None


@tracer.capture_method
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
        logger.warning("Could not fetch EC2 metadata", error=str(e))
    
    # Cache for subsequent invocations in same execution environment
    _ec2_metadata_cache = metadata
    return metadata


@tracer.capture_method
def record_handler(record: SQSRecord) -> None:
    """Process a single SQS record containing one simulation shard."""
    start_time = time.time()

    message = json.loads(record.body)
    job_id = message['jobId']
    shard_id = message['shardId']
    config_s3_key = message['configS3Key']
    scenarios = message['scenarios']
    seed = message['seed']

    logger.info("Processing shard", job_id=job_id, shard_id=shard_id)

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

    execution_time_ms = (time.time() - start_time) * 1000
    scenarios_per_second = scenarios / (compute_time_ms / 1000)
    ms_per_scenario = compute_time_ms / scenarios

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

    output_key = f"jobs/{job_id}/shards/{shard_id}.json"
    s3_client.put_object(
        Bucket=OUTPUT_BUCKET,
        Key=output_key,
        Body=json.dumps(shard_result, indent=2),
        ContentType='application/json'
    )

    logger.info("Wrote shard result to S3", bucket=OUTPUT_BUCKET, key=output_key)

    table = dynamodb.Table(JOBS_TABLE_NAME)
    ec2_metadata = get_ec2_metadata()
    response = table.update_item(
        Key={'jobId': job_id},
        UpdateExpression='ADD completedShards :inc SET executionEnvironment = :env, instanceId = :inst, instanceType = :type, availabilityZone = :az, lastUpdated = :updated',
        ExpressionAttributeValues={
            ':inc': 1,
            ':env': ec2_metadata['executionEnvironment'],
            ':inst': ec2_metadata['instanceId'],
            ':type': ec2_metadata['instanceType'],
            ':az': ec2_metadata['availabilityZone'],
            ':updated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        },
        ReturnValues='ALL_NEW'
    )

    updated_item = response['Attributes']
    completed = int(updated_item['completedShards'])
    total = int(updated_item['totalShards'])

    if completed >= total:
        try:
            table.update_item(
                Key={'jobId': job_id},
                UpdateExpression='SET #status = :status, completedAt = :completed',
                ExpressionAttributeNames={'#status': 'status'},
                ConditionExpression='#status <> :status',
                ExpressionAttributeValues={
                    ':status': 'COMPLETED',
                    ':completed': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                }
            )
            logger.info("Job completed", job_id=job_id, completed=completed, total=total)
        except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
            logger.info("Job already marked completed by another worker", job_id=job_id)

    metrics.add_metric(name="ScenariosProcessed", unit=MetricUnit.Count, value=scenarios)
    metrics.add_metric(name="ExecutionDuration", unit=MetricUnit.Milliseconds, value=execution_time_ms)
    metrics.add_metric(name="ComputeTime", unit=MetricUnit.Milliseconds, value=compute_time_ms)
    metrics.add_metric(name="IOTime", unit=MetricUnit.Milliseconds, value=io_time_ms)
    metrics.add_metric(name="ScenariosPerSecond", unit=MetricUnit.Count, value=scenarios_per_second)
    metrics.add_metric(name="MillisecondsPerScenario", unit=MetricUnit.Count, value=ms_per_scenario)

    logger.info(
        "Shard processing complete",
        job_id=job_id,
        shard_id=shard_id,
        scenarios=scenarios,
        years_simulated=config['yearsToRetirement'],
        compute_time_ms=int(compute_time_ms),
        io_time_ms=int(io_time_ms),
        total_execution_ms=int(execution_time_ms),
        scenarios_per_second=int(scenarios_per_second),
        ms_per_scenario=round(ms_per_scenario, 2),
        results_p5=int(results['p5']),
        results_p50=int(results['p50']),
        results_p95=int(results['p95']),
        results_mean=int(results['mean'])
    )

    logger.info("Shard completed successfully", job_id=job_id, shard_id=shard_id)


@logger.inject_lambda_context(log_event=False)
@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start_metric=True)
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

    ec2_metadata = get_ec2_metadata()
    metrics.add_dimension(name="InstanceType", value=ec2_metadata['instanceType'])
    metrics.add_dimension(name="MemorySize", value=str(context.memory_limit_in_mb))

    return process_partial_response(event, record_handler, processor, context)

