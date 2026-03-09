# AWS Lambda Managed Instances (LMI) Examples

This repository contains sample applications demonstrating AWS Lambda Managed Instances (LMI) across various industries and use cases.

## What is Lambda Managed Instances?

AWS Lambda Managed Instances (LMI) runs Lambda functions on longer-lived AWS-managed compute instances while preserving Lambda's programming model and developer experience. LMI is designed for workloads that benefit from:

- Reduced cold starts through persistent execution environments
- Cost-efficient pricing with EC2 instance hours instead of per-millisecond billing
- Right-sized compute with configurable memory-to-vCPU ratios
- High concurrency with multiple invocations per instance
- Minimal operational overhead without container images or cluster management

## Examples by Industry

### Financial Services (FSI)

- **[Retirement Savings Simulator](./examples/fsi/sample-retirement-savings-simulator/)** - Monte Carlo simulation for retirement planning using sustained CPU-intensive parallel processing

### Tools

- **[LMI Pricing Calculator](https://aws-samples.github.io/sample-aws-lambda-managed-instances/)** - Interactive cost calculator for comparing AWS Lambda Managed Instances pricing

## Getting Started

Each example includes:
- Complete deployment instructions using AWS SAM
- Architecture diagrams and design patterns
- Performance benchmarks and cost analysis
- Production-ready monitoring and observability setup

Navigate to individual example directories for detailed documentation.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI (v1.152.0 or later)
- Python 3.13 or later
- An existing Amazon VPC with private subnets

## Contributing

This repository contains sample code for demonstration purposes. For issues or questions, please open a GitHub issue.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.
