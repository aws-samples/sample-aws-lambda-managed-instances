"""Tests for worker handler SQS batch utility integration."""
import json
import os
import sys
import pytest

# Add worker directory to path so handler can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Set required env vars before importing handler
os.environ.setdefault('JOBS_TABLE_NAME', 'test-jobs')
os.environ.setdefault('INPUT_BUCKET', 'test-input')
os.environ.setdefault('OUTPUT_BUCKET', 'test-output')
os.environ.setdefault('POWERTOOLS_SERVICE_NAME', 'test')
os.environ.setdefault('POWERTOOLS_METRICS_NAMESPACE', 'Test')

import handler


def make_sqs_event(message_body: dict, message_id: str = "msg-001") -> dict:
    return {
        "Records": [
            {
                "messageId": message_id,
                "receiptHandle": "handle-001",
                "body": json.dumps(message_body),
                "attributes": {},
                "messageAttributes": {},
                "md5OfBody": "abc",
                "eventSource": "aws:sqs",
                "eventSourceARN": "arn:aws:sqs:us-east-1:123:test-queue",
                "awsRegion": "us-east-1",
            }
        ]
    }


def make_context():
    class Context:
        memory_limit_in_mb = 4096
        function_name = "test-worker"
        invoked_function_arn = "arn:aws:lambda:us-east-1:123:function:test-worker"
        aws_request_id = "req-001"
    return Context()


def make_message():
    return {
        "jobId": "job-123",
        "shardId": "shard-0",
        "configS3Key": "configs/test.json",
        "scenarios": 100,
        "seed": 42,
    }


def make_config():
    return {
        "initialSavings": 10000,
        "monthlyContribution": 500,
        "yearsToRetirement": 10,
        "annualReturn": 0.07,
        "volatility": 0.15,
    }


def test_lambda_handler_returns_batch_response_format(mocker):
    """lambda_handler should return batchItemFailures key (Powertools batch format)."""
    mocker.patch('handler.get_ec2_metadata', return_value={
        'instanceId': 'i-test', 'instanceType': 'c5.xlarge',
        'availabilityZone': 'us-east-1a', 'executionEnvironment': 'test'
    })
    mocker.patch('handler.s3_client.get_object', return_value={
        'Body': mocker.MagicMock(read=lambda: json.dumps(make_config()).encode())
    })
    mocker.patch('handler.s3_client.put_object')
    mocker.patch('handler.simulate_retirement_savings', return_value=(
        {'p5': 1000, 'p50': 5000, 'p95': 9000, 'mean': 5000, 'successRate': 0.9},
        [5000.0] * 100
    ))
    mock_table = mocker.MagicMock()
    mock_table.update_item.return_value = {
        'Attributes': {'completedShards': 1, 'totalShards': 2}
    }
    mocker.patch('handler.dynamodb.Table', return_value=mock_table)

    event = make_sqs_event(make_message())
    result = handler.lambda_handler(event, make_context())

    assert 'batchItemFailures' in result


def test_lambda_handler_reports_failure_on_exception(mocker):
    """When record_handler raises, the message ID appears in batchItemFailures."""
    mocker.patch('handler.get_ec2_metadata', return_value={
        'instanceId': 'i-test', 'instanceType': 'c5.xlarge',
        'availabilityZone': 'us-east-1a', 'executionEnvironment': 'test'
    })
    mocker.patch('handler.s3_client.get_object', side_effect=Exception("S3 error"))

    event = make_sqs_event(make_message(), message_id="fail-msg-001")
    result = handler.lambda_handler(event, make_context())

    assert result['batchItemFailures'] == [{'itemIdentifier': 'fail-msg-001'}]
