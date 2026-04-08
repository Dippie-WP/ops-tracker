'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'ops.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and crash safety
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS ops (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id     TEXT    NOT NULL UNIQUE,
    title     TEXT    NOT NULL,
    description TEXT  DEFAULT '',
    status    TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','in_progress','completed','cancelled')),
    priority  TEXT    NOT NULL DEFAULT 'medium'
                      CHECK(priority IN ('critical','high','medium','low')),
    planned_date TEXT DEFAULT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id      TEXT    NOT NULL REFERENCES ops(op_id) ON DELETE CASCADE,
    filename   TEXT    NOT NULL,
    original_name TEXT NOT NULL,
    mime_type  TEXT    NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ops_status   ON ops(status);
  CREATE INDEX IF NOT EXISTS idx_ops_priority ON ops(priority);
  CREATE INDEX IF NOT EXISTS idx_ops_planned  ON ops(planned_date);
  CREATE INDEX IF NOT EXISTS idx_attach_op    ON attachments(op_id);
`);

// ── Prepared statements (compiled once, reused safely) ──────────────────────

const stmts = {
  listOps: db.prepare(`
    SELECT o.*,
           COUNT(a.id) AS attachment_count
    FROM   ops o
    LEFT JOIN attachments a ON a.op_id = o.op_id
    GROUP BY o.id
    ORDER BY
      CASE o.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                      WHEN 'medium'  THEN 3 ELSE 4 END,
      o.planned_date ASC NULLS LAST,
      o.created_at DESC
  `),

  getOp: db.prepare(`
    SELECT o.*,
           COUNT(a.id) AS attachment_count
    FROM   ops o
    LEFT JOIN attachments a ON a.op_id = o.op_id
    WHERE  o.op_id = ?
    GROUP BY o.id
  `),

  createOp: db.prepare(`
    INSERT INTO ops (op_id, title, description, status, priority, planned_date)
    VALUES (@op_id, @title, @description, @status, @priority, @planned_date)
  `),

  updateOp: db.prepare(`
    UPDATE ops SET
      title        = @title,
      description  = @description,
      status       = @status,
      priority     = @priority,
      planned_date = @planned_date,
      updated_at   = datetime('now')
    WHERE op_id = @op_id
  `),

  deleteOp: db.prepare(`DELETE FROM ops WHERE op_id = ?`),

  statsCount: db.prepare(`
    SELECT status, COUNT(*) as count FROM ops GROUP BY status
  `),

  statsPriority: db.prepare(`
    SELECT priority, COUNT(*) as count FROM ops
    WHERE  status NOT IN ('completed','cancelled')
    GROUP BY priority
  `),

  statsOverdue: db.prepare(`
    SELECT COUNT(*) as count FROM ops
    WHERE  planned_date < date('now')
    AND    status NOT IN ('completed','cancelled')
  `),

  listAttachments: db.prepare(`
    SELECT * FROM attachments WHERE op_id = ? ORDER BY uploaded_at DESC
  `),

  addAttachment: db.prepare(`
    INSERT INTO attachments (op_id, filename, original_name, mime_type, size_bytes)
    VALUES (@op_id, @filename, @original_name, @mime_type, @size_bytes)
  `),

  deleteAttachment: db.prepare(`
    DELETE FROM attachments WHERE id = ? AND op_id = ?
  `),

  getAttachment: db.prepare(`
    SELECT * FROM attachments WHERE id = ?
  `),
};

// ── Helpers to generate sequential OP-XXXX IDs ──────────────────────────────

const lastOpId = db.prepare(`
  SELECT op_id FROM ops ORDER BY id DESC LIMIT 1
`);

function nextOpId() {
  const row = lastOpId.get();
  if (!row) return 'OP-0001';
  const num = parseInt(row.op_id.replace('OP-', ''), 10);
  return 'OP-' + String(num + 1).padStart(4, '0');
}

// ── Public API ───────────────────────────────────────────────────────────────

module.exports = {
  // Ops
  listOps:   () => stmts.listOps.all(),
  getOp:     (opId) => stmts.getOp.get(opId),
  nextOpId,

  createOp(fields) {
    const op_id = nextOpId();
    stmts.createOp.run({ ...fields, op_id });
    return stmts.getOp.get(op_id);
  },

  updateOp(opId, fields) {
    const info = stmts.updateOp.run({ ...fields, op_id: opId });
    if (info.changes === 0) return null;
    return stmts.getOp.get(opId);
  },

  deleteOp(opId) {
    const info = stmts.deleteOp.run(opId);
    return info.changes > 0;
  },

  getStats() {
    const byStatus   = stmts.statsCount.all();
    const byPriority = stmts.statsPriority.all();
    const overdue    = stmts.statsOverdue.get();
    return { byStatus, byPriority, overdueCount: overdue.count };
  },

  // Attachments
  listAttachments: (opId) => stmts.listAttachments.all(opId),
  addAttachment:   (fields) => { stmts.addAttachment.run(fields); },
  deleteAttachment:(id, opId) => stmts.deleteAttachment.run(id, opId).changes > 0,
  getAttachment:   (id) => stmts.getAttachment.get(id),
};
