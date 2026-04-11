'use strict';

const Database = require('better-sqlite3');
const path    = require('path');
const fs      = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'ops.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and crash safety
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema migrations ─────────────────────────────────────────────────────────

// Migrate existing schema (add category/impact columns if missing)
try {
  const cols = db.prepare('PRAGMA table_info(ops)').all().map(r => r.name);
  if (!cols.includes('category')) db.exec('ALTER TABLE ops ADD COLUMN category TEXT NOT NULL DEFAULT \'\'');
  if (!cols.includes('impact'))    db.exec('ALTER TABLE ops ADD COLUMN impact TEXT NOT NULL DEFAULT \'medium\'');
} catch (e) { /* ignore if fresh DB */ }

// Migration: add division column if missing
try {
  const cols = db.prepare('PRAGMA table_info(ops)').all().map(r => r.name);
  if (!cols.includes('division')) db.exec('ALTER TABLE ops ADD COLUMN division TEXT NOT NULL DEFAULT \'lab\'');
} catch (e) { /* ignore */ }

// ── Core tables ───────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS ops (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id     TEXT    NOT NULL UNIQUE,
    title     TEXT    NOT NULL,
    description TEXT  DEFAULT '',
    status    TEXT    NOT NULL DEFAULT 'standby'
                      CHECK(status IN ('standby','in_progress','completed','cancelled')),
    priority  TEXT    NOT NULL DEFAULT 'medium'
                      CHECK(priority IN ('critical','high','medium','low')),
    planned_date TEXT DEFAULT NULL,
    category    TEXT    NOT NULL DEFAULT ''
                      CHECK(category IN ('infrastructure','software','security','networking','documentation','other')),
    impact     TEXT    NOT NULL DEFAULT 'medium'
                      CHECK(impact IN ('critical','high','medium','low')),
    division   TEXT    NOT NULL DEFAULT 'lab',
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

  CREATE INDEX IF NOT EXISTS idx_ops_status    ON ops(status);
  CREATE INDEX IF NOT EXISTS idx_ops_priority  ON ops(priority);
  CREATE INDEX IF NOT EXISTS idx_ops_planned   ON ops(planned_date);
  CREATE INDEX IF NOT EXISTS idx_ops_division  ON ops(division);
  CREATE INDEX IF NOT EXISTS idx_attach_op     ON attachments(op_id);
`);

// ── Users table (minimal — for activity log attribution) ──────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        TEXT    PRIMARY KEY,
    name      TEXT    NOT NULL,
    initials  TEXT    NOT NULL DEFAULT '',
    email     TEXT,
    division   TEXT
  )
`);

// Ensure a default user exists (Zun — system operator)
try {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('default');
  if (!existing) {
    db.prepare(`INSERT INTO users (id, name, initials, division) VALUES (?, ?, ?, ?)`
    ).run('default', 'Zun', 'ZU', 'lab');
  }
} catch (e) { /* ignore */ }

// ── Activity log table ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT    NOT NULL,
    op_number   TEXT,
    user_id     TEXT    NOT NULL DEFAULT 'default'
                      REFERENCES users(id),
    type        TEXT    NOT NULL
                      CHECK(type IN (
                        'STATUS_CHANGE','PRIORITY_CHANGE','ASSIGNED',
                        'CREATED','COMMENTED','FIELDS_CHANGED'
                      )),
    display     TEXT    NOT NULL,
    comment     TEXT,
    division    TEXT,
    timestamp   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_activity_task_id    ON activity_log(task_id);
  CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_division  ON activity_log(division);
  CREATE INDEX IF NOT EXISTS idx_activity_user_id    ON activity_log(user_id);
`);

// ── Prepared statements ───────────────────────────────────────────────────────

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
    INSERT INTO ops (op_id, title, description, status, priority, planned_date, category, impact, division)
    VALUES (@op_id, @title, @description, @status, @priority, @planned_date, @category, @impact, @division)
  `),

  updateOp: db.prepare(`
    UPDATE ops SET
      title        = @title,
      description  = @description,
      status       = @status,
      priority     = @priority,
      planned_date = @planned_date,
      category     = @category,
      impact       = @impact,
      division     = @division,
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

  listAllAttachments: db.prepare(`
    SELECT * FROM attachments ORDER BY uploaded_at DESC
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

  // ── Activity ────────────────────────────────────────────────────────────────

  createActivity: db.prepare(`
    INSERT INTO activity_log (task_id, op_number, user_id, type, display, comment, division)
    VALUES (@task_id, @op_number, @user_id, @type, @display, @comment, @division)
  `),

  listActivity: db.prepare(`
    SELECT a.*, u.name AS user_name, u.initials AS user_initials
    FROM   activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE  1=1
    ORDER BY a.timestamp DESC
    LIMIT  ? OFFSET ?
  `),

  countActivity: db.prepare(`
    SELECT COUNT(*) AS total FROM activity_log WHERE 1=1
  `),

  // ── Users ─────────────────────────────────────────────────────────────────

  listUsers: db.prepare(`SELECT * FROM users ORDER BY name`),

  getUser: db.prepare(`SELECT * FROM users WHERE id = ?`),
};

// ── OP number generator ────────────────────────────────────────────────────────

function nextOpId() {
  const year   = new Date().getFullYear();
  const month  = String(new Date().getMonth() + 1).padStart(2, '0');
  const prefix = `${year}-${month}-`;

  const row = db.prepare(`
    SELECT op_id FROM ops
    WHERE op_id LIKE ? || '%'
    ORDER BY id DESC LIMIT 1
  `).get(prefix);

  if (!row) return prefix + '0001';
  const num = parseInt(row.op_id.replace(prefix, ''), 10);
  return prefix + String(num + 1).padStart(4, '0');
}

// ── Activity helpers ──────────────────────────────────────────────────────────

const ACTIVITY_TYPES = {
  STATUS_CHANGE:  'STATUS_CHANGE',
  PRIORITY_CHANGE: 'PRIORITY_CHANGE',
  ASSIGNED:        'ASSIGNED',
  CREATED:         'CREATED',
  COMMENTED:       'COMMENTED',
  FIELDS_CHANGED:  'FIELDS_CHANGED',
};

function logActivity({ taskId, opNumber, userId, type, display, comment, division }) {
  stmts.createActivity.run({
    task_id:   taskId   || opNumber,
    op_number: opNumber || null,
    user_id:   userId   || 'default',
    type,
    display:   display  || '',
    comment:   comment  || null,
    division:  division || null,
  });
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
    const op = stmts.getOp.get(op_id);

    // Write CREATED activity entry
    logActivity({
      taskId:   String(op.id),
      opNumber: op_id,
      userId:   'default',
      type:     ACTIVITY_TYPES.CREATED,
      display:  'Zun created this task',
      division: op.division,
    });

    return op;
  },

  updateOp(opId, fields, prevOp) {
    const info = stmts.updateOp.run({ ...fields, op_id: opId });
    if (info.changes === 0) return null;
    const op = stmts.getOp.get(opId);

    // Detect what changed and write activity entries
    if (prevOp && fields.status && fields.status !== prevOp.status) {
      logActivity({
        taskId:   String(op.id),
        opNumber: opId,
        userId:   'default',
        type:     ACTIVITY_TYPES.STATUS_CHANGE,
        display:  `Zun changed status to ${formatStatus(fields.status)}`,
        division: op.division,
      });
    }
    if (prevOp && fields.priority && fields.priority !== prevOp.priority) {
      logActivity({
        taskId:   String(op.id),
        opNumber: opId,
        userId:   'default',
        type:     ACTIVITY_TYPES.PRIORITY_CHANGE,
        display:  `Zun changed priority to ${capitalize(fields.priority)}`,
        division: op.division,
      });
    }

    return op;
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
  listAttachments:    (opId) => stmts.listAttachments.all(opId),
  listAllAttachments: ()    => stmts.listAllAttachments.all(),
  addAttachment:      (fields) => { stmts.addAttachment.run(fields); },
  deleteAttachment:   (id, opId) => stmts.deleteAttachment.run(id, opId).changes > 0,
  getAttachment:      (id) => stmts.getAttachment.get(id),

  // Activity
  createActivity: (fields) => logActivity(fields),

  listActivity({ type, taskId, division, limit = 20, page = 1 } = {}) {
    const offset = (page - 1) * limit;
    let where = '1=1';
    const params = [];

    if (type)     { where += ' AND a.type = ?';       params.push(type); }
    if (taskId)   { where += ' AND a.task_id = ?';    params.push(taskId); }
    if (division) { where += ' AND a.division = ?';   params.push(division); }

    const countSql = `SELECT COUNT(*) AS total FROM activity_log a WHERE ${where}`;
    const listSql  = `
      SELECT a.*, u.name AS user_name, u.initials AS user_initials
      FROM   activity_log a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE  ${where}
      ORDER BY a.timestamp DESC
      LIMIT  ? OFFSET ?
    `;

    const total = db.prepare(countSql).get(...params)?.total || 0;
    const rows  = db.prepare(listSql).all(...params, limit, offset);
    return { activity: rows, total, page, limit };
  },

  // Users
  listUsers: () => stmts.listUsers.all(),
  getUser:  (id) => stmts.getUser.get(id),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStatus(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
