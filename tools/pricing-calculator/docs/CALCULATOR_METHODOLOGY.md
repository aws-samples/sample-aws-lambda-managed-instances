# LMI Cost Calculator - Methodology

This document explains how the AWS Lambda Managed Instances (LMI) Cost Calculator determines capacity requirements and cost estimates.

## Overview

The calculator estimates the number of LMI instances needed to run your Lambda workload and compares costs across different deployment options (Standard Lambda, LMI, and Self-Managed EC2).

## Input Parameters

### Workload Configuration
- **Runtime**: Lambda runtime (Python, Node.js, Java, .NET)
- **Target Concurrency**: Number of concurrent executions needed
- **Memory per Execution**: Memory allocated per Lambda invocation (MB)
- **Monthly Requests**: Total number of invocations per month
- **Average Duration**: Execution time per invocation (seconds)

### Workload Profile
- **Workload Type**: Determines CPU usage per invocation
  - IO-Heavy (Proxy/Queue): 12.5% CPU per invocation → 8 concurrent per vCPU
  - Balanced (Mixed): 25% CPU per invocation → 4 concurrent per vCPU
  - CPU-Heavy (Compute): 50% CPU per invocation → 2 concurrent per vCPU

### Infrastructure
- **Instance Type**: EC2 instance type for LMI (c7g, m7g, r7g families)
- **AZ Resilience**: Multi-AZ configuration (3-AZ, 5-AZ, or none)
- **Savings Plan**: Pricing commitment (On-Demand, Compute SP, EC2 SP, Reserved Instances)

## Calculation Steps

### Step 1: Runtime Concurrency Limits

Each Lambda runtime has a maximum concurrent executions per vCPU:
- Python: 16 concurrent per vCPU
- Node.js: 64 concurrent per vCPU
- Java: 32 concurrent per vCPU
- .NET: 32 concurrent per vCPU

### Step 2: Sustainable Concurrency

Based on the workload type, we calculate how many concurrent invocations can run sustainably while meeting latency requirements:

```
Sustainable Concurrent per vCPU = 100% ÷ CPU% per invocation
```

Examples:
- IO-Heavy: 100% ÷ 12.5% = 8 concurrent per vCPU
- Balanced: 100% ÷ 25% = 4 concurrent per vCPU
- CPU-Heavy: 100% ÷ 50% = 2 concurrent per vCPU

The sustainable concurrency is capped at the runtime limit.

### Step 3: Function Memory Sizing

LMI requires a minimum of 2,048 MB per execution environment. The function memory is calculated as:

```
Function Memory = max(2048 MB, Memory per Exec × Concurrent per vCPU)
```

### Step 4: vCPUs per Environment

Each execution environment needs enough vCPUs to support the function memory:

```
vCPUs per Environment = ⌈Function Memory ÷ (Memory-to-vCPU Ratio × 1024)⌉
```

Default memory-to-vCPU ratios:
- Compute optimized (c7g): 2:1
- Balanced (m7g): 4:1
- Memory optimized (r7g): 8:1

### Step 5: Environments Needed

```
Environments Needed = ⌈Target Concurrency ÷ Sustainable Concurrent per Environment⌉
```

Where:
```
Sustainable Concurrent per Environment = Sustainable Concurrent per vCPU × vCPUs per Environment
```

### Step 6: Packing Efficiency

LMI reserves 1 vCPU and 1 GB for the operating system on each instance. The number of environments that fit per instance:

```
Environments per Instance = min(
  ⌊(Instance vCPUs - 1) ÷ vCPUs per Environment⌋,
  ⌊(Instance Memory - 1024 MB) ÷ Function Memory⌋
)
```

### Step 7: Base Instance Count

```
Base Instances = ⌈Environments Needed ÷ Environments per Instance⌉
```

Minimum instances are enforced based on AZ configuration:
- 3-AZ: minimum 3 instances
- 5-AZ: minimum 5 instances
- No AZ buffer: minimum 1 instance

### Step 8: Scaling Buffer

A fixed 50% scaling buffer is applied to provide headroom for traffic spikes:

```
Final Instances = max(Minimum Instances, ⌈Base Instances × 1.5⌉)
```

## Cost Calculations

### LMI Monthly Cost

