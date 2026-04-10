'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_TYPES = ['STATUS_CHANGE','PRIORITY_CHANGE','ASSIGNED','CREATED','COMMENTED','FIELDS_CHANGED'];

// GET /api/activity
router.get('/', (req, res) => {
  try {
    const { type, taskId, division, page = 1, limit = 20 } = req.query;
    const result = db.listActivity({
      type:     VALID_TYPES.includes(type) ? type : undefined,
      taskId:   taskId || undefined,
      division: division || undefined,
      page:     Math.max(1, parseInt(page, 10) || 1),
      limit:    Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/activity — create a comment or manual entry
router.post('/', (req, res) => {
  try {
    const { task_id, op_number, type, display, comment, division, user_id } = req.body;

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing type' });
    }
    if (!display || !display.trim()) {
      return res.status(400).json({ ok: false, error: 'display string is required' });
    }

    db.createActivity({
      taskId:   task_id   || op_number || null,
      opNumber: op_number || null,
      userId:   user_id  || 'default',
      type,
      display:  display.trim(),
      comment:  comment   || null,
      division: division  || null,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
