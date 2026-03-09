# Package Contents

This package contains the complete AWS Lambda Managed Instances Cost Calculator application.

## What's Included

### 📱 Web Application (`web/`)
Complete React-based web application with:
- Interactive cost calculator form
- Real-time calculations
- Visual cost comparison charts
- Detailed methodology breakdown
- Responsive mobile-friendly design

**Key Files:**
- `src/utils/calculator.js` - Core calculation engine
- `src/components/` - React UI components
- `src/assets/lambda-pricing-by-memory.json` - Official AWS pricing data
- `package.json` - Dependencies and scripts
- `vite.config.js` - Build configuration

### 🧪 Test Suite (`tests/`)
Comprehensive test coverage:
- 10 test scenarios
- JSON-based test cases
- Validates all calculation logic

**Files:**
- `calculator.test.js` - Test suite
- `test-cases.json` - Test data

### 📚 Documentation (`docs/`)
Detailed methodology and reference:
- `CALCULATOR_METHODOLOGY.md` - Complete calculation logic explanation

### 🛠️ Utilities (`scripts/`)
Helper scripts:
- `extract-pricing.js` - Extract pricing from AWS pricing JSON

### 📖 Guides
- `README.md` - Complete documentation
- `QUICKSTART.md` - Get started in 3 minutes
- `PACKAGE_CONTENTS.md` - This file

## File Count Summary

```
Total Files: ~50+ source files
- React Components: 4
- Utility Modules: 1
- Test Files: 2
- Documentation: 4
- Configuration: 5
- Assets: 3
```

## Dependencies

### Production
- React 18.3.1
- React DOM 18.3.1

### Development
- Vite 6.0.11 (build tool)
- ESLint 9.17.0 (code quality)
- Various plugins and tools

Total package size: ~150 MB (including node_modules)
Built application size: ~200 KB (gzipped)

## Features Included

### Cost Comparison
✅ Standard Lambda pricing
✅ Lambda Managed Instances pricing
✅ Self-Managed EC2 pricing
✅ All savings plan variants

### Workload Profiles
✅ IO-Heavy (Proxy/Queue)
✅ Balanced (Mixed)
✅ CPU-Heavy (Compute)

### Instance Types
✅ Compute Optimized (c7g family)
✅ General Purpose (m7g family)
✅ Memory Optimized (r7g family)

### Runtimes
✅ Node.js (64 concurrent/vCPU)
✅ Java (32 concurrent/vCPU)
✅ .NET (32 concurrent/vCPU)
✅ Python (16 concurrent/vCPU)

### Pricing Options
✅ On-Demand
✅ Compute Savings Plan (1yr, 3yr)
✅ EC2 Instance Savings Plan
✅ Reserved Instances (3yr)

### Advanced Features
✅ AZ resilience configuration (3-AZ, 5-AZ)
✅ Memory-to-vCPU ratio selection
✅ Architecture selection (ARM64, x86_64)
✅ Advanced overrides for fine-tuning
✅ Visual cost comparison chart
✅ Detailed calculation methodology
✅ Mobile-responsive design

## Not Included

❌ Backend server (static application only)
❌ Database (all calculations client-side)
❌ User authentication
❌ Data persistence (no save/load)
❌ API integrations
❌ Real-time AWS pricing updates (uses static pricing data)

## System Requirements

### Development
- Node.js 18+
- npm 8+
- 200 MB disk space
- Modern web browser

### Production (Deployment)
- Static web hosting
- HTTPS recommended
- No server-side requirements

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Getting Started

1. Read [QUICKSTART.md](QUICKSTART.md) for immediate setup
2. Review [README.md](README.md) for full documentation
3. Check [docs/CALCULATOR_METHODOLOGY.md](docs/CALCULATOR_METHODOLOGY.md) for calculation details

## Updates and Maintenance

### Pricing Updates
To update Lambda pricing:
1. Update `web/src/assets/lambda-pricing-by-memory.json`
2. Rebuild the application

### Instance Types
To add new instance types:
1. Update `INSTANCE_TYPES` in `web/src/utils/calculator.js`
2. Add pricing information
3. Rebuild and test

### Savings Plans
To update savings plan discounts:
1. Update `SAVINGS_PLANS` in `web/src/utils/calculator.js`
2. Rebuild and test

## License

Internal AWS tool for Lambda Managed Instances cost estimation.

## Version

Version: 2.0
Last Updated: March 1, 2026
Region: us-east-1
