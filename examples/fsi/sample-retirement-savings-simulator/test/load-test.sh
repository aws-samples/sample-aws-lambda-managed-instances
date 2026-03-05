#!/bin/bash
set -e

# Load Test: 1,000 Clients via Submitter Function
# This simulates a real-world scenario where 1,000 clients submit retirement analysis requests
# Each client gets 1M scenarios split into 100 shards = 100,000 total SQS messages

# Get stack outputs
STACK_NAME="retirement-savings-simulator"
echo "=========================================="
echo "  Retirement Simulator Load Test"
echo "  1,000 Clients → 100,000 Messages"
echo "=========================================="
echo ""
echo "Getting stack outputs..."

SUBMITTER_FUNCTION=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='JobSubmitterFunctionArn'].OutputValue" --output text | awk -F: '{print $NF}')
INPUT_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='InputBucketName'].OutputValue" --output text)
OUTPUT_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='OutputBucketName'].OutputValue" --output text)
QUEUE_URL=$(aws sqs get-queue-url --queue-name retirement-sim-work-queue --query 'QueueUrl' --output text)

echo "Submitter Function: $SUBMITTER_FUNCTION"
echo "Input Bucket: $INPUT_BUCKET"
echo "Output Bucket: $OUTPUT_BUCKET"
echo "Queue URL: $QUEUE_URL"
echo ""

# Configuration
TOTAL_CLIENTS=1000
SHARDS_PER_CLIENT=100
SCENARIOS_PER_CLIENT=100000  # 100K scenarios per client for faster testing
TOTAL_MESSAGES=$((TOTAL_CLIENTS * SHARDS_PER_CLIENT))
PARALLEL_INVOCATIONS=50  # Invoke 50 submitters in parallel

echo "Test Configuration:"
echo "  Clients: $TOTAL_CLIENTS"
echo "  Scenarios per client: $SCENARIOS_PER_CLIENT"
echo "  Shards per client: $SHARDS_PER_CLIENT"
echo "  Total SQS messages: $TOTAL_MESSAGES"
echo "  Parallel submitter invocations: $PARALLEL_INVOCATIONS"
echo ""

# Confirm
read -p "Proceed with load test? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Test cancelled."
  exit 0
fi

echo ""
echo "Preparing test environment..."

# Clean up previous test data
echo "  Cleaning S3 output bucket..."
aws s3 rm s3://$OUTPUT_BUCKET/jobs/ --recursive --quiet 2>/dev/null || true

# Delete CloudWatch log streams
echo "  Cleaning CloudWatch log streams..."
LOG_GROUP="/aws/lambda/retirement-sim-worker"
LOG_STREAMS=$(aws logs describe-log-streams --log-group-name $LOG_GROUP --query 'logStreams[*].logStreamName' --output text 2>/dev/null || echo "")
if [ ! -z "$LOG_STREAMS" ]; then
  for stream in $LOG_STREAMS; do
    aws logs delete-log-stream --log-group-name $LOG_GROUP --log-stream-name "$stream" 2>/dev/null || true
  done
fi

# Purge SQS queue
echo "  Purging SQS queue..."
aws sqs purge-queue --queue-url $QUEUE_URL 2>/dev/null || true

echo "  Environment ready!"
echo ""

# Generate unique batch ID
BATCH_ID="clients-$(date +%s)"
echo "Batch ID: $BATCH_ID"
echo ""

# Create test configurations for different client profiles
echo "Creating client configurations..."

# Profile 1: Conservative Saver (20 years)
CONSERVATIVE_CONFIG=$(cat <<EOF
{
  "name": "Conservative Saver",
  "initialSavings": 50000,
  "monthlyContribution": 500,
  "yearsToRetirement": 20,
  "annualReturn": 0.05,
  "volatility": 0.10,
  "totalScenarios": $SCENARIOS_PER_CLIENT,
  "shards": $SHARDS_PER_CLIENT
}
EOF
)

# Profile 2: Aggressive Investor (30 years)
AGGRESSIVE_CONFIG=$(cat <<EOF
{
  "name": "Aggressive Investor",
  "initialSavings": 100000,
  "monthlyContribution": 1000,
  "yearsToRetirement": 30,
  "annualReturn": 0.08,
  "volatility": 0.18,
  "totalScenarios": $SCENARIOS_PER_CLIENT,
  "shards": $SHARDS_PER_CLIENT
}
EOF
)

# Profile 3: Young Starter (40 years)
YOUNG_CONFIG=$(cat <<EOF
{
  "name": "Young Starter",
  "initialSavings": 10000,
  "monthlyContribution": 300,
  "yearsToRetirement": 40,
  "annualReturn": 0.07,
  "volatility": 0.15,
  "totalScenarios": $SCENARIOS_PER_CLIENT,
  "shards": $SHARDS_PER_CLIENT
}
EOF
)

# Upload configurations to S3
CONSERVATIVE_KEY="test-configs/${BATCH_ID}-conservative.json"
AGGRESSIVE_KEY="test-configs/${BATCH_ID}-aggressive.json"
YOUNG_KEY="test-configs/${BATCH_ID}-young.json"

