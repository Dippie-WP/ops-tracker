/* app.js — all UI logic. State is immutable outside setState(). */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
// RULE: never mutate `state` directly. Always call setState().
let state = {
  ops:          [],
  stats:        null,
  view:         'dashboard',
  listFilter:   '',
  searchQuery:  '',
  priorityFilter: '',
  drawer:       null,
  modal:        null,
  lightMode:    false,
  pendingFiles: [],
  nextOpId:     '',
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  updateClock();
  setInterval(updateClock, 30_000);
  bindEvents();

  // Restore light mode preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light');
    state = { ...state, lightMode: true };
  }

  // Set version
  const verEl = document.getElementById('sidebar-version');
  if (verEl) verEl.textContent = 'v' + APP_VERSION;

  await refresh();
}

async function refresh() {
  try {
    const [ops, stats] = await Promise.all([API.listOps(), API.getStats()]);
    setState({ ops, stats });
  } catch (err) {
    console.error('refresh failed:', err);
  }
}

function updateClock() {
  const el = document.getElementById('view-date');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).toUpperCase();

  const timeEl = document.getElementById('sidebar-time');
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderStats();
  renderCurrentView();
  renderDrawer();
  renderModal();
}

function renderStats() {
  if (!state.stats) return;
  const { byStatus, overdueCount } = state.stats;

  const total     = state.ops.length;
  const completed = (byStatus.find(s => s.status === 'completed') || {}).count || 0;
  const inProg    = (byStatus.find(s => s.status === 'in_progress') || {}).count || 0;

  qs('#stat-total .stat-value').textContent      = total;
  qs('#stat-inprogress .stat-value').textContent = inProg;
  qs('#stat-overdue .stat-value').textContent    = overdueCount;
  qs('#stat-completed .stat-value').textContent  = completed;
}

function renderCurrentView() {
  const views = ['dashboard', 'ops-list'];
  views.forEach(v => qs(`#view-${v}`).classList.toggle('hidden', v !== state.view));

  // Nav highlight
  qsa('.nav-item').forEach(btn => {
    const matches = btn.dataset.view === state.view &&
      (btn.dataset.filter || '') === state.listFilter;
    btn.classList.toggle('active', matches);
  });

  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'ops-list')  renderOpsList();
}

function renderDashboard() {
  const today = new Date(); today.setHours(0,0,0,0);
  const week  = new Date(today); week.setDate(week.getDate() + 7);

  const priority = state.ops.filter(o =>
    ['critical','high'].includes(o.priority) &&
    !['completed','cancelled'].includes(o.status)
  );

  const upcoming = state.ops.filter(o => {
    if (!o.planned_date || ['completed','cancelled'].includes(o.status)) return false;
    const d = new Date(o.planned_date + 'T00:00:00');
    return d >= today && d <= week;
  });

  qs('#dash-priority-list').innerHTML = priority.length
    ? priority.map(opCard).join('')
    : '<div class="empty-state">No critical/high priority ops active.</div>';

  qs('#dash-upcoming-list').innerHTML = upcoming.length
    ? upcoming.map(opCard).join('')
    : '<div class="empty-state">Nothing due in the next 7 days.</div>';
}

function renderOpsList() {
  let filtered = state.ops;

  if (state.listFilter)
    filtered = filtered.filter(o => o.status === state.listFilter);

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(o =>
      o.title.toLowerCase().includes(q) ||
      o.op_id.toLowerCase().includes(q) ||
      (o.description || '').toLowerCase().includes(q)
    );
  }

  if (state.priorityFilter)
    filtered = filtered.filter(o => o.priority === state.priorityFilter);

  const titles = {
    '': 'All Ops', pending: 'Pending', in_progress: 'In Progress',
    completed: 'Completed', cancelled: 'Cancelled',
  };
  qs('#list-title').textContent = titles[state.listFilter] || 'All Ops';

  const container = qs('#ops-list-container');
  const empty     = qs('#list-empty');

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    container.innerHTML = filtered.map(opCard).join('');
  }
}

