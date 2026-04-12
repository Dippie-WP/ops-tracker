'use strict';

const Database = require('better-sqlite3');
const path    = require('path');

const DB_PATH = process.env.DATA_DIR
  ? `${process.env.DATA_DIR}/ops.db`
  : path.join(__dirname, '..', 'data', 'ops.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Check existing ops table schema ────────────────────────────────────────────
function getCols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name);
}

const opsCols = getCols('ops');

// ── 1. Ensure all new columns exist (idempotent ALTER TABLE ADD COLUMN) ──────
const newCols = ['start_date','end_date','cost_zar','parent_id'];
for (const col of newCols) {
  if (!opsCols.includes(col)) {
    try {
      const colDef = col === 'cost_zar' ? 'REAL DEFAULT NULL' : 'TEXT DEFAULT NULL';
      db.exec(`ALTER TABLE ops ADD COLUMN ${col} ${colDef}`);
    } catch(e) {}
  }
}

if (!opsCols.includes('division')) {
  try {
    db.exec("ALTER TABLE ops ADD COLUMN division TEXT NOT NULL DEFAULT 'lab'");
  } catch(e) {}
}

db.exec('CREATE INDEX IF NOT EXISTS idx_ops_status ON ops(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_ops_division ON ops(division)');
db.exec('CREATE INDEX IF NOT EXISTS idx_ops_parent ON ops(parent_id)');

// ── 2. Users table ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL,
    initials   TEXT    NOT NULL,
    division   TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);
if (!db.prepare("SELECT id FROM users WHERE id = ?").get('default')) {
  db.exec("INSERT INTO users (id, name, initials, division) VALUES ('default', 'Default User', 'DU', 'lab')");
}

// ── 3. Activity log ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    TEXT    NOT NULL,
    op_number  TEXT,
    user_id    TEXT    NOT NULL REFERENCES users(id),
    type       TEXT    NOT NULL,
    display    TEXT,
    comment    TEXT,
    division   TEXT,
    timestamp  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_log(task_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_op ON activity_log(op_number)');

// ── 4. Attachments ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS attachments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id         TEXT    NOT NULL,
    filename      TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    mime_type     TEXT,
    size_bytes    INTEGER DEFAULT 0,
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    user_id       TEXT,
    FOREIGN KEY (op_id) REFERENCES ops(op_id)
  )
`);

// ── 5. Uploads (unlinked files) ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    mime_type     TEXT,
    size_bytes    INTEGER DEFAULT 0,
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    user_id       TEXT,
    op_id         TEXT    NOT NULL DEFAULT '0000'
  )
`);

// ── 6. Auto-overdue: any task past end_date not completed/cancelled ────────────
const today = new Date().toISOString().split('T')[0];
try {
  const allOps = db.prepare('SELECT * FROM ops').all();
  const overdue = allOps.filter(op =>
    op.end_date && op.end_date < today && !['completed','cancelled'].includes(op.status)
  );
  for (const op of overdue) {
    db.prepare("UPDATE ops SET status='overdue', updated_at=datetime('now') WHERE id=? AND status NOT IN ('completed','cancelled')").run(op.id);
  }
} catch(e) {}

// ── Module export ─────────────────────────────────────────────────────────────
module.exports = {
  listOps:          () => db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM ops c WHERE c.parent_id = o.id) AS child_count
    FROM ops o
    ORDER BY o.created_at DESC
  `).all(),
  getOp:            (id) => db.prepare('SELECT * FROM ops WHERE id = ?').get(id),
  getOpByNumber:    (opId) => db.prepare('SELECT * FROM ops WHERE op_id = ?').get(opId),
  nextOpId:         () => db.prepare("SELECT MAX(CAST(SUBSTR(op_id, 10) AS INTEGER)) + 1 AS next FROM ops").get(),
  createOp:         (op_id, title, description, status, priority, start_date, end_date, cost_zar, parent_id, category, impact, division) =>
                    db.prepare('INSERT INTO ops (op_id,title,description,status,priority,start_date,end_date,cost_zar,parent_id,category,impact,division) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(op_id, title, description, status, priority, start_date, end_date, cost_zar, parent_id, category, impact, division),
  updateOp:         (title, description, status, priority, start_date, end_date, cost_zar, parent_id, category, impact, division, id) =>
                    db.prepare("UPDATE ops SET title=?,description=?,status=?,priority=?,start_date=?,end_date=?,cost_zar=?,parent_id=?,category=?,impact=?,division=?,updated_at=datetime('now') WHERE id=?").run(title, description, status, priority, start_date, end_date, cost_zar, parent_id, category, impact, division, id),
  deleteOp:         (id) => db.prepare('DELETE FROM ops WHERE id = ?').run(id),
  listAttachments:  (opId) => db.prepare('SELECT * FROM attachments WHERE op_id = ? ORDER BY uploaded_at DESC').all(opId),
  listAllAttachments: () => db.prepare('SELECT * FROM attachments ORDER BY uploaded_at DESC').all(),
  addAttachment:    (op_id, filename, original_name, mime_type, size_bytes, user_id) =>
                    db.prepare('INSERT INTO attachments (op_id,filename,original_name,mime_type,size_bytes,user_id) VALUES (?,?,?,?,?,?)').run(op_id, filename, original_name, mime_type, size_bytes, user_id),
  delAttachment:    (id) => db.prepare('DELETE FROM attachments WHERE id = ?').run(id),
  createActivity:   (fields) =>
                    db.prepare('INSERT INTO activity_log (task_id,op_number,user_id,type,display,comment,division) VALUES (?,?,?,?,?,?,?)').run(fields.taskId, fields.opNumber, fields.userId, fields.type, fields.display, fields.comment || null, fields.division || null),
  listActivity:     (filters) => {
    let sql = "SELECT * FROM activity_log WHERE 1=1";
    const params = [];
    if (filters?.type)     { sql += " AND type = ?";       params.push(filters.type); }
    if (filters?.opNumber) { sql += " AND op_number = ?";  params.push(filters.opNumber); }
    if (filters?.userId)   { sql += " AND user_id = ?";    params.push(filters.userId); }
    sql += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    const limit = filters?.limit || 20;
    const offset = filters?.page ? (filters.page - 1) * limit : 0;
    return db.prepare(sql).all(...params, limit, offset);
  },
  getMe:            (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  listChildren:     (parentId) => {
    // Accept either op_id string or numeric id
    const sql = parentId && isNaN(parentId)
      ? 'SELECT * FROM ops WHERE parent_id = (SELECT id FROM ops WHERE op_id = ?) ORDER BY created_at ASC'
      : 'SELECT * FROM ops WHERE parent_id = ? ORDER BY created_at ASC';
    return db.prepare(sql).all(parentId);
  },
  getStats:         () => {
    const all = db.prepare('SELECT status, COUNT(*) as count FROM ops GROUP BY status').all();
    const byStatus = all; // [{status, count}, ...]
    const total = all.reduce((sum, r) => sum + r.count, 0);
    return { total, byStatus };
  },
  db,
};
