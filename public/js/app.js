/* app.js — ops tracker UI. State is immutable outside setState(). */
'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0';

// Column definitions for the ops grid
const COL_DEFS = [
  { id: 'op_id',      label: 'OP ID',       width: 120,  visible: true,  sortable: true },
  { id: 'title',      label: 'TITLE',      width: 200,   visible: true,  sortable: true },
  { id: 'category',   label: 'CATEGORY',    width: 120,  visible: true,  sortable: true },
  { id: 'impact',     label: 'IMPACT',       width: 100,  visible: true,  sortable: true },
  { id: 'status',     label: 'STATUS',       width: 110,  visible: true,  sortable: true },
  { id: 'priority',   label: 'PRIORITY',     width: 100,  visible: true,  sortable: true },
  { id: 'planned_date', label: 'PLANNED',   width: 110,  visible: true,  sortable: true },
  { id: 'attachment_count', label: 'ATT',  width: 60,   visible: true,  sortable: false },
];

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  ops:           [],
  stats:         null,
  view:          'dashboard',
  listFilter:    '',
  searchQuery:   '',
  priorityFilter:'',
  statusFilter:  '',
  drawer:        null,
  modal:         null,
  darkMode:      false,
  pendingFiles:  [],
  nextOpId:      '',
  // Column grid state
  colState:      null,   // { columns: [...], sortCol: 'op_id', sortDir: 'asc' }
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
  loadColState();

  // Restore dark mode preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    state = { ...state, darkMode: true };
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

// ── Column State (localStorage) ────────────────────────────────────────────
function loadColState() {
  try {
    const saved = localStorage.getItem('ops-col-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new columns
      const columns = COL_DEFS.map(def => {
        const s = parsed.columns.find(c => c.id === def.id);
        return s ? { ...def, ...s } : { ...def };
      });
      state.colState = { columns, sortCol: parsed.sortCol || 'op_id', sortDir: parsed.sortDir || 'asc' };
    } else {
      state.colState = {
        columns: COL_DEFS.map(c => ({ ...c })),
        sortCol: 'op_id',
        sortDir: 'asc',
      };
    }
  } catch {
    state.colState = {
      columns: COL_DEFS.map(c => ({ ...c })),
      sortCol: 'op_id',
      sortDir: 'asc',
    };
  }
}

function saveColState() {
  try {
    localStorage.setItem('ops-col-state', JSON.stringify(state.colState));
  } catch {}
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

  qsa('.nav-item').forEach(btn => {
    const matches = btn.dataset.view === state.view &&
      (btn.dataset.filter || '') === state.listFilter;
    btn.classList.toggle('active', matches);
  });

  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'ops-list')  renderOpsGrid();
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