// ── Op Card HTML ───────────────────────────────────────────────────────────
function opCard(op) {
  const today = new Date(); today.setHours(0,0,0,0);
  let dateStr = '', overdue = false;

  if (op.planned_date) {
    const d = new Date(op.planned_date + 'T00:00:00');
    overdue = d < today && !['completed','cancelled'].includes(op.status);
    dateStr = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
    if (overdue) dateStr = '⚠ ' + dateStr;
  }

  const attachTxt = op.attachment_count > 0
    ? `📎 ${op.attachment_count}`
    : '';

  const catBadge = op.category
    ? `<span class="meta-badge category-badge">${op.category.toUpperCase()}</span>`
    : '';

  return `<div class="op-card status-${op.status}"
    data-priority="${op.priority}"
    data-opid="${op.op_id}"
    onclick="openDrawer('${op.op_id}')">
    <div class="op-card-id">${op.op_id}</div>
    <div class="op-card-title">${esc(op.title)}</div>
    <div class="op-card-meta">
      ${attachTxt ? `<span class="op-card-attach">${attachTxt}</span>` : ''}
      ${catBadge}
      <span class="meta-badge priority-badge" data-p="${op.priority}">${op.priority.toUpperCase()}</span>
      <span class="meta-badge status-badge" data-s="${op.status}">${fmtStatus(op.status)}</span>
    </div>
    <div class="op-card-date${overdue ? ' overdue' : ''}">${dateStr}</div>
  </div>`;
}

// ── Drawer ─────────────────────────────────────────────────────────────────
function renderDrawer() {
  const overlay = qs('#drawer-overlay');
  const drawer  = qs('#drawer');

  if (!state.drawer) {
    overlay.classList.add('hidden');
    drawer.classList.add('hidden');
    return;
  }

  const op = state.ops.find(o => o.op_id === state.drawer);
  if (!op) { setState({ drawer: null }); return; }

  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');

  qs('#d-op-id').textContent  = op.op_id;
  qs('#d-title').textContent  = op.title;
  qs('#d-desc').textContent   = op.description || '—';

  const pBadge = qs('#d-priority');
  pBadge.textContent  = op.priority.toUpperCase();
  pBadge.dataset.p    = op.priority;

  const sBadge = qs('#d-status');
  sBadge.textContent  = fmtStatus(op.status);
  sBadge.dataset.s    = op.status;

  const catBadge = qs('#d-category');
  if (catBadge) {
    catBadge.textContent = op.category ? op.category.toUpperCase() : '—';
    catBadge.className = 'meta-badge category-badge';
  }

  const impBadge = qs('#d-impact');
  if (impBadge) {
    impBadge.textContent = (op.impact || 'medium').toUpperCase();
    impBadge.dataset.imp = op.impact;
  }

  const dateEl = qs('#d-date');
  if (op.planned_date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(op.planned_date + 'T00:00:00');
    const over = d < today && !['completed','cancelled'].includes(op.status);
    dateEl.textContent  = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    dateEl.className    = 'meta-date' + (over ? ' overdue' : '');
  } else {
    dateEl.textContent = 'No planned date';
    dateEl.className   = 'meta-date';
  }

  renderAttachments(op);
}

function renderAttachments(op) {
  // op.attachments may be undefined if we got the op from the list (no JOIN detail)
  // Fetch full detail only if needed
  if (!op._attachmentsLoaded) {
    API.getOp(op.op_id).then(full => {
      const ops = state.ops.map(o => o.op_id === full.op_id
        ? { ...full, _attachmentsLoaded: true }
        : o
      );
      setState({ ops });
    });
    qs('#d-attach-list').innerHTML = '<div class="empty-state">Loading…</div>';
    return;
  }

  const atts = op.attachments || [];
  if (atts.length === 0) {
    qs('#d-attach-list').innerHTML = '';
    return;
  }

  qs('#d-attach-list').innerHTML = atts.map(a => `
    <div class="attach-item" data-aid="${a.id}">
      <span class="attach-icon">${fileIcon(a.mime_type)}</span>
      <div class="attach-info">
        <div class="attach-name">${esc(a.original_name)}</div>
        <div class="attach-meta">${fmtBytes(a.size_bytes)} · ${fmtDate(a.uploaded_at)}</div>
      </div>
      <div class="attach-actions">
        <a class="attach-btn" href="${API.downloadUrl(op.op_id, a.id)}" download="${esc(a.original_name)}">↓</a>
        <button class="attach-btn del" onclick="deleteAttachment('${op.op_id}', ${a.id})">✕</button>
      </div>
    </div>
  `).join('');
}

