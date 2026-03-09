# Quick Start Guide

Get the AWS Lambda Managed Instances Cost Calculator running in 3 minutes.

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

Check your versions:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

## Installation

1. Navigate to the web directory:
```bash
cd web
```

2. Install dependencies:
```bash
npm install
```

This will install:
- React 18
- Vite (build tool)
- ESLint (code quality)

## Run Development Server

```bash
npm run dev
```

The application will start at: `http://localhost:5173`

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Using the Calculator

1. **Select Runtime** - Choose Node.js, Java, .NET, or Python
2. **Enter Workload Parameters:**
   - Target Concurrency (e.g., 100)
   - Memory per Execution (e.g., 500 MB)
   - Monthly Requests (e.g., 10,000,000)
   - Average Duration (e.g., 60 seconds)
3. **Choose Workload Profile** - IO-Heavy, Balanced, or CPU-Heavy
4. **Select Instance Type** - c7g.xlarge, m7g.xlarge, etc.
5. **Click Calculate**

The calculator will show:
- Cost comparison table (Standard Lambda, LMI, Self-Managed EC2)
- Visual cost chart
- Detailed calculation breakdown
- Capacity planning details

## Build for Production

```bash
npm run build
```

Output will be in `web/dist/` directory.

Preview the production build:
```bash
npm run preview
```

## Run Tests

```bash
cd tests
npm test
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Troubleshooting

### Port 5173 already in use
```bash
# Kill the process
lsof -ti:5173 | xargs kill -9
```

### Dependencies won't install
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run build
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [docs/CALCULATOR_METHODOLOGY.md](docs/CALCULATOR_METHODOLOGY.md) for calculation details
- Review [tests/test-cases.json](tests/test-cases.json) for example scenarios

## Project Structure

```
CostCalculator_New/
├── web/                    # Main application
│   ├── src/               # Source code
│   │   ├── components/    # React components
│   │   ├── utils/         # Calculation logic
│   │   └── assets/        # Pricing data & images
│   └── package.json       # Dependencies
├── tests/                 # Test suite
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Support

For issues or questions:
1. Check [README.md](README.md) for detailed documentation
2. Review [docs/CALCULATOR_METHODOLOGY.md](docs/CALCULATOR_METHODOLOGY.md)
3. Check AWS Lambda Managed Instances [official documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html)
