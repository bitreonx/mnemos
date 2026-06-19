# Mnemos Release Codenames

Semver lives in `package.json` for npm only. **Code and CLI use codenames**, not "v2/v3".

## Product releases

| Semver | Codename | Meaning |
|--------|----------|---------|
| **0.2.0** | **Mneme** | The atomic unit of codebase memory — one build, one truth |
| **0.3.0** | **Mneme · Ariadne's Thread** | Navigate the **Labyrinth** — local hybrid memory on-device |

## Engine & contracts

| Component | Codename | Schema ID |
|-----------|----------|-----------|
| Memory Engine | **Labyrinth** | `mnemos/memory-engine/labyrinth` |
| Shared shards | **Constellation** | `mnemos/shared-memory/constellation` |
| AI Pack | **Cartograph** | `mnemos/ai-pack/cartograph` (semver 1.0.0) |

## Roadmap (aspirational)

| Codename | Target |
|----------|--------|
| **Oracle** | Next memory engine generation |
| **Palimpsest** | Next product release |

## Legacy schema IDs (still accepted on load)

- `mnemos/memory-engine/v2`, `mnemos/memory-engine/v3` → **Labyrinth**
- `mnemos/shared-memory/v1` → **Constellation**

## CLI

```bash
mnemos doctor              # shows Mneme 0.3.0 + Labyrinth engine stats
mnemos memory trust        # honest trust manifest
mnemos memory engine       # Labyrinth status
```
