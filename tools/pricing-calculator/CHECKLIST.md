# Deployment Checklist

Follow these steps to deploy the LMI Cost Calculator to GitHub Pages.

## ✅ Pre-Deployment Checklist

- [x] Code is in `CostCalculator_New` folder
- [x] `.gitignore` configured for web project
- [x] `vite.config.js` configured with correct base path
- [x] GitHub Actions workflow created
- [x] README updated with GitHub Pages URL
- [x] Deployment documentation created

## 📋 Deployment Steps

### Step 1: Test Locally (Optional but Recommended)

```bash
cd CostCalculator_New/web
npm install
npm run build
npm run preview
```

Visit `http://localhost:4173` to verify everything works.

### Step 2: Push to GitHub

**Option A: Use the script (Easiest)**
```bash
cd CostCalculator_New
./PUSH_TO_GITHUB.sh
```

**Option B: Manual commands**
```bash
cd CostCalculator_New
git add .
git commit -m "Initial commit: LMI Cost Calculator"
git remote add origin https://github.com/debongithub/lmi-cost-calculator.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to: https://github.com/debongithub/lmi-cost-calculator
2. Click **Settings** (top navigation)
3. Click **Pages** (left sidebar)
4. Under "Build and deployment":
   - Source: Select **GitHub Actions**
5. Click **Save**

### Step 4: Monitor Deployment

1. Go to **Actions** tab: https://github.com/debongithub/lmi-cost-calculator/actions
2. Watch the "Deploy to GitHub Pages" workflow
3. Wait for green checkmark (2-3 minutes)

### Step 5: Verify Deployment

Visit: **https://debongithub.github.io/lmi-cost-calculator/**

Test the calculator:
- [ ] Form loads correctly
- [ ] Can enter values
- [ ] Calculate button works
- [ ] Results display properly
- [ ] Chart renders
- [ ] Methodology panel expands
- [ ] Key assumptions panel works
- [ ] Mobile responsive (test on phone)

## 🔧 Troubleshooting

### If deployment fails:

1. Check Actions tab for error messages
2. Verify Settings > Actions > General > Workflow permissions is set to "Read and write"
3. Check that all files were pushed: `git status`

### If site shows 404:

1. Wait 5 minutes (DNS propagation)
2. Check Settings > Pages shows the correct URL
3. Verify workflow completed successfully

### If assets don't load:

1. Check browser console for errors
2. Verify `vite.config.js` has correct base path: `/lmi-cost-calculator/`
3. Clear browser cache and reload

## 📝 Post-Deployment

- [ ] Share URL with team
- [ ] Test all features thoroughly
- [ ] Bookmark the live site
- [ ] Document any issues
- [ ] Plan for future updates

## 🔄 Future Updates

To update the site:

```bash
cd CostCalculator_New
# Make your changes
git add .
git commit -m "Update: description"
git push origin main
```

GitHub Actions will automatically rebuild and redeploy.

## 📊 Monitoring

Monitor your deployment:
- **Live site**: https://debongithub.github.io/lmi-cost-calculator/
- **Repository**: https://github.com/debongithub/lmi-cost-calculator
- **Actions**: https://github.com/debongithub/lmi-cost-calculator/actions
- **Settings**: https://github.com/debongithub/lmi-cost-calculator/settings/pages

## 🎯 Success Criteria

Deployment is successful when:
- ✅ Site loads at https://debongithub.github.io/lmi-cost-calculator/
- ✅ All features work correctly
- ✅ No console errors
- ✅ Mobile responsive
- ✅ Fast load time (< 2 seconds)

## 📚 Documentation

- [README.md](README.md) - Main documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [QUICKSTART.md](QUICKSTART.md) - Local development guide
- [PACKAGE_CONTENTS.md](PACKAGE_CONTENTS.md) - What's included

## 🆘 Need Help?

1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
2. Review GitHub Actions logs for errors
3. Verify all configuration files are correct
4. Test locally first with `npm run build && npm run preview`

## ⚠️ Important Notes

- **No GitLab**: This project uses GitHub, not GitLab
- **Branch name**: Use `main` (not `master`)
- **Base path**: Must match repository name in `vite.config.js`
- **Node version**: Requires Node.js 18+
- **Build time**: First deployment takes 2-3 minutes

## 🎉 You're Done!

Once deployed, your calculator will be live at:
**https://debongithub.github.io/lmi-cost-calculator/**

Share it with your team and start calculating LMI costs!