async function openDrawer(opId) {
  setState({ drawer: opId });
}

// ── Modal ──────────────────────────────────────────────────────────────────
function renderModal() {
  const overlay = qs('#modal-overlay');
  if (!state.modal) { overlay.classList.add('hidden'); return; }

  overlay.classList.remove('hidden');
  qs('#modal-title').textContent = state.modal.mode === 'create' ? 'NEW OP' : 'EDIT OP';
  qs('#form-error').classList.add('hidden');

  if (state.modal.mode === 'edit') {
    const op = state.ops.find(o => o.op_id === state.modal.opId);
    if (op) {
      qs('#f-title').value    = op.title;
      qs('#f-desc').value     = op.description || '';
      qs('#f-priority').value = op.priority;
      qs('#f-status').value   = op.status;
      qs('#f-date').value     = op.planned_date || '';
      qs('#f-category').value = op.category || '';
      qs('#f-impact').value   = op.impact  || 'medium';
    }
  } else {
    qs('#f-title').value    = '';
    qs('#f-desc').value     = '';
    qs('#f-priority').value = 'medium';
    qs('#f-status').value   = 'pending';
    qs('#f-date').value     = '';
    qs('#f-category').value = '';
    qs('#f-impact').value   = 'medium';
    qs('#f-op-id').value     = state.nextOpId || '';
    qs('#modal-attach-list').innerHTML = '';
    setState({ pendingFiles: [] });
  }
}

// ── Events ─────────────────────────────────────────────────────────────────
function bindEvents() {
  // Sidebar nav
  qsa('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      setState({
        view: btn.dataset.view,
        listFilter: btn.dataset.filter || '',
        drawer: null,
      });
    });
  });

  // New op button
  qs('#btn-new-op').addEventListener('click', async () => {
    const nextId = await API.getNextOpId();
    qs('#f-op-id').value = nextId;
    setState({ modal: { mode: 'create' }, nextOpId: nextId, pendingFiles: [] });
  });

  // Drawer close
  qs('#drawer-close').addEventListener('click', () => setState({ drawer: null }));
  qs('#drawer-overlay').addEventListener('click', () => setState({ drawer: null }));

  // Drawer edit
  qs('#d-btn-edit').addEventListener('click', () => {
    setState({ modal: { mode: 'edit', opId: state.drawer } });
  });

  // Drawer delete
  qs('#d-btn-delete').addEventListener('click', async () => {
    if (!confirm('Delete this op? All attachments will be removed.')) return;
    await API.deleteOp(state.drawer);
    setState({ drawer: null });
    await refresh();
  });

  // Modal close / cancel
  qs('#modal-close').addEventListener('click',  () => setState({ modal: null }));
  qs('#modal-cancel').addEventListener('click', () => setState({ modal: null }));
  qs('#modal-overlay').addEventListener('click', e => {
    if (e.target === qs('#modal-overlay')) setState({ modal: null });
  });

  // Modal save
  qs('#modal-save').addEventListener('click', saveModal);

  // Search / filter
  qs('#search-input').addEventListener('input', e => {
    setState({ searchQuery: e.target.value });
  });
  qs('#filter-priority').addEventListener('change', e => {
    setState({ priorityFilter: e.target.value });
  });

  // Theme toggle
  qs('#theme-toggle').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    setState({ lightMode: isLight });
  });

  // File upload
  qs('#upload-zone').addEventListener('dragover', e => {
    e.preventDefault();
    qs('#upload-zone').style.borderColor = 'var(--accent)';
  });
  qs('#upload-zone').addEventListener('dragleave', () => {
    qs('#upload-zone').style.borderColor = '';
  });
  qs('#upload-zone').addEventListener('drop', async e => {
    e.preventDefault();
    qs('#upload-zone').style.borderColor = '';
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) await uploadFile(f);
  });
  qs('#file-input').addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    for (const f of files) await uploadFile(f);
    e.target.value = '';
  });

  // Modal file attachments
  qs('#btn-attach-add').addEventListener('click', () => {
    qs('#f-files').click();
  });
  qs('#f-files').addEventListener('change', e => {
    const files = Array.from(e.target.files);
    addPendingFiles(files);
    e.target.value = '';
  });
}

