# Versioning — ops-tracker

## Semantic Versioning (semver)

Format: `vMAJOR.MINOR.PATCH` — e.g. v1.2.0

| Part | When to increment | Example |
|------|-------------------|---------|
| **PATCH** | Bug fixes, CSS tweaks, small UI fixes | v1.2.0 → v1.2.1 |
| **MINOR** | New features, new fields, functional additions | v1.2.0 → v1.3.0 |
| **MAJOR** | Breaking changes, restructuring, rewrites | v1.2.0 → v2.0.0 |

---

## Release Process

1. **Propose** — I suggest the next version number (confirm with team first)
2. **Update** — I bump `package.json` version and footer in `index.html`
3. **Push** — I push to `main` branch
4. **CI** — GitHub Actions CI workflow runs smoke test → must pass
5. **Tag** — You push the tag → Release workflow fires

---

## Version in Code

Two places must stay in sync:

- `package.json` → `"version": "x.y.z"`
- `public/index.html` → footer: `DAT-OPS-OP-001 | vX.Y`

---

## Current Baseline

- **v1.2.0** — baseline release (floating +NEW OP, division field, drawer perf, corporate theme)
