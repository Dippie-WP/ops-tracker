'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true });
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');

const UPLOADS_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

// GET /api/ops/:opId/attachments
router.get('/', (req, res) => {
  try {
    const op = db.getOp(req.params.opId);
    if (!op) return res.status(404).json({ ok: false, error: 'Op not found' });
    res.json({ ok: true, data: db.listAttachments(req.params.opId) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/ops/:opId/attachments
router.post('/', upload.single('file'), (req, res) => {
  try {
    const op = db.getOp(req.params.opId);
    if (!op) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ ok: false, error: 'Op not found' });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

    db.addAttachment({
      op_id:         req.params.opId,
      filename:      req.file.filename,
      original_name: req.file.originalname,
      mime_type:     req.file.mimetype,
      size_bytes:    req.file.size,
    });

    res.status(201).json({ ok: true, data: db.listAttachments(req.params.opId) });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ops/:opId/attachments/:id/download
router.get('/:id/download', (req, res) => {
  try {
    const att = db.getAttachment(req.params.id);
    if (!att || att.op_id !== req.params.opId)
      return res.status(404).json({ ok: false, error: 'Attachment not found' });

    const filePath = path.join(UPLOADS_DIR, att.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ ok: false, error: 'File missing on disk' });

    res.download(filePath, att.original_name);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/ops/:opId/attachments/:id
router.delete('/:id', (req, res) => {
  try {
    const att = db.getAttachment(req.params.id);
    if (!att || att.op_id !== req.params.opId)
      return res.status(404).json({ ok: false, error: 'Attachment not found' });

    const filePath = path.join(UPLOADS_DIR, att.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.deleteAttachment(req.params.id, req.params.opId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
