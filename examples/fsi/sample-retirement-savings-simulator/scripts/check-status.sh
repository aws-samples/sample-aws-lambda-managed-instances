#!/bin/bash
#
# Check status of a retirement simulation job
#
# Usage: ./check-status.sh <job-id>
# Example: ./check-status.sh 550e8400-e29b-41d4-a716-446655440000

set -e

# Get stack name from environment or use default
STACK_NAME=${STACK_NAME:-retirement-sim}

# Get job ID from argument
if [ -z "$1" ]; then
    read -p "Enter Job ID: " JOB_ID
else
    JOB_ID="$1"
fi

# Get DynamoDB table name from CloudFormation outputs
TABLE_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='JobsTableName'].OutputValue" \
    --output text)

if [ -z "$TABLE_NAME" ]; then
    echo "Error: Could not find JobsTable from stack $STACK_NAME"
    exit 1
fi

echo "Checking status for Job ID: $JOB_ID"
echo ""

# Query DynamoDB
ITEM=$(aws dynamodb get-item \
    --table-name "$TABLE_NAME" \
    --key "{\"jobId\": {\"S\": \"$JOB_ID\"}}" \
    --output json)

if [ -z "$ITEM" ] || [ "$ITEM" == "{}" ]; then
    echo "❌ Job not found: $JOB_ID"
    exit 1
fi

# Parse job details
STATUS=$(echo "$ITEM" | python3 -c "import sys, json; item=json.load(sys.stdin).get('Item', {}); print(item.get('status', {}).get('S', 'UNKNOWN'))")
TOTAL_SHARDS=$(echo "$ITEM" | python3 -c "import sys, json; item=json.load(sys.stdin).get('Item', {}); print(item.get('totalShards', {}).get('N', '0'))")
COMPLETED_SHARDS=$(echo "$ITEM" | python3 -c "import sys, json; item=json.load(sys.stdin).get('Item', {}); print(item.get('completedShards', {}).get('N', '0'))")
FAILED_SHARDS=$(echo "$ITEM" | python3 -c "import sys, json; item=json.load(sys.stdin).get('Item', {}); print(item.get('failedShards', {}).get('N', '0'))")
CONFIG_NAME=$(echo "$ITEM" | python3 -c "import sys, json; item=json.load(sys.stdin).get('Item', {}); print(item.get('configName', {}).get('S', 'unknown'))")
CREATED_AT=$(echo "$ITEM" | python3 -c "import sys, json; item=json.load(sys.stdin).get('Item', {}); print(item.get('createdAt', {}).get('S', 'unknown'))")

# Display status
echo "Job Status Report"
echo "================="
echo "Job ID:           $JOB_ID"
echo "Config:           $CONFIG_NAME"
echo "Status:           $STATUS"
echo "Created:          $CREATED_AT"
echo ""
echo "Progress:         $COMPLETED_SHARDS / $TOTAL_SHARDS shards completed"
echo "Failed:           $FAILED_SHARDS shards"

# Calculate percentage
if [ "$TOTAL_SHARDS" -gt 0 ]; then
    PERCENT=$((COMPLETED_SHARDS * 100 / TOTAL_SHARDS))
    echo "Completion:       $PERCENT%"
fi

echo ""

# Status-specific messages
if [ "$STATUS" == "COMPLETED" ]; then
    echo "✅ Job completed successfully!"
    echo ""
    echo "Next step: ./fetch-results.sh $JOB_ID"
elif [ "$STATUS" == "FAILED" ]; then
    echo "❌ Job failed"
elif [ "$STATUS" == "RUNNING" ]; then
    echo "⏳ Job is still running..."
    echo ""
    if [ "$TOTAL_SHARDS" -gt 0 ] && [ "$COMPLETED_SHARDS" -gt 0 ]; then
        REMAINING=$((TOTAL_SHARDS - COMPLETED_SHARDS))
        EST_MINUTES=$((REMAINING * 12))
        echo "Estimated time remaining: ~$EST_MINUTES minutes"
    fi
fi
