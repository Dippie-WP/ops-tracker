'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/auth/me — stub: returns the default system user
// Must be before /:id to avoid 'me' being captured as an id param
router.get('/me', (req, res) => {
  try {
    const user = db.getUser('default');
    if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    res.json({ ok: true, data: user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/users
router.get('/', (req, res) => {
  try {
    const { division, search } = req.query;
    let users = db.listUsers();
    if (division) users = users.filter(u => u.division === division);
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    res.json({ ok: true, data: users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/users/:id — must be AFTER /me
router.get('/:id', (req, res) => {
  try {
    const user = db.getUser(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, data: user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
