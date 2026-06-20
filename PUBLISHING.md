# Publishing Get Mnemos

Package: **`getmnemos`** on npm and PyPI  
Site: **https://getmnemos.vercel.app**

## npm trusted publishing (recommended)

1. On npmjs.com → package `getmnemos` → **Publishing** → enable **Trusted Publishers** → GitHub `bitreonx/mnemos`
2. Push tag `v0.3.0` — CI uses OIDC (`id-token: write`) + `--provenance`
3. Optional: keep `NPM_TOKEN` as fallback in GitHub secrets

```bash
npm run build --workspace @mnemos/core
npm run prepare:publish --workspace getmnemos
cd packages/cli && npm publish --access public --provenance
node scripts/strip-publish-deps.mjs restore
```

## PyPI

Tag push → `.github/workflows/publish-pypi.yml` (needs `PYPI_API_TOKEN`)

```bash
pip install getmnemos
```

## Customer one-liner

```bash
npx getmnemos .
```
