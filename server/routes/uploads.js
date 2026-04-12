const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');

// Use the raw better-sqlite3 db for direct queries (uploads table)
const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'ops.db')
  : path.join(__dirname, '..', 'data', 'ops.db');
const sqlite = new (require('better-sqlite3'))(DB_PATH);

const UPLOAD_DIR = '/app/uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, crypto.randomUUID() + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, _file, cb) => cb(null, true) });

router.get('/', (req, res) => {
  try {
    const uploads = sqlite.prepare(
      "SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at, user_id, op_id FROM uploads WHERE op_id = '0000' ORDER BY uploaded_at DESC"
    ).all();
    res.json({ ok: true, data: uploads });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file provided' });
  const userId = req.body.user_id || 'zu';
  const { filename, originalname, mimetype, size } = req.file;

  const result = sqlite.prepare(
    "INSERT INTO uploads (filename, original_name, mime_type, size_bytes, uploaded_at, user_id, op_id) VALUES (?, ?, ?, ?, datetime('now'), ?, '0000')"
  ).run(filename, originalname, mimetype, size, userId);

  // Log activity — use a valid type from the existing enum
  try {
    db.listActivity({ type: 'FILE_UPLOADED', limit: 1 }); // just test first
  } catch (e) {
    console.log('activity test error:', e.message);
  }

  res.json({
    ok: true,
    data: {
      id: result.lastInsertRowid, filename, original_name: originalname,
      mime_type: mimetype, size_bytes: size,
      uploaded_at: new Date().toISOString(), user_id: userId, op_id: '0000',
    },
  });
});

router.get('/:id', (req, res) => {
  const u = sqlite.prepare("SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at, user_id, op_id FROM uploads WHERE id = ?").get(req.params.id);
  if (!u) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, data: u });
});

router.get('/:id/download', (req, res) => {
  const u = sqlite.prepare("SELECT filename, original_name FROM uploads WHERE id = ?").get(req.params.id);
  if (!u) return res.status(404).json({ ok: false, error: 'Not found' });
  const file = path.join(UPLOAD_DIR, u.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'File not found' });
  res.download(file, u.original_name);
});

router.patch('/:id/link', (req, res) => {
  const { id } = req.params;
  const { op_id } = req.body;
  if (!op_id) return res.status(400).json({ ok: false, error: 'op_id required' });

  const op = db.getOp(op_id);
  if (!op) return res.status(404).json({ ok: false, error: 'OP not found' });

  const upload = sqlite.prepare("SELECT original_name FROM uploads WHERE id = ? AND op_id = '0000'").get(id);
  if (!upload) return res.status(404).json({ ok: false, error: 'Upload not found or already linked' });

  sqlite.prepare("UPDATE uploads SET op_id = ? WHERE id = ? AND op_id = '0000'").run(op_id, id);

  // Log activity using STATUS_CHANGE as a safe fallback type
  try {
    db.createActivity({
      taskId: String(id),
      opNumber: op_id,
      userId: 'default',
      type: 'COMMENTED',  // safe existing type
      display: `📎 Linked "${upload.original_name}" → #${op_id}${op.title ? ' (' + op.title.slice(0, 30) + ')' : ''}`,
      division: null,
    });
  } catch (e) {
    console.log('link activity error:', e.message);
  }

  res.json({ ok: true, message: 'Linked to ' + op_id });
});

router.patch('/:id/unlink', (req, res) => {
  const { id } = req.params;
  const upload = sqlite.prepare("SELECT original_name, op_id FROM uploads WHERE id = ?").get(id);
  if (!upload) return res.status(404).json({ ok: false, error: 'Not found' });

  sqlite.prepare("UPDATE uploads SET op_id = '0000' WHERE id = ?").run(id);

  try {
    db.createActivity({
      taskId: String(id),
      opNumber: upload.op_id !== '0000' ? upload.op_id : null,
      userId: 'default',
      type: 'COMMENTED',
      display: `📎 Unlinked "${upload.original_name}" from #${upload.op_id}`,
      division: null,
    });
  } catch (e) {
    console.log('unlink activity error:', e.message);
  }

  res.json({ ok: true, message: 'Returned to uploads' });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const upload = sqlite.prepare("SELECT filename, original_name, op_id FROM uploads WHERE id = ?").get(id);
  if (!upload) return res.status(404).json({ ok: false, error: 'Upload not found' });

  const file = path.join(UPLOAD_DIR, upload.filename);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  sqlite.prepare("DELETE FROM uploads WHERE id = ?").run(id);

  try {
    db.createActivity({
      taskId: String(id),
      opNumber: upload.op_id !== '0000' ? upload.op_id : null,
      userId: 'default',
      type: 'COMMENTED',
      display: `🗑️ Deleted "${upload.original_name}"`,
      division: null,
    });
  } catch (e) {
    console.log('delete activity error:', e.message);
  }

  res.json({ ok: true });
});

module.exports = router;