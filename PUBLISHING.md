# Publishing Guide

This document explains how to publish Mnemos packages to npm and PyPI.

## Setup (One-time)

### 1. Create npm Account & Token

1. Go to [npmjs.com](https://www.npmjs.com/) and create an account
2. Go to your profile → Access Tokens → Generate New Token
3. Choose "Automation" token type
4. Copy the token

### 2. Add npm Token to GitHub Secrets

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: paste your npm token
5. Click "Add secret"

### 3. Verify PyPI Token (already exists)

The `PYPI_API_TOKEN` secret should already be configured for Python publishing.

## Publishing a New Version

### Step 1: Update Version Numbers

Update the version in these files to match (e.g., `0.3.0` → `0.3.1`):

```bash
# Root package
packages/cli/package.json
packages/core/package.json
packages/pypi/pyproject.toml
package.json (root)
```

### Step 2: Commit Version Bump

```bash
git add -A
git commit -m "chore: bump version to v0.3.1"
git push
```

### Step 3: Create and Push Tag

```bash
# Create annotated tag
git tag -a v0.3.1 -m "Release v0.3.1 - Ariadne's Thread"

# Push tag to trigger workflows
git push origin v0.3.1
```

### Step 4: Monitor Workflows

Go to your GitHub repo → Actions and watch:

- ✅ **publish-npm** - Publishes `@mnemos/cli` and `@mnemos/core` to npm
- ✅ **publish-pypi** - Builds binaries and publishes Python package to PyPI

Both workflows run automatically when you push a version tag.

## Manual Publishing (Emergency)

If you need to publish manually:

### npm

```bash
# Make sure packages are built
npm run build

# Publish from packages/core
cd packages/core
npm publish --access public

# Publish from packages/cli
cd ../cli
npm publish --access public
```

### PyPI

Follow the existing workflow in `.github/workflows/publish-pypi.yml`

## Verification

After publishing, verify the packages are live:

```bash
# Check npm
npm view @mnemos/cli
npm view @mnemos/core

# Test installation
npm install -g @mnemos/cli@latest
mnemos --version

# Check PyPI
pip show mnemos-cli
```

## Troubleshooting

### "npm publish" fails with 403

- Check that `NPM_TOKEN` secret is set correctly
- Verify you have publish permissions for the `@mnemos` scope
- Try `npm login` manually to test authentication

### Version already exists

npm doesn't allow republishing the same version. Bump the version number and try again.

### Tag already exists

If you need to re-tag:

```bash
git tag -d v0.3.1           # Delete local tag
git push origin :v0.3.1     # Delete remote tag
git tag -a v0.3.1 -m "..."  # Create new tag
git push origin v0.3.1      # Push new tag
```

## Release Checklist

- [ ] All tests passing
- [ ] Version numbers updated in all package.json files
- [ ] CHANGELOG.md updated with release notes
- [ ] Git tag created with version number
- [ ] GitHub Actions workflows completed successfully
- [ ] Packages verified on npm and PyPI
- [ ] Installation tested with fresh install
- [ ] GitHub release created with release notes
