# Publishing Guide: Node.js SDK v0.5.0

## Pre-Publishing Checklist

✅ Version bumped to 0.5.0 in package.json
✅ CHANGELOG.md updated with v0.5.0 release notes
✅ README.md updated with alerts examples
✅ All tests passing (43/43)
✅ TypeScript compilation successful
✅ Code committed and pushed to GitHub

## Publishing to npm

### Step 1: Verify npm Authentication

```bash
npm whoami
# Should show: oilpriceapi (or your npm username)
```

If not logged in:
```bash
npm login
```

### Step 2: Run Final Checks

```bash
# Ensure clean working directory
git status

# Run tests one more time
npm test

# Build production bundle
npm run build

# Check what will be published
npm pack --dry-run
```

### Step 3: Publish to npm

```bash
# Publish to npm registry
npm publish

# Expected output:
# + oilpriceapi@0.5.0
```

### Step 4: Verify Publication

```bash
# Check npm registry
npm view oilpriceapi

# Install in test project
mkdir /tmp/test-npm-install
cd /tmp/test-npm-install
npm init -y
npm install oilpriceapi@0.5.0

# Verify version
npm list oilpriceapi
```

### Step 5: Tag Release on GitHub

```bash
git tag -a v0.5.0 -m "Release v0.5.0: Price Alerts Support"
git push origin v0.5.0
```

### Step 6: Create GitHub Release

Go to: https://github.com/OilpriceAPI/oilpriceapi-node/releases/new

- Tag: v0.5.0
- Title: v0.5.0 - Price Alerts Support
- Description: Copy from CHANGELOG.md v0.5.0 section
- Attach: None needed (published to npm)

## Post-Publishing

### Update Documentation Website

```bash
# If you have a docs deployment script
npm run deploy:docs
```

### Announce Release

1. **Twitter/X**:
   ```
   🚀 OilPriceAPI Node.js SDK v0.5.0 is now live!

   New: Price Alerts 🔔
   • Monitor commodity prices 24/7
   • Webhook notifications
   • 5 comparison operators
   • Alert cooldown periods

   npm install oilpriceapi@0.5.0

   Docs: https://docs.oilpriceapi.com/sdk/nodejs
   ```

2. **Reddit** (r/node, r/javascript):
   - Title: "OilPriceAPI Node.js SDK v0.5.0: Price Alerts Feature"
   - Link to GitHub release

3. **Email to Users**:
   - Subject: "New Feature: Price Alerts Now Available"
   - Highlight webhook notifications and automation

## Troubleshooting

### "You do not have permission to publish"
- Verify npm account has publish rights to @oilpriceapi scope
- Check npm organization membership

### "Version already published"
- Version 0.5.0 already exists on npm
- Bump to 0.5.1 if you need to republish

### "Invalid package.json"
- Run `npm pack --dry-run` to check package contents
- Verify all required fields present

## Quick Publish Command

```bash
# One-liner (use with caution)
npm test && npm run build && npm publish && git tag -a v0.5.0 -m "Release v0.5.0" && git push origin v0.5.0
```

## Rollback (If Needed)

```bash
# Deprecate version (don't unpublish)
npm deprecate oilpriceapi@0.5.0 "This version has issues, use 0.5.1"

# Publish fixed version
npm version patch  # Bumps to 0.5.1
npm publish
```

## Success Indicators

✅ Package appears on npm: https://www.npmjs.com/package/oilpriceapi
✅ Version 0.5.0 listed in versions tab
✅ `npm install oilpriceapi@0.5.0` works globally
✅ GitHub release created
✅ Git tag pushed
✅ Downloads counter incrementing

---

**Ready to publish!** 🚀

Run: `npm publish`
