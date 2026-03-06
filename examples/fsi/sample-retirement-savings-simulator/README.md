# Retirement Savings Simulator on Lambda Managed Instances

An AWS Sample demonstrating Lambda Managed Instances (LMI) for sustained CPU-intensive Monte Carlo simulation.

---

**Contents**

[Problem Statement](#problem-statement) | [Solution Using LMI](#solution-using-lambda-managed-instances-lmi) | [Prerequisites](#prerequisites) | [Quick Start](#quick-start) | [Sample Output](#sample-output) | [Load Testing and LMI Scaling Behavior](#load-testing-and-lmi-scaling-behavior) | [Observability and Monitoring](#observability-and-monitoring) | [Cleanup](#cleanup) | [Conclusion](#conclusion)

---

## Problem Statement

### The Business Scenario

You run a financial advisory firm with 100 advisors who meet with 10 clients daily. Each client asks the same critical question: "Will I have enough money to retire comfortably?" Your advisors must provide personalized analysis based on each client's savings, contributions, timeline, and risk tolerance. Simple formulas like "Save $1,000/month for 20 years at 7% returns = $X" mislead clients because markets don't deliver 7% every year—some years surge 20%, others crash 15%, and the sequence matters enormously. Your advisors run Monte Carlo simulations that analyze hundreds of thousands of market scenarios, showing clients the full range of outcomes from worst case (5th percentile) to best case (95th percentile) plus the probability of hitting their goals. The scale: 100 advisors × 10 clients daily × multiple runs per client = 1,000+ simulations daily, each requiring 10-15 minutes of sustained CPU-intensive computation—exactly the workload *Lambda Managed Instances* handles efficiently.

### Why Monte Carlo Simulation?

Monte Carlo simulation works like a weather forecast for retirement savings. Instead of one prediction ("You'll have $900K"), it runs thousands of scenarios: market surges early then slows ($1.2M), crashes in year 5 then recovers ($800K), stays steady throughout ($950K), plus a million more variations. Each scenario generates random market returns for every month (240 months for 20 years), compounds returns month-by-month with contributions, and calculates the final portfolio value—comprehensive analysis requires 100,000 to 1,000,000 scenarios (each involving hundreds of calculations) totaling billions of floating-point operations. Running 1 million scenarios sequentially on a laptop takes 30-60 minutes, but financial advisors need results in minutes to have interactive conversations with clients.

This answers critical questions: "What's the worst realistic outcome?" (5th percentile), "What's most likely?" (median), "What are my chances of hitting $1M?" (probability). The simulation uses Geometric Brownian Motion—markets move randomly but trend upward over time. Each month might gain 2%, lose 3%, or stay flat, and over 20 years you get realistic paths including bull markets, bear markets, and recoveries. Every simulation creates a different sequence of good and bad years, so running it 1 million times reveals all possible futures from worst to best case.

That's a lot of math for one computer.

**Why This Needs Parallel Processing**: Monte Carlo simulation is "embarrassingly parallel"—each scenario runs independently without communicating with others, perfect for map-reduce processing where you split work across hundreds of workers, process scenarios in isolation, then aggregate results to calculate percentiles and probabilities. We chose this example because it demonstrates LMI's strength: sustained CPU-intensive workloads that scale horizontally without complex coordination.

**How We Achieve Parallel Processing**: When a user requests 1 million scenarios, a job coordinator breaks this into 1,000 chunks of 1,000 scenarios each and places them in a work queue. Multiple compute workers pull work items continuously, each processing its assigned scenarios independently—one worker simulates scenarios 1-1,000 while another handles 500,001-501,000, all running simultaneously. Workers store results in a data store and update a job tracker, and once all chunks complete, the system aggregates final results. This pattern—coordinator splits work, queue distributes it, workers process in parallel, data store collects results—can help achieve linear scaling where 10 workers may turn a 30-minute job into approximately 3 minutes.

![Parallel Processing Architecture](./assets/SimulationFLow.png)

*Figure: A single job is split into multiple independent work items, distributed across worker nodes for parallel processing, with results stored in a distributed database and aggregated at the end.*

### What Goes In (Input)

An advisor provides a client's retirement profile: initial savings ($100K), monthly contribution ($1K), years to retirement (20), expected annual return (7%), and market volatility (15%)—for example, a 45-year-old with $100K saved, contributing $1,000/month, retiring at 65 with a balanced portfolio.

```json
{
  "initialSavings": 100000,
  "monthlyContribution": 1000,
  "yearsToRetirement": 20,
  "annualReturn": 0.07,
  "volatility": 0.15
}
```

The system adds simulation parameters (`totalScenarios`: 1M, `shards`: 10) and stores the complete configuration in S3.

### What Comes Out (Output)

The simulation produces a distribution showing worst case ($450K at 5th percentile), most likely ($850K median), and best case ($1.5M at 95th percentile)—far more valuable than a single number because it shows the range of uncertainty and helps clients make informed decisions about saving more or working longer.

```
RETIREMENT SAVINGS DISTRIBUTION
------------------------------------------------------------
  5th Percentile (worst case):   $450,000
 50th Percentile (median):       $850,000
 95th Percentile (best case):    $1,500,000
 Mean (average):                 $900,000
 Standard Deviation:             $285,000
```
## Solution Using Lambda Managed Instances (LMI)

AWS Lambda Managed Instances (LMI) runs AWS Lambda functions on longer-lived AWS-managed compute instances while preserving Lambda's programming model and developer experience. LMI helps reduce cold starts (NumPy loads once and stays warm across invocations), provides cost-efficient pricing (Amazon EC2 instance hours instead of per-millisecond billing), enables right-sized compute (compute-optimized instances with configurable memory-to-vCPU ratios), supports high concurrency (10 invocations per instance), and is designed to minimize operational overhead (no container images, cluster management, or capacity planning).

![AWS Parallel Processing Architecture](./assets/Architecture.png)

## Prerequisites

AWS CLI, AWS SAM CLI (v1.152.0+), Python 3.13, Bash shell, and an existing Amazon VPC with 2+ private subnets across availability zones and VPC endpoints for Amazon S3/Amazon DynamoDB/Amazon SQS (recommended for private subnets).

**Cost Warning:** This sample creates billable AWS resources including EC2 instances (managed by AWS Lambda), DynamoDB tables, S3 buckets, and SQS queues. Running the load test can incur costs of approximately $7-10. You will be charged for these resources until you delete the stack.

### IAM Roles and Permissions

This sample automatically creates IAM roles following the principle of least privilege. The CloudFormation template creates four roles:

1. **SubmitterRole** - Job submission Lambda function with permissions to read S3 configuration files, write to DynamoDB jobs table, and send messages to SQS
2. **WorkerRole** - Worker Lambda function with VPC access, permissions to read S3 input, write S3 output, update DynamoDB, and process SQS messages
3. **AggregatorRole** - Results aggregation Lambda function with read-only access to S3 output bucket and DynamoDB jobs table
4. **CapacityProviderOperatorRole** - LMI capacity provider with EC2 permissions to launch and manage instances on your behalf

These are NOT service-linked roles. The template creates them with minimal required permissions scoped to specific resources (buckets, tables, queues) created by this stack. Review the IAM policies in `template.yaml` (lines 136-240) before deployment to ensure they meet your security requirements.

### VPC and Network Security

The Worker Lambda function runs inside your VPC to demonstrate LMI networking capabilities. The template creates a security group with the following configuration:

- **Egress Rules**: HTTPS only (port 443) to 0.0.0.0/0 for AWS API calls
- **Ingress Rules**: None (Lambda functions don't accept inbound connections)
- **VPC Requirements**: 
  - Private subnets with NAT Gateway OR VPC endpoints for AWS services (S3, DynamoDB, SQS, Lambda)
  - Subnets must span at least 2 Availability Zones for high availability
  - Sufficient IP addresses for Lambda ENIs (recommend /24 or larger subnets)

The security group is automatically created by the CloudFormation template. If you prefer to use an existing security group, modify the `LMISecurityGroup` resource in `template.yaml`.

## Quick Start

### 1. Prepare VPC Information

You'll need the following from your existing VPC:
- VPC ID (such as `vpc-0123456789abcdef0`)
- Subnet IDs (at least 2, such as `subnet-abc123,subnet-def456`)

**Note:** The subnets should be private subnets with NAT Gateway or VPC endpoints for AWS services (S3, DynamoDB, SQS, Lambda).

### 2. Deploy the Stack

```bash
sam build
sam deploy --guided
```

Follow the prompts:
- Stack name: `retirement-sim`
- AWS Region: `us-east-1` (or your preferred region)
- **VpcId**: Enter your VPC ID
- **SubnetIds**: Enter comma-separated subnet IDs (such as `subnet-abc123,subnet-def456`)
- Confirm changes: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration: `Y`

### 3. Upload a Configuration

```bash
cd scripts
./upload-config.sh conservative-saver
```

Available configurations: `conservative-saver` (low risk, 20 years), `aggressive-investor` (high risk, 30 years), `young-starter` (long horizon, 40 years), `near-retirement` (short horizon, 5 years).

### 3. Submit a Job

Get the API endpoint from AWS CloudFormation outputs:

```bash
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name retirement-sim \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)
```

Submit a job using curl:

```bash
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"configS3Key": "data/conservative-saver.json"}'
```

This returns a Job ID - save it for checking status.

### 4. Check Job Status

```bash
./check-status.sh <job-id>
```

The job will take approximately 12 minutes to complete.

### 5. Get Results

Once the job is completed, fetch results via API:

```bash
curl $API_ENDPOINT/results/<job-id>
```

Or use the full URL:

```bash
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/results/<job-id>
```

This returns aggregated results with retirement savings distribution (P5, P50, P95), probability of reaching goals, performance metrics, and cost efficiency.

## Sample Output

```
RETIREMENT SAVINGS SIMULATION RESULTS
============================================================

Total Scenarios Simulated: 1,000,000
Number of Workers:         10

RETIREMENT SAVINGS DISTRIBUTION
------------------------------------------------------------
  5th Percentile (worst case):  $450,000
 50th Percentile (median):      $850,000
 95th Percentile (best case):   $1,500,000
 Mean (average):                 $900,000

PROBABILITY OF SUCCESS
------------------------------------------------------------
  Reach $0.5M: 92%
  Reach $1.0M: 58%
  Reach $2.0M: 12%

PERFORMANCE METRICS
------------------------------------------------------------
  Average Worker Duration:    12.0 minutes
  Scenarios per Second:       139
  Total Compute Time:         120.0 minutes

COST EFFICIENCY
------------------------------------------------------------
  Estimated Cost:             $0.48
  Scenarios per Dollar:       2,083,333
```

## Load Testing and LMI Scaling Behavior

### Test Configuration

**Objective:** Validate LMI performance under sustained production load simulating 240 financial advisors analyzing client retirement portfolios simultaneously.

**Test design:** We configured four Amazon EventBridge schedulers to submit 1 job/minute each over 60 minutes, emulating continuous client requests. Each job analyzed 1 million Monte Carlo scenarios split across 10 parallel workers, generating 24,000 Lambda invocations that processed 2.4 billion scenarios total.

**Scale:** 240 client analyses, 40 million scenarios/minute sustained throughput.

### Observed Scaling Pattern

**22:40 UTC - Initial burst**

Four schedulers fired simultaneously, submitting 235 jobs instantly. Each job spawned 10 worker tasks, flooding Amazon SQS with 2,350 messages. Three warm Lambda Execution environments on 3 EC2 instances provided 30 concurrent execution slots but couldn't absorb the spike. Lambda throttled invocations immediately. Worker duration spiked from 2.5 to 4.6 minutes as invocations queued.

**22:45 UTC - Auto-scaling triggered**

CPU hit 85% across warm instances. LMI auto-scaling kicked in. Throttles peaked at 150/minute. SQS queue depth continued growing as incoming rate exceeded processing capacity. Messages piled up waiting for capacity.

**22:50 UTC - Capacity ramping**

LMI scaled to 10 instances, providing 100 concurrent slots. Throttles declined. Queue depth peaked around 10 minutes into the test as Lambda capacity caught up with incoming rate. Processing accelerated.

**22:55 UTC - Equilibrium reached**

LMI provisioned 16 execution environments across 7 EC2 instances, delivering 160 concurrent slots. Throttling stopped. CPU stabilized at 70%. Worker duration normalized to 2.5 minutes. Each environment handled 3-5 concurrent invocations (50% of 10 limit). The queue began draining - processing rate now exceeded incoming rate.

**23:42 UTC - Test complete**

We analyzed 240 clients, processed 2.4 billion scenarios, and achieved zero errors with 100% success rate. Queue flat-lined at zero.

**Key insight:** Amazon SQS absorbed the 10-minute scale-up burst without dropping messages. Lambda's event source mapping automatically scaled polling concurrency as capacity became available. This configuration required minimal manual tuning. Once at full capacity, the system maintained steady-state processing matching incoming rate (4 jobs/minute).

![SQS Scaling Behavior](./assets/scaling_with_SQS.png)

*Figure: SQS message queue depth and Lambda polling behavior during the load test. The queue absorbed the initial burst of 2,350 messages, then drained as Lambda scaled up instances.*

### Performance at Scale

- **Throughput**: 1,733-2,623 scenarios/second per worker (average 2,100)
- **Cost per client**: $0.03-0.04 per analysis (1M scenarios)
- **Cost efficiency**: 25-33M scenarios per dollar = $7.20 for 240 clients
- **Scaling time**: 15 minutes from 3→16 instances under burst load
- **Steady-state**: 70% CPU, 10% memory, zero throttling after scale-up

### EC2 Utilization Analysis

**Physical infrastructure:** 7 unique EC2 instances (c6i.2xlarge) provisioned during peak load, distributed across 3 availability zones (us-east-1a, us-east-1b, us-east-1c).

**Execution environment distribution:** 18 execution environments at peak across 7 instances = 2-3 EEs per instance. Each c6i.2xlarge has 8 vCPUs (7 usable after Lambda overhead). With 4GB memory config (2 vCPUs per EE), optimal packing is 3 EEs per instance.

**Observed utilization:** EC2 instances maintained 50-55% CPU utilization during active processing, with uniform distribution across all instances indicating even workload distribution.

![EC2 CPU Utilization](./assets/EC2_CPU_Utilization.png)

*Figure: CPU utilization across all 7 EC2 instances during the load test. All instances show consistent 50-55% utilization during active processing (22:40-23:42 UTC), then drop to idle. The uniform pattern across instances confirms even distribution of execution environments.*

### Key Findings

**LMI delivers predictable cost at scale.** Approximately $0.03 per client analysis (1M scenarios) vs traditional compute. 15-minute cold-start penalty on burst workloads, then linear scaling. Pre-warming can help reduce throttling.

**Optimization opportunities:** Right-size memory 4GB→2GB (90% unused). Increase concurrency 10→15 per instance (currently 50% utilized). Potential 30% cost reduction.

### Monitoring LMI

LMI metrics are split across two CloudWatch dimensions:
- **Alias (live)**: Invocations, Errors, Throttles, Duration
- **Version ($LATEST or numbered)**: CPU Utilization, Memory Utilization, Concurrency, Execution Environment Count

Create a unified dashboard combining both views to monitor LMI performance effectively.

## Observability and Monitoring

### CloudWatch Metrics

The sample emits custom metrics to Amazon CloudWatch:
- Namespace: `RetirementSimulator/LMI`
- Metrics: ScenariosProcessed, ExecutionDuration, ScenariosPerSecond, etc.

View metrics in CloudWatch Console or create dashboards.

### Production Monitoring Best Practices

**Key Metrics to Monitor:**
- **Lambda Invocations**: Track successful vs failed invocations to detect processing issues
- **Throttles**: Monitor throttling events to identify capacity constraints requiring pre-warming or increased limits
- **Duration**: Watch P50, P90, P99 latencies to detect performance degradation
- **Concurrent Executions**: Track concurrency to ensure you're within account limits and scaling appropriately
- **SQS Queue Depth**: Monitor ApproximateNumberOfMessages to detect backlog buildup
- **DynamoDB Throttles**: Watch for throttled requests indicating insufficient capacity
- **Error Rates**: Set alarms on Lambda errors, DLQ messages, and failed job counts

**Recommended CloudWatch Alarms:**
- Lambda error rate > 1% over 5 minutes
- SQS queue depth > 1000 messages for > 10 minutes
- Lambda throttles > 10 over 5 minutes
- DynamoDB consumed capacity > 80% of provisioned (if using provisioned mode)
- Worker function duration > 800 seconds (approaching 900s timeout)

**Logging Strategy:**
- Lambda functions log to CloudWatch Logs with 7-day retention (configurable in template)
- Worker functions emit structured JSON logs with job/shard context for correlation
- Use CloudWatch Logs Insights to query across invocations: `fields @timestamp, jobId, shardId, scenarios, executionMs | filter jobId = "your-job-id"`
- Enable X-Ray tracing on API Gateway (already configured) to trace request flows

**Cost Monitoring:**
- Tag all resources with `Project: retirement-sim` for cost allocation
- Monitor EC2 instance hours from LMI capacity provider
- Track S3 storage costs for input/output buckets
- Review DynamoDB consumed capacity and storage
- Use AWS Cost Explorer to analyze costs by service and tag

## Cleanup
**Warning:** Deleting the stack will permanently delete all data in the S3 buckets and DynamoDB table, including simulation results and job history. Make sure to back up any data you need before proceeding.

To delete all resources:

```bash
sam delete
```


## Conclusion

This sample demonstrates how AWS Lambda Managed Instances (LMI) can efficiently handle sustained CPU-intensive workloads like Monte Carlo simulations. By running Lambda functions on longer-lived EC2 instances, LMI provides the cost efficiency of EC2 pricing with the simplicity of Lambda's programming model.

Key takeaways:
- LMI is well-suited for parallel batch processing workloads that require sustained compute
- The combination of SQS for work distribution and LMI for processing enables linear scaling
- Cost per simulation ($0.03-0.04 per million scenarios) makes this approach practical for production use
- Auto-scaling handles burst workloads automatically, though pre-warming can reduce initial latency

To learn more about AWS Lambda Managed Instances, visit the [AWS Lambda documentation](https://docs.aws.amazon.com/lambda/).