echo "$CONSERVATIVE_CONFIG" | aws s3 cp - s3://$INPUT_BUCKET/$CONSERVATIVE_KEY
echo "$AGGRESSIVE_CONFIG" | aws s3 cp - s3://$INPUT_BUCKET/$AGGRESSIVE_KEY
echo "$YOUNG_CONFIG" | aws s3 cp - s3://$INPUT_BUCKET/$YOUNG_KEY

echo "  ✓ Conservative Saver config uploaded"
echo "  ✓ Aggressive Investor config uploaded"
echo "  ✓ Young Starter config uploaded"
echo ""

# Invoke submitter function for 1,000 clients
echo "=========================================="
echo "  Invoking Submitter for 1,000 Clients"
echo "=========================================="
echo ""

START_TIME=$(date +%s)
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Function to invoke submitter
invoke_submitter() {
  local CLIENT_NUM=$1
  local CONFIG_KEY=$2
  
  aws lambda invoke \
    --function-name "$SUBMITTER_FUNCTION" \
    --invocation-type Event \
    --payload '{"configS3Key": "'"$CONFIG_KEY"'"}' \
    /dev/null \
    > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "1"  # Success
  else
    echo "0"  # Failure
  fi
}

export -f invoke_submitter
export SUBMITTER_FUNCTION

# Invoke submitters in parallel batches
BATCHES=$((TOTAL_CLIENTS / PARALLEL_INVOCATIONS))

for batch in $(seq 1 $BATCHES); do
  # Launch parallel invocations
  for i in $(seq 1 $PARALLEL_INVOCATIONS); do
    CLIENT_NUM=$(( (batch - 1) * PARALLEL_INVOCATIONS + i ))
    
    # Rotate through different client profiles
    if [ $((CLIENT_NUM % 3)) -eq 1 ]; then
      CONFIG_KEY=$CONSERVATIVE_KEY
    elif [ $((CLIENT_NUM % 3)) -eq 2 ]; then
      CONFIG_KEY=$AGGRESSIVE_KEY
    else
      CONFIG_KEY=$YOUNG_KEY
    fi
    
    # Invoke asynchronously in background
    invoke_submitter $CLIENT_NUM $CONFIG_KEY &
  done
  
  # Wait for this batch to complete
  wait
  
  SUCCESS_COUNT=$((SUCCESS_COUNT + PARALLEL_INVOCATIONS))
  
  # Progress indicator
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  if [ $ELAPSED -gt 0 ]; then
    RATE=$((SUCCESS_COUNT / ELAPSED))
  else
    RATE=0
  fi
  REMAINING=$((TOTAL_CLIENTS - SUCCESS_COUNT))
  if [ $RATE -gt 0 ]; then
    ETA=$((REMAINING / RATE))
    ETA_MIN=$((ETA / 60))
    ETA_SEC=$((ETA % 60))
  else
    ETA_MIN=0
    ETA_SEC=0
  fi
  
  echo "  Invoked $SUCCESS_COUNT / $TOTAL_CLIENTS clients... ($RATE clients/s, ETA: ${ETA_MIN}m ${ETA_SEC}s)"
done

SUBMIT_END_TIME=$(date +%s)
SUBMIT_DURATION=$((SUBMIT_END_TIME - START_TIME))
SUBMIT_MIN=$((SUBMIT_DURATION / 60))
SUBMIT_SEC=$((SUBMIT_DURATION % 60))

echo ""
echo "✅ All $TOTAL_CLIENTS submitter invocations completed in ${SUBMIT_MIN}m ${SUBMIT_SEC}s!"
echo ""
echo "Waiting for submitters to process and enqueue messages..."
sleep 30

# Check queue status
echo ""
echo "=========================================="
echo "  Queue Status"
echo "=========================================="
QUEUE_DEPTH=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages \
  --query 'Attributes.ApproximateNumberOfMessages' \
  --output text)

IN_FLIGHT=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names ApproximateNumberOfMessagesNotVisible \
  --query 'Attributes.ApproximateNumberOfMessagesNotVisible' \
  --output text)

echo "Queue depth: $QUEUE_DEPTH messages"
echo "In-flight: $IN_FLIGHT messages"
echo "Expected: $TOTAL_MESSAGES messages"
echo ""

# Check DynamoDB for created jobs
echo "=========================================="
echo "  DynamoDB Status"
echo "=========================================="
JOB_COUNT=$(aws dynamodb scan \
  --table-name retirement-sim-jobs \
  --filter-expression "contains(configS3Key, :batch)" \
  --expression-attribute-values "{\":batch\":{\"S\":\"$BATCH_ID\"}}" \
  --select COUNT \
  --output json | jq -r '.Count')

echo "Jobs created: $JOB_COUNT / $TOTAL_CLIENTS"
echo ""

# Monitor processing
echo "=========================================="
echo "  Monitoring LMI Processing"
echo "=========================================="
echo "Press Ctrl+C to stop monitoring (jobs will continue)"
echo ""