// ── Ops Grid (sortable column table) ────────────────────────────────────────
function renderOpsGrid() {
  const { colState } = state;
  if (!colState) return;

  let filtered = [...state.ops];

  // Apply filters
  if (state.listFilter)
    filtered = filtered.filter(o => o.status === state.listFilter);

  const sq = (state.searchQuery || qs('#grid-search-input')?.value || '').toLowerCase();
  if (sq) {
    filtered = filtered.filter(o =>
      o.title.toLowerCase().includes(sq) ||
      o.op_id.toLowerCase().includes(sq) ||
      (o.description || '').toLowerCase().includes(sq)
    );
  }

  const pf = state.priorityFilter || qs('#grid-filter-priority')?.value || '';
  if (pf) filtered = filtered.filter(o => o.priority === pf);

  const sf = state.statusFilter || qs('#grid-filter-status')?.value || '';
  if (sf) filtered = filtered.filter(o => o.status === sf);

  // Sort
  const { sortCol, sortDir } = colState;
  filtered.sort((a, b) => {
    let va = a[sortCol] ?? '';
    let vb = b[sortCol] ?? '';
    if (sortCol === 'planned_date') {
      va = va ? new Date(va) : new Date('9999');
      vb = vb ? new Date(vb) : new Date('9999');
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const visibleCols = colState.columns.filter(c => c.visible);
  const grid = qs('#ops-grid');
  // Set grid template so header and body columns align
  const templateCols = visibleCols.map(c => c.width ? `${c.width}px` : '1fr').join(' ');
  grid.style.gridTemplateColumns = templateCols;

  // Build header
  let headerHTML = '<div class="ops-grid-header">';
  for (const col of visibleCols) {
    const isSorted = colState.sortCol === col.id;
    const sortIcon = isSorted
      ? (sortDir === 'asc' ? '↑' : '↓')
      : '↕';
    const dragHandle = col.sortable
      ? '<span class="col-drag-handle" title="Drag to reorder">⋮⋮</span>'
      : '';
    headerHTML += `<div class="ops-grid-header-cell${isSorted ? ' sorted' : ''}"
      data-col="${col.id}"
      data-width="${col.width}"
      style="${col.width ? `width:${col.width}px;min-width:${col.width}px` : ''}"
      title="${col.sortable ? 'Click to sort' : ''}">
      ${dragHandle}
      ${col.label}
      <span class="sort-icon">${col.sortable ? sortIcon : ''}</span>
    </div>`;
  }
  headerHTML += '</div>';
  grid.innerHTML = headerHTML;

  // Build rows
  for (const op of filtered) {
    const today = new Date(); today.setHours(0,0,0,0);
    let dateStr = '', overdue = false;
    if (op.planned_date) {
      const d = new Date(op.planned_date + 'T00:00:00');
      overdue = d < today && !['completed','cancelled'].includes(op.status);
      dateStr = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
    }

    let rowHTML = `<div class="ops-grid-row" data-opid="${op.op_id}" onclick="openDrawer('${op.op_id}')">`;
    for (const col of visibleCols) {
      let content = '';
      let extraClass = '';
      let style = col.width ? `width:${col.width}px;min-width:${col.width}px` : '';

      switch (col.id) {
        case 'op_id':
          content = `<span class="op-card-id">${op.op_id}</span>`;
          extraClass = 'opid-cell';
          style = (col.width ? `width:${col.width}px;min-width:${col.width}px` : '') + ';font-weight:600';
          break;
        case 'title':
          content = esc(op.title);
          extraClass = 'title-cell';
          break;
        case 'category':
          content = op.category
            ? `<span class="badge category-badge">${op.category.toUpperCase()}</span>`
            : '—';
          extraClass = 'cat-cell';
          break;
        case 'impact':
          content = `<span class="badge impact-badge" data-imp="${op.impact || 'medium'}">${(op.impact || 'medium').toUpperCase()}</span>`;
          extraClass = 'impact-cell';
          break;
        case 'status':
          content = `<span class="badge status-badge" data-s="${op.status}">${fmtStatus(op.status)}</span>`;
          extraClass = 'status-cell';
          break;
        case 'priority':
          content = `<span class="badge priority-badge" data-p="${op.priority}">${op.priority.toUpperCase()}</span>`;
          extraClass = 'priority-cell';
          break;
        case 'planned_date':
          content = overdue ? `<span class="overdue">⚠ ${dateStr}</span>` : dateStr;
          extraClass = 'date-cell' + (overdue ? ' overdue' : '');
          break;
        case 'attachment_count':
          content = op.attachment_count > 0 ? `📎 ${op.attachment_count}` : '—';
          extraClass = 'attach-cell';
          style = (col.width ? `width:${col.width}px;min-width:${col.width}px` : '') + ';justify-content:center';
          break;
      }
      rowHTML += `<div class="ops-grid-cell ${extraClass}" style="${style}">${content}</div>`;
    }
    rowHTML += '</div>';
    grid.innerHTML += rowHTML;
  }

  // Update title
  const titles = {
    '': 'ALL OPS', pending: 'PENDING', in_progress: 'IN PROGRESS',
    completed: 'COMPLETED', cancelled: 'CANCELLED',
  };
  qs('#list-title').textContent = titles[state.listFilter] || 'ALL OPS';

  // Footer
  qs('#grid-footer').textContent =
    `${filtered.length} of ${state.ops.length} ops · Sorted by ${colState.sortCol} ${colState.sortDir === 'asc' ? '↑' : '↓'}`;

  // Bind header click for sort
  qsa('.ops-grid-header-cell').forEach(cell => {
    cell.addEventListener('click', e => {
      if (e.target.classList.contains('col-drag-handle')) return;
      const colId = cell.dataset.col;
      const { sortCol, sortDir } = state.colState;
      const newDir = sortCol === colId && sortDir === 'asc' ? 'desc' : 'asc';
      state.colState = { ...state.colState, sortCol: colId, sortDir: newDir };
      saveColState();
      renderOpsGrid();
    });
  });
}

// ── Op Card (dashboard) ────────────────────────────────────────────────────
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
    ? `<span class="op-card-attach">📎 ${op.attachment_count}</span>`
    : '';

  const catBadge = op.category
    ? `<span class="badge category-badge">${op.category.toUpperCase()}</span>`
    : '';

  return `<div class="op-card status-${op.status}"
    data-priority="${op.priority}"
    data-opid="${op.op_id}"
    onclick="openDrawer('${op.op_id}')">
    <div class="op-card-id">${op.op_id}</div>
    <div class="op-card-title">${esc(op.title)}</div>
    <div class="op-card-meta">
      ${attachTxt}
      ${catBadge}
      <span class="badge priority-badge" data-p="${op.priority}">${op.priority.toUpperCase()}</span>
      <span class="badge status-badge" data-s="${op.status}">${fmtStatus(op.status)}</span>
    </div>
    <div class="op-card-date${overdue ? ' overdue' : ''}">${dateStr}</div>
  </div>`;
}

// ── Drawer ──────────────────────────────────────────────────────────────────
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
    catBadge.className = 'badge category-badge';
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

function openDrawer(opId) {
  setState({ drawer: opId });
}

// ── Modal ──────────────────────────────────────────────────────────────────
function renderModal() {
  const overlay = qs('#modal-overlay');
  if (!state.modal) { overlay.classList.add('hidden'); return; }

  overlay.classList.remove('hidden');
  qs('#modal-title').textContent = state.modal.mode === 'create' ? 'NEW OP' : 'EDIT OP';
  qs('#form-error').classList.add('hidden');

  // Op ID badge in header
  const badge = qs('#modal-op-id-badge');
  if (state.modal.mode === 'create' && state.nextOpId) {
    badge.textContent = state.nextOpId;
    badge.style.display = '';
  } else if (state.modal.mode === 'edit') {
    const op = state.ops.find(o => o.op_id === state.modal.opId);
    badge.textContent = op ? op.op_id : '';
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

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
    qs('#modal-attach-list').innerHTML = '';
    setState({ pendingFiles: [] });
  } else {
    qs('#f-title').value    = '';
    qs('#f-desc').value     = '';
    qs('#f-priority').value = 'medium';
    qs('#f-status').value   = 'pending';
    qs('#f-date').value     = '';
    qs('#f-category').value = '';
    qs('#f-impact').value   = 'medium';
    qs('#modal-attach-list').innerHTML = '';
    setState({ pendingFiles: [] });
  }

  renderModalFiles();
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

  // Dashboard search / filter
  qs('#search-input').addEventListener('input', e => {
    setState({ searchQuery: e.target.value });
    if (state.view === 'ops-list') renderOpsGrid();
  });
  qs('#filter-priority').addEventListener('change', e => {
    setState({ priorityFilter: e.target.value });
    if (state.view === 'ops-list') renderOpsGrid();
  });

  // Grid toolbar search/filter (live)
  qs('#grid-search-input')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    renderOpsGrid();
  });
  qs('#grid-filter-priority')?.addEventListener('change', e => {
    state.priorityFilter = e.target.value;
    renderOpsGrid();
  });
  qs('#grid-filter-status')?.addEventListener('change', e => {
    state.statusFilter = e.target.value;
    renderOpsGrid();
  });

  // Column visibility toggle
  qs('#col-toggle-btn').addEventListener('click', e => {
    e.stopPropagation();
    qs('#col-toggle-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => {
    qs('#col-toggle-menu')?.classList.remove('open');
  });

  // Build column toggle menu
  buildColToggleMenu();

  // Theme toggle
  qs('#theme-toggle').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setState({ darkMode: isDark });
  });

  // File upload (drawer)
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

  // Modal attachment: label-for trick handles opening file picker (no JS needed)
  // Change event: add files to pending and reset input so same file can be re-selected
  qs('#f-files').addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if (files.length) addPendingFiles(files);
    e.target.value = '';  // reset so same file can be picked again
  });
}

