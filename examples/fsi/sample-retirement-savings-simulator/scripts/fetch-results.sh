#!/bin/bash
#
# Fetch aggregated results for a completed retirement simulation job
#
# Usage: ./fetch-results.sh <job-id>
# Example: ./fetch-results.sh 550e8400-e29b-41d4-a716-446655440000

set -e

# Get stack name from environment or use default
STACK_NAME=${STACK_NAME:-retirement-sim}

# Get job ID from argument
if [ -z "$1" ]; then
    read -p "Enter Job ID: " JOB_ID
else
    JOB_ID="$1"
fi

# Get API endpoint from CloudFormation outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
    --output text)

if [ -z "$API_ENDPOINT" ]; then
    echo "Error: Could not find API endpoint from stack $STACK_NAME"
    exit 1
fi

# Replace /submit with /results/{jobId}
RESULTS_URL="${API_ENDPOINT%/submit}/results/$JOB_ID"

echo "Fetching results for Job ID: $JOB_ID"
echo "URL: $RESULTS_URL"
echo ""

# Fetch and display results
RESPONSE=$(curl -s "$RESULTS_URL")

# Check for errors
if echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); sys.exit(0 if 'error' not in d else 1)" 2>/dev/null; then
    echo "$RESPONSE" | python3 -c "
import sys, json

data = json.load(sys.stdin)
body = json.loads(data.get('body', '{}')) if isinstance(data.get('body'), str) else data

print('RETIREMENT SAVINGS SIMULATION RESULTS')
print('=' * 60)
print()

# Summary
summary = body.get('summary', {})
if summary:
    total = summary.get('totalScenarios', 0)
    workers = summary.get('numWorkers', 0)
    print(f'Total Scenarios Simulated: {total:,}')
    print(f'Number of Workers:         {workers}')
    print()

# Distribution
dist = body.get('distribution', {})
if dist:
    print('RETIREMENT SAVINGS DISTRIBUTION')
    print('-' * 60)
    labels = {
        'p5':  ' 5th Percentile (worst case)',
        'p10': '10th Percentile',
        'p25': '25th Percentile',
        'p50': '50th Percentile (median)',
        'p75': '75th Percentile',
        'p90': '90th Percentile',
        'p95': '95th Percentile (best case)',
    }
    for key in ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95']:
        if key in dist:
            print(f'  {labels[key]:>30s}:  \${dist[key]:>12,.0f}')
    if 'mean' in dist:
        print(f'  {\"Mean (average)\":>30s}:  \${dist[\"mean\"]:>12,.0f}')
    if 'stdDev' in dist:
        print(f'  {\"Standard Deviation\":>30s}:  \${dist[\"stdDev\"]:>12,.0f}')
    print()

# Probability
prob = body.get('probability', {})
if prob:
    print('PROBABILITY OF SUCCESS')
    print('-' * 60)
    label_map = {'reach500K': '\$0.5M', 'reach1M': '\$1.0M', 'reach2M': '\$2.0M'}
    for key in ['reach500K', 'reach1M', 'reach2M']:
        if key in prob:
            label = label_map.get(key, key)
            print(f'  Reach {label}: {prob[key]}%')
    print()

# Performance
perf = body.get('performance', {})
if perf:
    print('PERFORMANCE METRICS')
    print('-' * 60)
    avg_dur = perf.get('avgWorkerDurationMinutes', 0)
    sps = perf.get('scenariosPerSecond', 0)
    total_time = perf.get('totalComputeTimeMinutes', 0)
    print(f'  Average Worker Duration:    {avg_dur:.1f} minutes')
    print(f'  Scenarios per Second:       {sps:,.0f}')
    print(f'  Total Compute Time:         {total_time:.1f} minutes')
    print()

# Cost
cost = body.get('cost', {})
if cost:
    print('COST EFFICIENCY')
    print('-' * 60)
    est = cost.get('estimatedCost', 0)
    spd = cost.get('scenariosPerDollar', 0)
    print(f'  Estimated Cost:             \${est:.2f}')
    print(f'  Scenarios per Dollar:       {spd:,.0f}')
    print()

print('Raw JSON saved to: /tmp/retirement-sim-results.json')
with open('/tmp/retirement-sim-results.json', 'w') as f:
    json.dump(body, f, indent=2)
"
else
    echo "Error fetching results:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi
