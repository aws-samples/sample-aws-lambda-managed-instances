# AWS Lambda Managed Instances Cost Calculator

A web application that estimates monthly costs for running workloads on [AWS Lambda Managed Instances](https://aws.amazon.com/lambda/lambda-managed-instances) vs Standard Lambda and Self-Managed EC2, with comprehensive capacity planning and savings plan comparisons.

## 🌐 Demo UI

**https://debongithub.github.io/lmi-cost-calculator/**

The interactive calculator provides:
- Real-time cost calculations across deployment options
- Visual cost comparison charts
- Detailed capacity breakdown and methodology
- Support for multiple workload profiles (IO-Heavy, Balanced, CPU-Heavy)
- Savings plan comparisons (On-Demand, Compute SP, EC2 SP, Reserved Instances)
- Mobile-friendly responsive design

## Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation & Development

```bash
cd web
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
cd web
npm run build
```

The production build will be in `web/dist/`

## Features

### Cost Comparison
Compare costs across three deployment models:
- **Standard Lambda** - Pay-per-use serverless
- **Lambda Managed Instances (LMI)** - Dedicated capacity with AWS management
- **Self-Managed EC2** - Full control with manual management

### Workload Profiles
- **IO-Heavy (Proxy/Queue)** - 8 concurrent per vCPU (12.5% CPU each)
- **Balanced (Mixed)** - 4 concurrent per vCPU (25% CPU each)
- **CPU-Heavy (Compute)** - 2 concurrent per vCPU (50% CPU each)

### Pricing Options
- On-Demand
- Compute Savings Plan (1yr: 32% EC2 / 12% Lambda, 3yr: 65% EC2 / 12% Lambda)
- EC2 Instance Savings Plan (1yr: 32% EC2 only)
- Reserved Instances (3yr: 65% EC2 only)

### Instance Types Supported
- **Compute Optimized**: c7g.xlarge, c7g.2xlarge, c7g.4xlarge
- **General Purpose**: m7g.xlarge, m7g.2xlarge, m7g.4xlarge
- **Memory Optimized**: r7g.xlarge, r7g.2xlarge, r7g.4xlarge

### Runtime Support
- Node.js (max concurrency 64/vCPU)
- Java (max concurrency 32/vCPU)
- .NET (max concurrency 32/vCPU)
- Python (max concurrency 16/vCPU)

## How It Works

### Capacity Calculation
The calculator follows AWS Lambda Managed Instances capacity planning methodology:

1. **Sustainable Concurrency** - Based on workload type and CPU utilization
2. **Function Memory** - Sized for concurrent executions (min 2,048 MB)
3. **Environments Needed** - Calculated from target concurrency
4. **Instance Packing** - Constrained by vCPUs and memory
5. **Scaling Buffer** - 50% headroom for traffic spikes
6. **AZ Resilience** - 3-AZ or 5-AZ configurations

### Cost Components

**LMI Cost:**
- EC2 instance charges (discountable via SP/RI)
- Management fee (15% of EC2 On-Demand, never discounted)
- Request charges ($0.20 per million)

**Standard Lambda Cost:**
- Compute charges (memory-based pricing per millisecond)
- Request charges ($0.20 per million)

**Self-Managed EC2 Cost:**
- EC2 instance charges (assumes 60% packing efficiency vs LMI's 80%)

### Key Assumptions
- Region: us-east-1
- Packing efficiency: LMI 80%, Self-Managed EC2 60%
- OS overhead: 1 vCPU + 1 GB per instance
- Minimum function memory: 2,048 MB
- Costs calculated for steady-state workloads
- Fluctuating traffic patterns may result in different costs

## Testing

```bash
cd tests
npm test
```

Test suite includes 10 scenarios covering various workload configurations.

## Project Structure

```
CostCalculator_New/
├── README.md                          # This file
├── web/                               # Web application
│   ├── src/
│   │   ├── components/               # React components
│   │   │   ├── CalculatorForm.jsx   # Input form
│   │   │   ├── Results.jsx          # Cost comparison table
│   │   │   ├── CostComparisonChart.jsx # Visual chart
│   │   │   └── MethodologyPanel.jsx # Calculation breakdown
│   │   ├── utils/
│   │   │   └── calculator.js        # Core calculation engine
│   │   ├── assets/                  # Pricing data and images
│   │   │   ├── lambda-pricing-by-memory.json
│   │   │   ├── aws-logo.svg
│   │   │   └── lambda-icon.svg
│   │   ├── App.jsx                  # Main application
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── tests/                            # Test suite
│   ├── calculator.test.js
│   └── test-cases.json
├── docs/                             # Documentation
│   └── CALCULATOR_METHODOLOGY.md
└── scripts/                          # Utility scripts
    └── extract-pricing.js
```

## Documentation

- [Calculator Methodology](docs/CALCULATOR_METHODOLOGY.md) - Detailed calculation logic
- [AWS Lambda Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html) - Official documentation
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/) - Official pricing

## Pricing Data

Lambda pricing is based on memory tiers and architecture (ARM/x86). The calculator uses official AWS pricing for us-east-1:
- Pricing data: `web/src/assets/lambda-pricing-by-memory.json`
- Updated: March 1, 2026

## Development

### Tech Stack
- React 18
- Vite
- CSS3 (no framework)

### Code Structure
- **calculator.js** - Pure calculation logic (no UI dependencies)
- **Components** - Presentational components with minimal logic
- **App.jsx** - State management and component orchestration

### Key Files

**Core Logic:**
- `web/src/utils/calculator.js` - All calculation functions
  - `calculateLmi()` - Main calculation entry point
  - `calcLmiCost()` - LMI cost calculation
  - `calcStandardLambdaCost()` - Standard Lambda cost calculation
  - `calcEc2Cost()` - Self-managed EC2 cost calculation

**UI Components:**
- `web/src/components/CalculatorForm.jsx` - Input form with validation
- `web/src/components/Results.jsx` - Cost comparison table
- `web/src/components/CostComparisonChart.jsx` - Visual cost chart
- `web/src/components/MethodologyPanel.jsx` - Calculation breakdown

**Configuration:**
- `web/src/assets/lambda-pricing-by-memory.json` - Lambda pricing by memory tier
- `web/src/utils/calculator.js` - Instance types, savings plans, workload profiles

### Adding New Features

1. **Update calculation logic** in `web/src/utils/calculator.js`
2. **Update UI components** as needed
3. **Add tests** in `tests/calculator.test.js`
4. **Update documentation** in `docs/`

### Running the Application

**Development mode:**
```bash
cd web
npm install
npm run dev
```

**Production build:**
```bash
cd web
npm run build
npm run preview  # Preview production build
```

**Run tests:**
```bash
cd tests
npm test
```

## Deployment

### GitHub Pages
The application is configured for automatic deployment to GitHub Pages.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy:
```bash
./PUSH_TO_GITHUB.sh
```

Or manually:
```bash
git add .
git commit -m "Update calculator"
git push origin main
```

The GitHub Actions workflow will automatically build and deploy to:
**https://debongithub.github.io/lmi-cost-calculator/**

### Static Hosting
The application is a static site and can be deployed to:
- AWS S3 + CloudFront
- GitLab Pages
- Netlify
- Vercel
- Any static hosting service

### Build Output
After running `npm run build`, the `web/dist/` folder contains:
- `index.html` - Main HTML file
- `assets/` - Bundled JS, CSS, and images
- All assets are hashed for cache busting

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

**Dependencies not installing:**
```bash
cd web
rm -rf node_modules package-lock.json
npm install
```

**Build fails:**
```bash
# Clear Vite cache
cd web
rm -rf node_modules/.vite
npm run build
```

## License

Internal AWS tool for Lambda Managed Instances cost estimation.

## References

- [AWS Lambda Managed Instances Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [AWS EC2 Pricing](https://aws.amazon.com/ec2/pricing/on-demand/)
- [Launch Blog Post](https://aws.amazon.com/blogs/aws/introducing-aws-lambda-managed-instances-serverless-simplicity-with-ec2-flexibility/)