MONITOR_START=$(date +%s)

while true; do
  # Get queue metrics
  QUEUE_DEPTH=$(aws sqs get-queue-attributes \
    --queue-url $QUEUE_URL \
    --attribute-names ApproximateNumberOfMessages \
    --query 'Attributes.ApproximateNumberOfMessages' \
    --output text)
  
  IN_FLIGHT=$(aws sqs get-queue-attributes \
    --queue-url $QUEUE_URL \
    --attribute-names ApproximateNumberOfMessagesNotVisible \
    --query 'Attributes.ApproximateNumberOfMessagesNotVisible' \
    --output text)
  
  # Get Lambda concurrent executions
  CONCURRENT=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name ConcurrentExecutions \
    --dimensions Name=FunctionName,Value=retirement-sim-worker \
    --start-time $(date -u -v-2M +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 60 \
    --statistics Maximum \
    --query 'Datapoints[0].Maximum' \
    --output text 2>/dev/null || echo "0")
  
  if [ "$CONCURRENT" = "None" ]; then
    CONCURRENT="0"
  fi
  
  # Calculate processed
  PROCESSED=$((TOTAL_MESSAGES - QUEUE_DEPTH - IN_FLIGHT))
  if [ $PROCESSED -lt 0 ]; then
    PROCESSED=0
  fi
  PERCENT=$((PROCESSED * 100 / TOTAL_MESSAGES))
  
  # Calculate elapsed time
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - MONITOR_START))
  ELAPSED_MIN=$((ELAPSED / 60))
  ELAPSED_SEC=$((ELAPSED % 60))
  
  # Calculate rate and ETA
  if [ $ELAPSED -gt 0 ] && [ $PROCESSED -gt 0 ]; then
    RATE=$((PROCESSED / ELAPSED))
  else
    RATE=0
  fi
  
  if [ $RATE -gt 0 ]; then
    REMAINING=$((TOTAL_MESSAGES - PROCESSED))
    ETA=$((REMAINING / RATE))
    ETA_HOURS=$((ETA / 3600))
    ETA_MIN=$(((ETA % 3600) / 60))
  else
    ETA_HOURS=0
    ETA_MIN=0
  fi
  
  TIMESTAMP=$(date +"%H:%M:%S")
  echo "[$TIMESTAMP] ${ELAPSED_MIN}m${ELAPSED_SEC}s | Processed: $PROCESSED/$TOTAL_MESSAGES ($PERCENT%) | Queue: $QUEUE_DEPTH | Processing: $IN_FLIGHT | Concurrent: $CONCURRENT | Rate: $RATE/s | ETA: ${ETA_HOURS}h${ETA_MIN}m"
  
  # Exit if complete
  if [ "$QUEUE_DEPTH" = "0" ] && [ "$IN_FLIGHT" = "0" ] && [ $ELAPSED -gt 60 ]; then
    echo ""
    echo "🎉 All $TOTAL_MESSAGES messages processed!"
    TOTAL_TIME=$((CURRENT_TIME - START_TIME))
    TOTAL_HOURS=$((TOTAL_TIME / 3600))
    TOTAL_MIN=$(((TOTAL_TIME % 3600) / 60))
    TOTAL_SEC=$((TOTAL_TIME % 60))
    echo "Total time: ${TOTAL_HOURS}h ${TOTAL_MIN}m ${TOTAL_SEC}s"
    break
  fi
  
  sleep 30
done

echo ""
echo "=========================================="
echo "  Load Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Clients: $TOTAL_CLIENTS"
echo "  Messages: $TOTAL_MESSAGES"
echo "  Total scenarios: $((TOTAL_CLIENTS * SCENARIOS_PER_CLIENT))"
echo ""
echo "Analysis Commands:"
echo ""
echo "1. Check job completion:"
echo "   aws dynamodb scan --table-name retirement-sim-jobs \\"
echo "     --filter-expression \"contains(configS3Key, :batch)\" \\"
echo "     --expression-attribute-values '{\\":batch\\":{\\"S\\":\\"$BATCH_ID\\"}}' \\"
echo "     --output json | jq -r '.Items[] | {jobId: .jobId.S, completed: .completedShards.N, total: .totalShards.N}'"
echo ""
echo "2. Check instance distribution:"
echo "   aws dynamodb scan --table-name retirement-sim-jobs \\"
echo "     --filter-expression \"contains(configS3Key, :batch)\" \\"
echo "     --expression-attribute-values '{\\":batch\\":{\\"S\\":\\"$BATCH_ID\\"}}' \\"
echo "     --output json | jq -r '.Items[] | {instance: .instanceId.S, type: .instanceType.S, az: .availabilityZone.S}' | \\"
echo "     jq -s 'group_by(.instance) | map({instance: .[0].instance, type: .[0].type, az: .[0].az, count: length})'"
echo ""
echo "3. Check S3 results:"
echo "   aws s3 ls s3://$OUTPUT_BUCKET/jobs/ --recursive | wc -l"
