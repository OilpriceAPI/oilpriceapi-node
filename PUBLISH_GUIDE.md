# Publishing Guide: Node.js SDK

## Automated Publishing (Recommended)

Publishing is now automated via GitHub Actions. Simply:

1. Update version in `package.json` and `src/version.ts`
2. Update `CHANGELOG.md`
3. Commit and push to `main`
4. Create a GitHub Release with the version tag

The `.github/workflows/publish.yml` workflow will:

- Run tests
- Build ESM + CJS
- Publish to npm with provenance

## Manual Publishing

### Pre-Publishing Checklist

- [ ] Version bumped in `package.json` and `src/version.ts`
- [ ] CHANGELOG.md updated
- [ ] All tests passing (185+)
- [ ] TypeScript compilation successful
- [ ] ESLint passes (`npm run lint`)

### Steps

```bash
# 1. Verify clean state
git status
npm test
npm run lint
npm run build

# 2. Check package contents
npm pack --dry-run

# 3. Publish
npm publish

# 4. Tag and push
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z

# 5. Create GitHub Release at:
# https://github.com/OilpriceAPI/oilpriceapi-node/releases/new
```

### Verify

```bash
npm view oilpriceapi versions
npm install oilpriceapi@latest
```

## Rollback

```bash
npm deprecate oilpriceapi@X.Y.Z "Use X.Y.Z+1 instead"
```
