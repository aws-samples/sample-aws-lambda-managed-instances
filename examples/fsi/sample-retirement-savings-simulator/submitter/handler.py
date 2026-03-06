"""
Job Submitter AWS Lambda Handler

Creates retirement simulation jobs and enqueues work shards to SQS.
"""

import json
import uuid
import boto3
import os
from datetime import datetime, timezone
from typing import Dict, Any

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
sqs_client = boto3.client('sqs')

# Environment variables
JOBS_TABLE_NAME = os.environ.get('JOBS_TABLE_NAME')
WORK_QUEUE_URL = os.environ.get('WORK_QUEUE_URL')
INPUT_BUCKET = os.environ.get('INPUT_BUCKET')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Create a retirement simulation job and enqueue work shards.
    
    Args:
        event: {
            "configS3Key": "data/conservative-saver.json"
        }
        context: Lambda context object
    
    Returns:
        {
            "jobId": "uuid",
            "totalShards": 10,
            "scenariosPerShard": 100000,
            "status": "SUBMITTED"
        }
    """
    try:
        # Extract config S3 key from event
        # Handle both direct Lambda invocation and API Gateway
        if 'body' in event:
            # API Gateway event
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
            config_s3_key = body.get('configS3Key')
        else:
            # Direct Lambda invocation
            config_s3_key = event.get('configS3Key')
        
        if not config_s3_key:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Missing configS3Key in request'})
            }
        
        # Read configuration from S3
        print(f"Reading config from s3://{INPUT_BUCKET}/{config_s3_key}")
        config_obj = s3_client.get_object(Bucket=INPUT_BUCKET, Key=config_s3_key)
        config = json.loads(config_obj['Body'].read().decode('utf-8'))
        
        # Validate configuration
        validation_error = validate_config(config)
        if validation_error:
            print(f"Validation error: {validation_error}")
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': validation_error})
            }
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Calculate shard distribution (remainder added to last shard)
        total_scenarios = config['totalScenarios']
        num_shards = config['shards']
        scenarios_per_shard = total_scenarios // num_shards
        remainder_scenarios = total_scenarios % num_shards
        
        # Create DynamoDB job record
        table = dynamodb.Table(JOBS_TABLE_NAME)
        table.put_item(
            Item={
                'jobId': job_id,
                'status': 'SUBMITTED',
                'totalShards': num_shards,
                'completedShards': 0,
                'failedShards': 0,
                'createdAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'configS3Key': config_s3_key,
                'configName': config.get('name', 'unknown'),
                'totalScenarios': total_scenarios,
                'scenariosPerShard': scenarios_per_shard
            }
        )
        
        print(f"Created job record: {job_id}")
        
        # Enqueue shard messages to SQS (batch of 10)
        messages = []
        for shard_id in range(num_shards):
            # Calculate seed for deterministic results
            seed = 12345 + shard_id
            # Add remainder scenarios to the last shard
            shard_scenarios = scenarios_per_shard + (remainder_scenarios if shard_id == num_shards - 1 else 0)

            message = {
                'Id': str(shard_id),
                'MessageBody': json.dumps({
                    'jobId': job_id,
                    'shardId': shard_id,
                    'configS3Key': config_s3_key,
                    'scenarios': shard_scenarios,
                    'seed': seed
                })
            }
            messages.append(message)
            
            # Send batch when we have 10 messages or it's the last shard
            if len(messages) == 10 or shard_id == num_shards - 1:
                response = sqs_client.send_message_batch(
                    QueueUrl=WORK_QUEUE_URL,
                    Entries=messages
                )
                if response.get('Failed'):
                    failed_ids = [f['Id'] for f in response['Failed']]
                    raise RuntimeError(f"Failed to enqueue shard(s): {failed_ids}")
                print(f"Enqueued batch of {len(messages)} messages")
                messages = []
        
        # Update job status to RUNNING
        table.update_item(
            Key={'jobId': job_id},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'RUNNING'}
        )
        
        print(f"Job {job_id} submitted with {num_shards} shards")
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'jobId': job_id,
                'totalShards': num_shards,
                'scenariosPerShard': scenarios_per_shard,
                'status': 'RUNNING',
                'estimatedDurationMinutes': 12
            })
        }
        
    except Exception as e:
        print(f"Error submitting job: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error. Check logs for details.'})
        }


def validate_config(config: Dict) -> str:
    """
    Validate configuration parameters.
    
    Returns:
        Error message if invalid, empty string if valid
    """
    required_fields = [
        'initialSavings', 'monthlyContribution', 'yearsToRetirement',
        'annualReturn', 'volatility', 'totalScenarios', 'shards'
    ]
    
    # Check required fields
    for field in required_fields:
        if field not in config:
            return f"Missing required field: {field}"
    
    # Validate ranges
    if config['initialSavings'] < 0:
        return "initialSavings must be >= 0"
    
    if config['monthlyContribution'] < 0:
        return "monthlyContribution must be >= 0"
    
    if not (1 <= config['yearsToRetirement'] <= 50):
        return "yearsToRetirement must be between 1 and 50"
    
    if not (-0.5 <= config['annualReturn'] <= 0.5):
        return "annualReturn must be between -0.5 and 0.5"
    
    if not (0 <= config['volatility'] <= 1):
        return "volatility must be between 0 and 1"
    
    if not (10000 <= config['totalScenarios'] <= 10000000):
        return "totalScenarios must be between 10,000 and 10,000,000"
    
    if not (1 <= config['shards'] <= 10000):
        return "shards must be between 1 and 10,000"
    
    return ""
