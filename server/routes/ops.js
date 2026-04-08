'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_STATUSES   = ['pending','in_progress','completed','cancelled'];
const VALID_PRIORITIES = ['critical','high','medium','low'];
const VALID_CATEGORIES = ['infrastructure','software','security','networking','documentation','other'];
const VALID_IMPACTS    = ['critical','high','medium','low'];

function validate(body, requireAll = false) {
  const errors = [];
  if (requireAll || body.title !== undefined) {
    if (!body.title || !body.title.trim()) errors.push('title is required');
  }
  if (body.status    && !VALID_STATUSES.includes(body.status))
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  if (body.priority  && !VALID_PRIORITIES.includes(body.priority))
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  if (body.category && !VALID_CATEGORIES.includes(body.category))
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  if (body.impact && !VALID_IMPACTS.includes(body.impact))
    errors.push(`impact must be one of: ${VALID_IMPACTS.join(', ')}`);
  if (body.planned_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.planned_date))
    errors.push('planned_date must be YYYY-MM-DD');
  return errors;
}

// GET /api/ops
router.get('/', (req, res) => {
  try {
    const ops = db.listOps();
    res.json({ ok: true, data: ops });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ops/stats
router.get('/stats', (req, res) => {
  try {
    res.json({ ok: true, data: db.getStats() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ops/:opId
router.get('/:opId', (req, res) => {
  try {
    const op = db.getOp(req.params.opId);
    if (!op) return res.status(404).json({ ok: false, error: 'Op not found' });
    const attachments = db.listAttachments(req.params.opId);
    res.json({ ok: true, data: { ...op, attachments } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/ops
router.post('/', (req, res) => {
  try {
    const errors = validate(req.body, true);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const op = db.createOp({
      title:        req.body.title.trim(),
      description:  (req.body.description || '').trim(),
      status:       req.body.status    || 'pending',
      priority:     req.body.priority  || 'medium',
      planned_date: req.body.planned_date || null,
      category:     req.body.category  || '',
      impact:       req.body.impact    || 'medium',
    });
    res.status(201).json({ ok: true, data: op });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/ops/:opId
router.patch('/:opId', (req, res) => {
  try {
    const existing = db.getOp(req.params.opId);
    if (!existing) return res.status(404).json({ ok: false, error: 'Op not found' });

    const errors = validate(req.body, false);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const updated = db.updateOp(req.params.opId, {
      title:        (req.body.title        ?? existing.title).trim(),
      description:  (req.body.description  ?? (existing.description || '')).trim(),
      status:       req.body.status        ?? existing.status,
      priority:     req.body.priority      ?? existing.priority,
      planned_date: req.body.planned_date  !== undefined
                      ? (req.body.planned_date || null)
                      : existing.planned_date,
      category:     req.body.category      ?? existing.category,
      impact:       req.body.impact       ?? existing.impact,
    });
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/ops/:opId
router.delete('/:opId', (req, res) => {
  try {
    const deleted = db.deleteOp(req.params.opId);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Op not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