function buildColToggleMenu() {
  const menu = qs('#col-toggle-menu');
  if (!state.colState) return;
  menu.innerHTML = state.colState.columns.map(col => `
    <label class="col-toggle-item">
      <input type="checkbox" data-col="${col.id}" ${col.visible ? 'checked' : ''} />
      ${col.label}
    </label>
  `).join('');

  menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const colId = cb.dataset.col;
      const columns = state.colState.columns.map(c =>
        c.id === colId ? { ...c, visible: cb.checked } : c
      );
      state.colState = { ...state.colState, columns };
      saveColState();
      renderOpsGrid();
      buildColToggleMenu();
    });
  });
}

// ── Save Modal ───────────────────────────────────────────────────────────────
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

// ── File Upload (drawer) ────────────────────────────────────────────────────
async function uploadFile(file) {
  if (!state.drawer) return;
  const prog = qs('#upload-progress');
  prog.classList.remove('hidden');
  try {
    await API.uploadAttachment(state.drawer, file);
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
  // renderModalFiles() called automatically by render() → renderModal()
};

// ── Helpers ────────────────────────────────────────────────────────────────
function qs(sel)     { return document.querySelector(sel); }
function qsa(sel)    { return document.querySelectorAll(sel); }
function esc(str)    { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtStatus(s){ return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
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
document.addEventListener('DOMContentLoaded', boot);
