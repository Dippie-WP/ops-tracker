'use strict';

const express = require('express');
const path    = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
const opsRouter         = require('./routes/ops');
const attachmentsRouter = require('./routes/attachments');
const activityRouter   = require('./routes/activity');
const usersRouter      = require('./routes/users');

app.use('/api/ops',        opsRouter);
app.use('/api/ops/:opId/attachments', attachmentsRouter);
app.use('/api/activity',   activityRouter);
app.use('/api/users',      usersRouter);
app.use('/api/auth',       usersRouter);  // /api/auth/me handled in usersRouter

// Fallback → SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Ops Tracker running at http://localhost:${PORT}\n`);
});
