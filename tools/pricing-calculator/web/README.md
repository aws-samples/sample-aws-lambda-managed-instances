# LMI Cost Calculator - Web Application

A React-based Single Page Application (SPA) for calculating AWS Lambda Managed Instances costs and capacity planning.

## Features

- Interactive form for configuring workload parameters
- Real-time cost comparison between LMI and Standard Lambda
- **Cost comparison chart** showing costs across different request volumes (1M, 10M, 50M requests/month)
- **Multiple savings plan comparisons** including Standard Lambda, LMI On-Demand, 1yr Compute SP, 1yr EC2 SP, and 3yr RI
- Capacity planning with detailed breakdown
- Support for multiple instance types and savings plans
- Responsive design for mobile and desktop

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Deployment

This application is configured for GitLab Pages deployment. When you push to the main branch, GitLab CI/CD will automatically:

1. Install dependencies
2. Build the production bundle
3. Deploy to GitLab Pages

The site will be available at: `https://<username>.gitlab.io/<project-name>/`

## Technology Stack

- React 19
- Vite 7
- Vanilla CSS (no framework dependencies)
- GitLab Pages for hosting

## Project Structure

```
web/
├── src/
│   ├── components/
│   │   ├── CalculatorForm.jsx    # Input form component
│   │   ├── CalculatorForm.css
│   │   ├── CostComparisonChart.jsx # Cost comparison chart component
│   │   ├── CostComparisonChart.css
│   │   ├── Results.jsx            # Results display component
│   │   └── Results.css
│   ├── utils/
│   │   └── calculator.js          # Core calculation logic (ported from Python)
│   ├── App.jsx                    # Main app component
│   ├── App.css
│   ├── main.jsx                   # Entry point
│   └── index.css                  # Global styles
├── public/                        # Static assets
├── index.html                     # HTML template
├── vite.config.js                 # Vite configuration
└── package.json                   # Dependencies
```

## Calculator Logic

The calculator implements the same capacity formula as the Python CLI tool:

1. Compute concurrency per vCPU (runtime limit vs memory constraint)
2. Calculate function memory allocation
3. Determine vCPUs per execution environment
4. Calculate environments needed for target concurrency
5. Compute instance packing efficiency
6. Calculate total instances required (minimum 3 for AZ resiliency)
7. Compare costs: LMI vs Standard Lambda

## Customization

To modify the base path for deployment (if your GitLab project name differs):

Edit `vite.config.js`:
```javascript
base: process.env.CI ? '/your-project-name/' : '/',
```

## License

Same as parent project.
