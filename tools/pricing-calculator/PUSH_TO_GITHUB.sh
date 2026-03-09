#!/bin/bash

# Script to push LMI Cost Calculator to GitHub
# Repository: https://github.com/debongithub/lmi-cost-calculator.git

echo "🚀 Pushing LMI Cost Calculator to GitHub..."
echo ""

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo "❌ Error: Please run this script from the CostCalculator_New directory"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Add all files
echo "📝 Adding files..."
git add .

# Show status
echo ""
echo "📊 Git status:"
git status --short

# Commit
echo ""
echo "💾 Committing files..."
git commit -m "Initial commit: AWS Lambda Managed Instances Cost Calculator

- Complete React web application
- Cost comparison across Standard Lambda, LMI, and Self-Managed EC2
- Support for multiple workload profiles and instance types
- Comprehensive test suite
- GitHub Pages deployment configuration"

# Check if remote exists
if git remote | grep -q "origin"; then
    echo "🔗 Remote 'origin' already exists"
else
    echo "🔗 Adding remote repository..."
    git remote add origin https://github.com/debongithub/lmi-cost-calculator.git
fi

# Set main branch
echo "🌿 Setting main branch..."
git branch -M main

# Push to GitHub
echo ""
echo "⬆️  Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Your code has been pushed to GitHub."
echo ""
echo "📍 Next steps:"
echo "1. Go to: https://github.com/debongithub/lmi-cost-calculator"
echo "2. Click Settings > Pages"
echo "3. Under 'Build and deployment', select 'GitHub Actions'"
echo "4. Wait 2-3 minutes for deployment"
echo "5. Visit: https://debongithub.github.io/lmi-cost-calculator/"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
