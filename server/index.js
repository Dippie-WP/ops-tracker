'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ─── Version ──────────────────────────────────────────────────────────────────
const pkg    = require('../package.json');
const VERSION = pkg.version || '1.0.0';
const START  = Date.now();

// ─── DB path ─────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'ops.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const dbOk = fs.existsSync(DB_PATH);
  res.json({
    ok:      true,
    version: VERSION,
    uptime:  Math.floor((Date.now() - START) / 1000) + 's',
    db:      dbOk ? 'accessible' : 'missing',
    dbPath:  DB_PATH,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
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

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT    = process.env.PORT    || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('┌─────────────────────────────────────────┐');
console.log('│  Ops Tracker                             │');
console.log(`│  Version  : ${VERSION.padEnd(32)}│`);
console.log(`│  Port     : ${String(PORT).padEnd(32)}│`);
console.log(`│  Node Env : ${NODE_ENV.padEnd(32)}│`);
console.log(`│  DB Path  : ${DB_PATH.padEnd(32)}│`);
console.log(`│  Data Dir : ${DATA_DIR.padEnd(32)}│`);
console.log('└─────────────────────────────────────────┘');

app.listen(PORT, () => {
  console.log(`  Listening on http://localhost:${PORT}\n`);
});
