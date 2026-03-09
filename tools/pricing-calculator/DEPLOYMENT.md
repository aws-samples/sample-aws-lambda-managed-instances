# Deployment Guide - GitHub Pages

This guide will help you deploy the LMI Cost Calculator to GitHub Pages.

## Prerequisites

- GitHub account
- Git installed locally
- Repository: https://github.com/debongithub/lmi-cost-calculator.git

## Step 1: Push Code to GitHub

From the `CostCalculator_New` directory, run these commands:

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit: LMI Cost Calculator"

# Add remote (only needed first time)
git remote add origin https://github.com/debongithub/lmi-cost-calculator.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 2: Enable GitHub Pages

1. Go to your repository: https://github.com/debongithub/lmi-cost-calculator
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - Source: Select **GitHub Actions**
5. Click **Save**

## Step 3: Automatic Deployment

The GitHub Actions workflow will automatically:
1. Detect the push to main branch
2. Install dependencies
3. Build the application
4. Deploy to GitHub Pages

You can monitor the deployment:
1. Go to the **Actions** tab in your repository
2. Watch the "Deploy to GitHub Pages" workflow
3. Wait for it to complete (usually 2-3 minutes)

## Step 4: Access Your Site

Once deployed, your site will be available at:

**https://debongithub.github.io/lmi-cost-calculator/**

## Troubleshooting

### Deployment fails

Check the Actions tab for error messages. Common issues:

**Build errors:**
```bash
# Test build locally first
cd web
npm install
npm run build
```

**Permission errors:**
- Go to Settings > Actions > General
- Under "Workflow permissions", select "Read and write permissions"
- Click Save

### Site shows 404

1. Check that GitHub Pages is enabled in Settings > Pages
2. Verify the workflow completed successfully in Actions tab
3. Wait a few minutes for DNS propagation

### Assets not loading

This is usually a base path issue. The `vite.config.js` is already configured with:
```javascript
base: '/lmi-cost-calculator/'
```

If you rename the repository, update this value to match.

## Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Build the application
cd web
npm install
npm run build

# The dist folder contains your built site
# You can deploy this folder to any static hosting service
```

## Updating the Site

To update the deployed site:

```bash
# Make your changes
# Then commit and push
git add .
git commit -m "Update: description of changes"
git push origin main
```

The GitHub Actions workflow will automatically rebuild and redeploy.

## Configuration

### Change Repository Name

If you rename the repository, update:

1. `web/vite.config.js`:
```javascript
base: '/new-repo-name/'
```

2. Push changes and redeploy

### Custom Domain

To use a custom domain:

1. Add a `CNAME` file to `web/public/` with your domain:
```
calculator.yourdomain.com
```

2. In GitHub Settings > Pages, add your custom domain
3. Configure DNS with your domain provider

## GitHub Actions Workflow

The workflow (`.github/workflows/deploy.yml`) runs on:
- Every push to `main` branch
- Manual trigger from Actions tab

It performs:
1. Checkout code
2. Setup Node.js 18
3. Install dependencies (`npm ci`)
4. Build application (`npm run build`)
5. Deploy to GitHub Pages

## Local Testing

Before pushing, test locally:

```bash
cd web
npm install
npm run build
npm run preview
```

Visit `http://localhost:4173` to preview the production build.

## Monitoring

Monitor your deployments:
- **Actions tab**: See build/deploy status
- **Environments**: See deployment history
- **Settings > Pages**: See current deployment URL

## Rollback

To rollback to a previous version:

1. Go to Actions tab
2. Find the successful deployment you want to restore
3. Click "Re-run all jobs"

Or use git:
```bash
git revert HEAD
git push origin main
```

## Support

- GitHub Pages docs: https://docs.github.com/en/pages
- GitHub Actions docs: https://docs.github.com/en/actions
- Vite deployment guide: https://vitejs.dev/guide/static-deploy.html

## Security

The application:
- ✅ Is a static site (no backend)
- ✅ Runs entirely in the browser
- ✅ Contains no secrets or API keys
- ✅ Uses official AWS pricing data
- ✅ Safe to deploy publicly

## Performance

Expected performance:
- Build time: 1-2 minutes
- Deploy time: 1-2 minutes
- Page load: < 1 second
- Bundle size: ~200 KB (gzipped)

## Next Steps

After deployment:
1. Test the live site thoroughly
2. Share the URL with your team
3. Monitor usage via GitHub Insights
4. Update pricing data as needed
