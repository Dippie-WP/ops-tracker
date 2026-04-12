'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_STATUSES    = ['pending','in_progress','completed','cancelled','overdue','standby'];
const VALID_PRIORITIES = ['critical','high','medium','low'];
const VALID_CATEGORIES = ['infrastructure','software','security','networking','documentation','other'];
const VALID_IMPACTS    = ['critical','high','medium','low'];
const VALID_DIVISIONS  = ['lab','databyte','home'];

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
  if (body.division && !VALID_DIVISIONS.includes(body.division))
    errors.push(`division must be one of: ${VALID_DIVISIONS.join(', ')}`);
  if (body.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date))
    errors.push('start_date must be YYYY-MM-DD');
  if (body.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.end_date))
    errors.push('end_date must be YYYY-MM-DD');
  return errors;
}

// ── Activity helper ────────────────────────────────────────────────────────────
function logActivity(taskId, opNumber, type, display, comment) {
  try {
    db.createActivity({ taskId, opNumber, userId: 'default', type, display, comment });
  } catch(e) { console.error('Activity log error:', e.message); }
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

// GET /api/ops/attachments
router.get('/attachments', (req, res) => {
  try {
    const atts = db.listAllAttachments();
    const byOp = {};
    for (const a of atts) {
      if (!byOp[a.op_id]) byOp[a.op_id] = [];
      byOp[a.op_id].push(a);
    }
    res.json({ ok: true, data: byOp });
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

// GET /api/ops/next-id
router.get('/next-id', (req, res) => {
  try {
    res.json({ ok: true, data: db.nextOpId() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ops/:opId
router.get('/:opId', (req, res) => {
  try {
    const op = db.getOpByNumber(req.params.opId);
    if (!op) return res.status(404).json({ ok: false, error: 'Op not found' });
    const attachments = db.listAttachments(req.params.opId);
    const children = db.listChildren(req.params.opId);
    res.json({ ok: true, data: { ...op, attachments, children } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ops/:opId/children
router.get('/:opId/children', (req, res) => {
  try {
    const children = db.listChildren(req.params.opId);
    res.json({ ok: true, data: children });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/ops
router.post('/', (req, res) => {
  try {
    const errors = validate(req.body, true);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const next = db.nextOpId();
    const seq  = String(next ? next.next : 1).padStart(4, '0');
    const op_id = `2026-04-${seq}`;

    db.createOp(
      op_id,
      req.body.title.trim(),
      (req.body.description || '').trim(),
      req.body.status || 'pending',
      req.body.priority || 'medium',
      req.body.start_date || null,
      req.body.end_date || null,
      req.body.cost_zar != null ? parseFloat(req.body.cost_zar) : null,
      req.body.parent_id
        ? (isNaN(req.body.parent_id)
            ? (db.getOpByNumber(req.body.parent_id) || {id: null}).id
            : parseInt(req.body.parent_id))
        : null,
      req.body.category || '',
      req.body.impact || 'medium',
      req.body.division || 'lab',
      req.body.created_by || 'default'
    );

    const op = db.getOpByNumber(op_id);
    logActivity(op.id, op.op_id, 'CREATED', `📄 Created #${op.op_id}`);
    res.status(201).json({ ok: true, data: op });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/ops/:opId
router.patch('/:opId', (req, res) => {
  try {
    const existing = db.getOpByNumber(req.params.opId);
    if (!existing) return res.status(404).json({ ok: false, error: 'Op not found' });
    const errors = validate(req.body, false);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const newStatus = req.body.status || existing.status;

    // Block closing parent if it has open children
    if (['completed','cancelled'].includes(newStatus) && existing.parent_id === null) {
      const children = db.listChildren(req.params.opId);
      const openChildren = children.filter(c => ['in_progress','standby','overdue','pending'].includes(c.status));
      if (openChildren.length > 0) {
        return res.status(400).json({
          ok: false,
          error: `Cannot close: ${openChildren.length} child(ren) still open (in_progress/standby/overdue/pending)`
        });
      }
    }

    db.updateOp(
      (req.body.title        ?? existing.title).trim(),
      (req.body.description  ?? (existing.description || '')).trim(),
      newStatus,
      req.body.priority     ?? existing.priority,
      req.body.start_date   !== undefined ? (req.body.start_date || null) : existing.start_date,
      req.body.end_date     !== undefined ? (req.body.end_date || null)   : existing.end_date,
      req.body.cost_zar     !== undefined ? (req.body.cost_zar != null ? parseFloat(req.body.cost_zar) : null) : existing.cost_zar,
      req.body.parent_id    !== undefined
        ? (req.body.parent_id
            ? (isNaN(req.body.parent_id)
                ? (db.getOpByNumber(req.body.parent_id) || {id: null}).id
                : parseInt(req.body.parent_id))
            : null)
        : existing.parent_id,
      req.body.category     ?? existing.category,
      req.body.impact       ?? existing.impact,
      req.body.division     ?? existing.division,
      existing.id
    );

    const updated = db.getOp(existing.id);

    // Field-change activity
    const changes = [];
    if (req.body.status    && req.body.status    !== existing.status)    changes.push(`status: ${existing.status}→${req.body.status}`);
    if (req.body.priority  && req.body.priority  !== existing.priority)  changes.push(`priority: ${existing.priority}→${req.body.priority}`);
    if (req.body.start_date && req.body.start_date !== existing.start_date) changes.push(`start: ${existing.start_date || 'none'}→${req.body.start_date}`);
    if (req.body.end_date  && req.body.end_date  !== existing.end_date) changes.push(`end: ${existing.end_date || 'none'}→${req.body.end_date}`);
    if (req.body.cost_zar  !== undefined && String(req.body.cost_zar) !== String(existing.cost_zar)) changes.push(`cost: R${existing.cost_zar || 0}→R${req.body.cost_zar}`);
    if (changes.length) logActivity(updated.id, updated.op_id, 'FIELDS_CHANGED', `✏️ ${changes.join(', ')}`);

    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/ops/:opId
router.delete('/:opId', (req, res) => {
  try {
    const existing = db.getOpByNumber(req.params.opId);
    if (!existing) return res.status(404).json({ ok: false, error: 'Op not found' });
    db.deleteOp(existing.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
