'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const Database = require('better-sqlite3');

const UPLOAD_DIR = '/app/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Ensure uploads dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = crypto.randomUUID() + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});

const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'ops.db')
  : path.join(__dirname, '..', 'data', 'ops.db');

const db = new Database(DB_PATH);

// ── List unlinked uploads ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const uploads = db
      .prepare("SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at, user_id, op_id FROM uploads WHERE op_id = '0000' ORDER BY uploaded_at DESC")
      .all();
    res.json({ ok: true, data: uploads });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Upload a file ─────────────────────────────────────────────────────────────
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file provided' });

    const userId = req.body.user_id || 'zu';
    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const sizeBytes = req.file.size;

    const stmt = db.prepare(
      "INSERT INTO uploads (filename, original_name, mime_type, size_bytes, uploaded_at, user_id, op_id) VALUES (?, ?, ?, ?, datetime('now'), ?, '0000')"
    );
    const result = stmt.run(filename, originalName, mimeType, sizeBytes, userId);

    res.json({
      ok: true,
      data: {
        id: result.lastInsertRowid,
        filename,
        original_name: originalName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        uploaded_at: new Date().toISOString(),
        user_id: userId,
        op_id: '0000',
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Get single upload metadata ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const upload = db
      .prepare("SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at, user_id, op_id FROM uploads WHERE id = ?")
      .get(req.params.id);
    if (!upload) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data: upload });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Download by ID ───────────────────────────────────────────────────────────
router.get('/:id/download', (req, res) => {
  const { id } = req.params;
  const upload = db.prepare("SELECT filename, original_name FROM uploads WHERE id = ?").get(id);
  if (!upload) return res.status(404).json({ ok: false, error: 'File not found' });

  const file = path.join(UPLOAD_DIR, upload.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'File not found' });
  res.download(file, upload.original_name);
});

// ── Link upload to an OP ─────────────────────────────────────────────────────
router.patch('/:id/link', (req, res) => {
  const { op_id } = req.body;
  const { id } = req.params;

  if (!op_id) return res.status(400).json({ ok: false, error: 'op_id required' });

  // Verify OP exists
  const op = db.prepare('SELECT op_id FROM ops WHERE op_id = ?').get(op_id);
  if (!op) return res.status(404).json({ ok: false, error: 'OP not found' });

  // Update the upload
  db.prepare("UPDATE uploads SET op_id = ? WHERE id = ? AND op_id = '0000'").run(op_id, id);

  res.json({ ok: true, message: 'Linked to ' + op_id });
});

// ── Unlink (move back to 0000) ───────────────────────────────────────────────
router.patch('/:id/unlink', (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE uploads SET op_id = '0000' WHERE id = ?").run(id);
  res.json({ ok: true, message: 'Returned to uploads' });
});

// ── Delete an upload ─────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const upload = db.prepare("SELECT filename FROM uploads WHERE id = ?").get(id);
  if (!upload) return res.status(404).json({ ok: false, error: 'Upload not found' });

  const file = path.join(UPLOAD_DIR, upload.filename);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  db.prepare("DELETE FROM uploads WHERE id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