async function saveModal() {
  const title = qs('#f-title').value.trim();
  if (!title) {
    showFormError('Title is required.');
    return;
  }

  const fields = {
    title,
    description:  qs('#f-desc').value.trim(),
    priority:     qs('#f-priority').value,
    status:       qs('#f-status').value,
    planned_date: qs('#f-date').value || null,
    category:     qs('#f-category').value,
    impact:       qs('#f-impact').value,
  };

  try {
    if (state.modal.mode === 'create') {
      const op = await API.createOp(fields);
      for (const f of state.pendingFiles) {
        await API.uploadAttachment(op.op_id, f);
      }
    } else {
      await API.updateOp(state.modal.opId, fields);
    }
    setState({ modal: null, pendingFiles: [], nextOpId: '' });
    await refresh();
  } catch (err) {
    showFormError(err.message);
  }
}

function showFormError(msg) {
  const el = qs('#form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function uploadFile(file) {
  if (!state.drawer) return;
  const prog = qs('#upload-progress');
  prog.classList.remove('hidden');

  try {
    await API.uploadAttachment(state.drawer, file);
    // Reload op detail with attachments
    const full = await API.getOp(state.drawer);
    const ops = state.ops.map(o =>
      o.op_id === full.op_id ? { ...full, _attachmentsLoaded: true } : o
    );
    setState({ ops });
  } catch (err) {
    alert('Upload failed: ' + err.message);
  } finally {
    prog.classList.add('hidden');
  }
}

window.deleteAttachment = async function(opId, attId) {
  if (!confirm('Remove this attachment?')) return;
  try {
    await API.deleteAttachment(opId, attId);
    const full = await API.getOp(opId);
    const ops = state.ops.map(o =>
      o.op_id === full.op_id ? { ...full, _attachmentsLoaded: true } : o
    );
    setState({ ops });
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
};

// ── Modal file helpers ─────────────────────────────────────────────────────
function addPendingFiles(files) {
  const list = [...state.pendingFiles, ...files];
  setState({ pendingFiles: list });
  renderModalFiles();
}

function renderModalFiles() {
  const el = qs('#modal-attach-list');
  if (state.pendingFiles.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = state.pendingFiles.map((f, i) => `
    <div class="modal-attach-item">
      <span class="attach-icon">${fileIcon(f.type)}</span>
      <span class="attach-name">${esc(f.name)}</span>
      <span class="attach-size">${fmtBytes(f.size)}</span>
      <button type="button" class="attach-btn del" onclick="removePendingFile(${i})">✕</button>
    </div>
  `).join('');
}

window.removePendingFile = function(idx) {
  const list = state.pendingFiles.filter((_, i) => i !== idx);
  setState({ pendingFiles: list });
  renderModalFiles();
};

// ── Helpers ────────────────────────────────────────────────────────────────
function qs(sel)     { return document.querySelector(sel); }
function qsa(sel)    { return document.querySelectorAll(sel); }
function esc(str)    { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtStatus(s){ return s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
}
function fmtBytes(n) {
  if (n < 1024)         return n + ' B';
  if (n < 1024 * 1024)  return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
function fileIcon(mime) {
  if (mime.startsWith('image/'))       return '🖼';
  if (mime === 'application/pdf')      return '📄';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word'))           return '📝';
  if (mime.includes('zip') || mime.includes('tar')) return '🗜';
  return '📎';
}

// ── Start ──────────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0';
document.addEventListener('DOMContentLoaded', boot);
