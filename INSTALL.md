# Installing Get Mnemos

**Website:** [getmnemos.vercel.app](https://getmnemos.vercel.app)  
**GitHub:** [github.com/bitreonx/mnemos](https://github.com/bitreonx/mnemos)

## One command. One name. No guessing.

```bash
npx getmnemos .
```

The npm package is **`getmnemos`**. The command you type is the promise you get.

| Wrong | Right |
|-------|-------|
| `npm install mnemos` | `npm install -g getmnemos` |
| `npm install @mnemos/cli` | `npx getmnemos .` |
| `npm install mnemos-cli` (npm) | `pip install getmnemos` |

After install, both `getmnemos` and `mnemos` work.

---

## Node.js (recommended)

Requires **Node 20+**.

```bash
npx getmnemos .
npm install -g getmnemos
npm install -D getmnemos   # in your project
```

## Beast mode + security

```bash
getmnemos supernova .   # tours, layers, personas, AI pack — all fire
getmnemos audit .       # npm audit → .mnemos/security-audit.json
```

## Python

```bash
pip install getmnemos
mnemos .
```

## Verify

```bash
getmnemos --version
```

## Dabt `@dabt/shared` 404?

That error is from the **Dabt monorepo**, not Mnemos. Link or publish `@dabt/shared` first, then:

```bash
npm install -D getmnemos
```
