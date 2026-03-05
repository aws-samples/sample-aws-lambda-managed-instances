#!/bin/bash
#
# Upload retirement configuration to S3 input bucket
#
# Usage: ./upload-config.sh [config-name]
# Example: ./upload-config.sh conservative-saver

set -e

# Get stack name from samconfig.toml or use default
STACK_NAME=${STACK_NAME:-retirement-sim}

# Get config name from argument or prompt
if [ -z "$1" ]; then
    echo "Available configurations:"
    echo "  1. conservative-saver"
    echo "  2. aggressive-investor"
    echo "  3. young-starter"
    echo "  4. near-retirement"
    echo ""
    read -p "Enter config name (or number): " CONFIG_INPUT
    
    case $CONFIG_INPUT in
        1) CONFIG_NAME="conservative-saver" ;;
        2) CONFIG_NAME="aggressive-investor" ;;
        3) CONFIG_NAME="young-starter" ;;
        4) CONFIG_NAME="near-retirement" ;;
        *) CONFIG_NAME="$CONFIG_INPUT" ;;
    esac
else
    CONFIG_NAME="$1"
fi

# Get input bucket name from CloudFormation outputs
INPUT_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='InputBucketName'].OutputValue" \
    --output text)

if [ -z "$INPUT_BUCKET" ]; then
    echo "Error: Could not find InputBucket from stack $STACK_NAME"
    echo "Make sure the stack is deployed."
    exit 1
fi

# Check if config file exists
CONFIG_FILE="../data/${CONFIG_NAME}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found: $CONFIG_FILE"
    exit 1
fi

# Upload to S3
echo "Uploading $CONFIG_NAME to s3://$INPUT_BUCKET/data/${CONFIG_NAME}.json"
aws s3 cp "$CONFIG_FILE" "s3://$INPUT_BUCKET/data/${CONFIG_NAME}.json"

echo ""
echo "✅ Config uploaded successfully!"
echo ""
echo "S3 Key: data/${CONFIG_NAME}.json"
echo ""
echo "Next step: Run ./submit-job.sh $CONFIG_NAME"
