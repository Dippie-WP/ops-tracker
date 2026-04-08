'use strict';

const express = require('express');
const path    = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
const opsRouter         = require('./routes/ops');
const attachmentsRouter = require('./routes/attachments');

app.use('/api/ops', opsRouter);
app.use('/api/ops/:opId/attachments', attachmentsRouter);

// Fallback → SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Ops Tracker running at http://localhost:${PORT}\n`);
});
