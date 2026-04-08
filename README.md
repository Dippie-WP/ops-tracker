# OPS TRACKER

A mission-control style operations tracker with priorities, planned dates, op IDs, and file attachments.

---

## Quick Start

### Docker (recommended)
```bash
docker compose up -d
# → http://localhost:3000
```
Your data (SQLite DB + uploaded files) lives in a named Docker volume `ops_data` and survives container rebuilds and upgrades.

```bash
# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Stop and wipe all data (destructive!)
docker compose down -v
```

### Local Node.js
```bash
npm install
npm start        # production
npm run dev      # auto-restart on file changes (Node 18+)
```

---

## GitHub Setup

### First push
```bash
git init
git add .
git commit -m "feat: initial ops tracker"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/ops-tracker.git
git branch -M main
git push -u origin main
```

### Versioning with tags
The release workflow publishes a Docker image to GitHub Container Registry (GHCR) whenever you push a version tag.

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers `.github/workflows/release.yml` which:
1. Builds and pushes the image to `ghcr.io/YOUR_USERNAME/ops-tracker:1.0.0`
2. Also tags it `:latest`
3. Creates a GitHub Release with auto-generated notes

### Pull from GHCR on another machine
```bash
docker pull ghcr.io/YOUR_USERNAME/ops-tracker:latest
```

Update `docker-compose.yml` to use the published image instead of building:
```yaml
services:
  ops-tracker:
    image: ghcr.io/YOUR_USERNAME/ops-tracker:latest
    # remove the "build: ." line
```

---

## CI / CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | Every push / PR | Syntax check + Docker build smoke test |
| `release.yml` | `git push tag v*.*.*` | Build, push to GHCR, create GitHub Release |

---

## Project Structure

```
ops-tracker/
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── server/
│   ├── index.js           # Express entry point
│   ├── db.js              # SQLite — single source of truth
│   └── routes/
│       ├── ops.js
│       └── attachments.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js         # All HTTP calls live here only
│       └── app.js         # UI state machine
├── Dockerfile
├── docker-compose.yml
└── data/                  # Auto-created, gitignored
    ├── ops.db
    └── uploads/
```

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/ops | List all ops |
| GET    | /api/ops/stats | Dashboard stats |
| GET    | /api/ops/:opId | Get op + attachments |
| POST   | /api/ops | Create op |
| PATCH  | /api/ops/:opId | Update op |
| DELETE | /api/ops/:opId | Delete op + attachments |
| POST   | /api/ops/:opId/attachments | Upload file |
| GET    | /api/ops/:opId/attachments/:id/download | Download file |
| DELETE | /api/ops/:opId/attachments/:id | Delete attachment |

---

## Adding Features Without Breaking Things

Paste this to your AI before each new feature:

```
Follow the ops-tracker architecture rules:
1. Schema changes → db.js only (CREATE TABLE block + new prepared statements)
2. New endpoints → new file in server/routes/, register in server/index.js
3. New API calls → api.js only. Never call fetch() directly from app.js
4. New UI state → add fields to the state object at top of app.js
5. Never mutate `state` directly — always use setState(patch)
6. After any data change call refresh() to re-sync from the DB
```
