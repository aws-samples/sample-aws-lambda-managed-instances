# Quick Start Guide

Get the LMI Cost Calculator web app running in 3 minutes.

## 1. Install Dependencies

```bash
cd web
npm install
```

## 2. Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

## 3. Try It Out

The calculator comes with default values. Just click **Calculate** to see results!

### Example Scenarios

**High-Volume Python API:**
- Runtime: Python
- Target Concurrency: 100
- Memory per Exec: 500 MB
- Instance Type: c7g.xlarge
- Monthly Requests: 10,000,000

**Java Microservice:**
- Runtime: Java
- Target Concurrency: 500
- Memory per Exec: 256 MB
- Instance Type: m7g.xlarge
- Monthly Requests: 50,000,000

**Node.js Event Processor:**
- Runtime: Node.js
- Target Concurrency: 1000
- Memory per Exec: 128 MB
- Instance Type: c7g.2xlarge
- Monthly Requests: 100,000,000

## Understanding the Results

### Capacity Plan
Shows how many instances and execution environments you need:
- **Instances Needed**: Total EC2 instances (minimum 3 for AZ resiliency)
- **Environments per Instance**: How many execution environments fit per instance
- **Concurrency per Environment**: Max concurrent invocations per environment

### Cost Comparison
Side-by-side comparison of:
- **LMI Cost**: EC2 + Management Fee (15%) + Requests
- **Standard Lambda Cost**: Compute (GB-seconds) + Requests

### Savings Summary
Shows whether LMI is cheaper and by how much.

## Tips

1. **Start with defaults** - Click Calculate to see baseline results
2. **Try different instance types** - Larger instances may pack more efficiently
3. **Compare savings plans** - 3-year Reserved Instances offer up to 62% discount
4. **Adjust memory-to-vCPU ratio** - Match your workload type:
   - 2:1 for CPU-intensive (compute optimized)
   - 4:1 for balanced workloads (general purpose)
   - 8:1 for memory-intensive (memory optimized)

## Building for Production

```bash
npm run build
```

Output goes to `dist/` folder - ready to deploy anywhere!

## Need Help?

- Check the main [README.md](README.md) for full documentation
- See [DEPLOYMENT.md](../DEPLOYMENT.md) for GitLab Pages setup
- Review the Python CLI tool for detailed capacity formula explanation
