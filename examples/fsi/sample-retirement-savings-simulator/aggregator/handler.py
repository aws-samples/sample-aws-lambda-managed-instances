"""
Results Aggregator AWS Lambda Handler

Fetches and aggregates shard results from S3 for a completed job.
"""

import json
import boto3
import os
import numpy as np
from typing import Dict, Any, List

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Environment variables
JOBS_TABLE_NAME = os.environ.get('JOBS_TABLE_NAME')
OUTPUT_BUCKET = os.environ.get('OUTPUT_BUCKET')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Aggregate simulation results for a completed job.
    
    Args:
        event: API Gateway event with jobId in path parameters
        context: Lambda context object
    
    Returns:
        Aggregated results with distribution and performance metrics
    """
    try:
        # Extract jobId from path parameters
        job_id = event.get('pathParameters', {}).get('jobId')
        if not job_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Missing jobId in path'})
            }
        
        # Get job status from DynamoDB
        table = dynamodb.Table(JOBS_TABLE_NAME)
        response = table.get_item(Key={'jobId': job_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Job {job_id} not found'})
            }
        
        job = response['Item']
        
        # Check if job is completed
        if job['status'] != 'COMPLETED':
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': f'Job is not completed yet',
                    'status': job['status'],
                    'progress': f"{job['completedShards']}/{job['totalShards']} shards"
                })
            }
        
        # List all shard results from S3
        prefix = f"jobs/{job_id}/shards/"
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=OUTPUT_BUCKET, Prefix=prefix)
        
        shard_keys = []
        for page in pages:
            if 'Contents' in page:
                shard_keys.extend([obj['Key'] for obj in page['Contents']])
        
        if not shard_keys:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'No shard results found'})
            }
        
        print(f"Found {len(shard_keys)} shard results for job {job_id}")
        
        # Fetch and aggregate shard results
        # Combine raw final savings from all shards for correct percentile calculation
        all_final_savings = []
        total_scenarios = 0
        total_execution_ms = 0
        total_compute_ms = 0

        for key in shard_keys:
            obj = s3_client.get_object(Bucket=OUTPUT_BUCKET, Key=key)
            shard = json.loads(obj['Body'].read().decode('utf-8'))

            all_final_savings.extend(shard['finalSavings'])
            total_scenarios += shard['scenarios']
            total_execution_ms += shard['executionMs']
            total_compute_ms += shard['computeMs']

        # Compute correct percentiles from the combined distribution
        combined = np.array(all_final_savings)
        agg_p5 = float(np.percentile(combined, 5))
        agg_p50 = float(np.percentile(combined, 50))
        agg_p95 = float(np.percentile(combined, 95))
        agg_mean = float(np.mean(combined))
        
        # Calculate performance metrics
        num_workers = len(shard_keys)
        avg_execution_ms = total_execution_ms / num_workers
        avg_compute_ms = total_compute_ms / num_workers
        scenarios_per_second = total_scenarios / (total_compute_ms / 1000)
        
        # Calculate probability of reaching goals from the full distribution
        def calculate_probability(threshold: float) -> int:
            return int(np.mean(combined >= threshold) * 100)
        
        # Estimate cost (rough approximation)
        gb_seconds = (avg_execution_ms / 1000) * (4096 / 1024) * num_workers
        estimated_cost = gb_seconds * 0.0000166667
        scenarios_per_dollar = int(total_scenarios / estimated_cost) if estimated_cost > 0 else 0
        
        # Build response
        result = {
            'jobId': job_id,
            'status': 'COMPLETED',
            'configName': job.get('configName', 'unknown'),
            'createdAt': job.get('createdAt'),
            'completedAt': job.get('completedAt'),
            'summary': {
                'totalScenarios': total_scenarios,
                'numWorkers': num_workers
            },
            'distribution': {
                'p5': int(agg_p5),
                'p50': int(agg_p50),
                'p95': int(agg_p95),
                'mean': int(agg_mean)
            },
            'probability': {
                'reach500K': calculate_probability(500000),
                'reach1M': calculate_probability(1000000),
                'reach2M': calculate_probability(2000000)
            },
            'performance': {
                'avgWorkerDurationMinutes': round(avg_execution_ms / 1000 / 60, 1),
                'avgComputeTimeMinutes': round(avg_compute_ms / 1000 / 60, 1),
                'scenariosPerSecond': int(scenarios_per_second),
                'totalComputeTimeMinutes': round(total_compute_ms / 1000 / 60, 1)
            },
            'cost': {
                'estimatedCost': round(estimated_cost, 2),
                'scenariosPerDollar': scenarios_per_dollar,
                'costPerMillionScenarios': round((estimated_cost / total_scenarios * 1000000), 2)
            }
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(result, indent=2)
        }
        
    except Exception as e:
        print(f"Error aggregating results: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error. Check logs for details.'})
        }
