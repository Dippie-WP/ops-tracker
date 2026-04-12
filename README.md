# OPS TRACKER

A mission-control operations tracker with sub-task hierarchy, priority management, cost tracking in ZAR, file attachments, and full activity logging.

**Stack:** Node.js + SQLite + React 18 (Zustand)  
**Live:** http://192.168.20.10:5050

---

## Architecture

```
ops-tracker/
├── server/
│   ├── index.js          # Express entry point
│   ├── db.js             # SQLite schema + all queries
│   └── routes/
│       ├── ops.js        # CRUD + children + activity
│       └── attachments.js
├── ops-tracker-react/   # React frontend (separate repo)
│   ├── src/
│   │   ├── api/client.js
│   │   ├── store/index.js    # Zustand store
│   │   └── components/
│   │       ├── Drawer/
│   │       ├── Modal/
│   │       └── TaskTable/
│   └── sync.sh          # Build + hash-verified deploy to Pi
└── data/                # SQLite DB + uploads (auto-created)
```

---

## Features

### Sub-task Hierarchy
- Tasks can have child sub-tasks (depth = 1)
- Parent tasks show teal badge with child count
- Child tasks show "Parent OP" in metadata
- Parent close/cancel blocked if child is `in_progress`, `standby`, or `overdue`

### Task Fields
| Field | Type | Notes |
|-------|------|-------|
| `op_id` | TEXT | Auto-generated, format `YYYY-MM-NNNN` |
| `title` | TEXT | Required |
| `description` | TEXT | Free text |
| `status` | TEXT | standby / in_progress / review / completed / cancelled / overdue |
| `priority` | TEXT | critical / high / medium / low |
| `start_date` | TEXT | YYYY-MM-DD |
| `end_date` | TEXT | YYYY-MM-DD, auto-sets `overdue` if past |
| `cost_zar` | REAL | South African Rand |
| `parent_id` | INTEGER | FK to ops.id, null = top-level |
| `created_by` | TEXT | Display name of creator |
| `category` | TEXT | e.g. infrastructure, security |
| `impact` | TEXT | high / medium / low |
| `division` | TEXT | lab / databyte / home |

### Auto-Overdue
Backend sets `status = 'overdue'` on every fetch for any task past `end_date` that isn't `completed` or `cancelled`.

### Activity Log
All field changes logged with timestamp, user, and display string.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ops` | List all ops (with computed `child_count`) |
| `GET` | `/api/ops/stats` | Dashboard KPI stats |
| `GET` | `/api/ops/:opId` | Get single op |
| `GET` | `/api/ops/:opId/children` | List sub-tasks of a parent |
| `GET` | `/api/ops/next-id` | Get next OP number `{next: N}` |
| `POST` | `/api/ops` | Create op |
| `PATCH` | `/api/ops/:opId` | Update op |
| `DELETE` | `/api/ops/:opId` | Delete op + attachments |
| `POST` | `/api/ops/:opId/attachments` | Upload file |
| `GET` | `/api/ops/:opId/attachments/:id/download` | Download file |

### Create/Update Payload
```json
{
  "title": "Task title",
  "description": "Details...",
  "status": "in_progress",
  "priority": "high",
  "start_date": "2026-04-15",
  "end_date": "2026-04-30",
  "cost_zar": 1500.00,
  "parent_id": "2026-04-0001",
  "category": "infrastructure",
  "impact": "medium",
  "division": "lab",
  "created_by": "Zun"
}
```
`parent_id` accepts an op_id string (auto-resolved to numeric id).

---

## Deployment

### Backend (Pi — Docker container)
```bash
# Deploy updated server files
scp server/db.js pi:/home/zunaid/ops-tracker/server/
scp server/routes/ops.js pi:/home/zunaid/ops-tracker/server/
ssh pi "docker restart ops-tracker"
```

### Frontend (Pi — static assets)
```bash
cd ops-tracker-react
CI=true npm run build
# Clean Pi assets
ssh pi "rm /home/zunaid/ops-tracker/public/assets/*.{css,js}"
# Sync new build
scp dist/assets/*.css dist/assets/*.js pi:/home/zunaid/ops-tracker/public/assets/
# Update index.html refs
ssh pi "sed -i 's|index-[^.]*\.js|NEW_FILE|g; s|index-[^.]*\.css|NEW_FILE|g' /home/zunaid/ops-tracker/public/index.html"
```

Or use `sync.sh` for hash-verified deploy:
```bash
bash ops-tracker-react/sync.sh
```

---

## Database

SQLite at `/data/ops.db` in the container.

### Key tables
- `ops` — main task table with all fields
- `ops_backup` — auto-backup of ops before migrations
- `activity_log` — change history
- `attachments` — file metadata
- `users` — user accounts

### Migration Rules
⚠️ **NEVER** `DROP TABLE ops` to change schema. Always use:
```javascript
if (!cols.includes('column_name')) {
  db.exec("ALTER TABLE ops ADD COLUMN column_name TEXT DEFAULT NULL");
}
```

---

## Version History

| Tag | Description |
|-----|-------------|
| `v2.2.0` | Sub-task hierarchy, cost_zar, start/end dates, created_by, visual drawer redesign |
| `v2.1.0` | React routing overhaul, KPI tiles, activity panel |
| `v2.0.0` | Full React + Zustand frontend rewrite |

---

## CI / CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Every push | Syntax check + Docker build smoke test |
| `release.yml` | `git push tag v*.*.*` | Build + push to GHCR, create GitHub Release |

---

## Docker

```bash
docker compose up -d       # Start
docker compose logs -f      # Watch logs
docker compose down         # Stop
docker compose down -v       # Stop + wipe data (destructive!)

# Rebuild after code changes
docker compose up -d --build
```

Image: `ghcr.io/dippie-wp/ops-tracker`