```
EC2 Cost = Instances × Instance Hourly Rate × 730 hours × (1 - Discount Rate)
Management Fee = EC2 On-Demand Cost × 15%
Request Cost = Monthly Requests × $0.20 per 1M requests

Total LMI Cost = EC2 Cost + Management Fee + Request Cost
```

### Standard Lambda Cost

```
GB-Seconds = Monthly Requests × Duration (sec) × Memory (GB)
Compute Cost = GB-Seconds × Price per GB-sec × (1 - Discount Rate)
Request Cost = Monthly Requests × $0.20 per 1M requests

Total Lambda Cost = Compute Cost + Request Cost
```

Pricing (us-east-1):
- ARM64: $0.0000133333 per GB-second
- x86_64: $0.0000166667 per GB-second

### Self-Managed EC2 Cost

Assumes 60% packing efficiency (vs LMI's 80%):

```
EC2 Instances Needed = ⌈LMI Instances × (80% ÷ 60%)⌉
EC2 Cost = EC2 Instances × Instance Hourly Rate × 730 hours × (1 - Discount Rate)
```

## Savings Plans & Discounts

The calculator supports multiple pricing commitment options with different discount rates:

| Pricing Option | LMI/EC2 Discount | Lambda Discount | Commitment |
|---|---|---|---|
| On-Demand | 0% | 0% | None |
| Compute Savings Plan (1yr) | 32% | 12% | 1 year |
| Compute Savings Plan (3yr) | 65% | 12% | 3 years |
| EC2 Instance Savings Plan (1yr) | 32% | 0% | 1 year |
| Reserved Instance (3yr) | 65% | 0% | 3 years |

**Important Notes:**
- Discounts apply to **compute costs only**, not request costs
- Lambda Savings Plans discount applies to compute (GB-seconds), not requests
- EC2 Instance Savings Plans and Reserved Instances do not discount Lambda costs
- Compute Savings Plans provide flexibility across Lambda and EC2 compute
- All discount rates are based on internal analysis and may vary by region/instance type

## Key Assumptions

1. **Packing Efficiency**: LMI achieves 80% packing efficiency, self-managed EC2 achieves 60%
2. **OS Overhead**: 1 vCPU + 1 GB reserved per instance
3. **Minimum Memory**: 2,048 MB per execution environment
4. **Scaling Buffer**: Fixed 50% buffer for traffic headroom
5. **AZ Buffer**: 
   - 3-AZ: 1.5× capacity for AZ failure tolerance
   - 5-AZ: 1.25× capacity for AZ failure tolerance
6. **Region**: All pricing based on us-east-1
7. **Hours per Month**: 730 hours (365 days ÷ 12 months × 24 hours)

## Workload Suitability

The calculator provides a suitability score based on:
- **Instance count**: Low traffic (≤3 instances) may not justify LMI overhead
- **Workload type**: CPU-heavy workloads see lower concurrency gains

Warnings are provided for edge cases where Standard Lambda may be more cost-effective.

## Example Calculation

**Inputs:**
- Runtime: Python
- Target Concurrency: 100
- Memory per Exec: 512 MB
- Workload Type: Balanced (25% CPU)
- Instance Type: c7g.xlarge (4 vCPU, 8 GB)

**Calculation:**
1. Sustainable concurrent per vCPU: 100% ÷ 25% = 4
2. Function memory: max(2048, 512 × 4) = 2,048 MB
3. vCPUs per environment: ⌈2048 ÷ 2048⌉ = 1
4. Sustainable concurrent per environment: 4 × 1 = 4
5. Environments needed: ⌈100 ÷ 4⌉ = 25
6. Environments per instance: min(⌊3 ÷ 1⌋, ⌊7168 ÷ 2048⌋) = 3
7. Base instances: ⌈25 ÷ 3⌉ = 9
8. Final instances (with buffer): ⌈9 × 1.5⌉ = 14 (but minimum 3 for 3-AZ)

**Result:** 14 c7g.xlarge instances needed

## References

- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [AWS EC2 Pricing](https://aws.amazon.com/ec2/pricing/)
- [Lambda Managed Instances Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html)
- [AWS Savings Plans](https://aws.amazon.com/savingsplans/)
- [Compute Savings Plans](https://aws.amazon.com/savingsplans/compute-pricing/)
- [EC2 Instance Savings Plans](https://aws.amazon.com/savingsplans/pricing/)
- [EC2 Reserved Instances](https://aws.amazon.com/ec2/pricing/reserved-instances/)
