/**
 * App.jsx — Root component with React Router.
 *
 * ORIGINAL layout (pre-routing):
 *   app (flex column, 100vh)
 *     header (52px)
 *     app-body (flex column)
 *       SubHeader
 *       main-content (flex row, fills remaining height)
 *         sidebar (145px) ← contains nav + KPI tiles
 *         content-area (task table)
 *         activity-panel (260px)
 *     overlays (drawer, modal, etc.)
 *
 * NEW layout with routing:
 *   sidebar is pulled out of main-content → becomes nav-only
 *   KPI tiles live inside the Dashboard route only
 *   Routes replace only the task table / content inside content-area
 */

import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useStore, { urlToFilters } from './store';
import Header           from './components/Shell/Header';
import Sidebar          from './components/Sidebar/Sidebar';
import SubHeader        from './components/Shell/SubHeader';
import ActivityPanel    from './components/ActivityPanel/ActivityPanel';
import KPITiles         from './components/KPITiles/KPITiles';
import TaskTable        from './components/TaskTable/TaskTable';
import Drawer           from './components/Drawer/Drawer';
import Modal            from './components/Modal/Modal';
import CalendarDropdown from './components/Calendar/CalendarDropdown';
import SettingsPanel    from './components/Settings/SettingsPanel';
import TaskDetail       from './pages/TaskDetail';
import MyTasksPage      from './pages/MyTasksPage';
import Library          from './pages/Library';
import Reports          from './pages/Reports';
import './App.css';

export default function App() {
  const fetchAll   = useStore(s => s.fetchAll);
  const fetchTasks = useStore(s => s.fetchTasks);
  const bootstrap  = useStore(s => s.bootstrap);
  const selectTask = useStore(s => s.selectTask);
  const clearError = useStore(s => s.clearError);
  const selectedTaskIds = useStore(s => s.selectedTaskIds);
  const tasks      = useStore(s => s.tasks);
  const setFilter  = useStore(s => s.setFilter);

  const [showModal,    setShowModal]    = useState(false);
  const [editTask,     setEditTask]    = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Boot: restore theme + URL filters
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const urlFilters = urlToFilters();
    useStore.setState({ filters: urlFilters });
    bootstrap().then(() => fetchTasks(urlFilters));
  }, [bootstrap]);

  // Back/forward browser buttons sync to store
  useEffect(() => {
    const onPop = () => {
      const f = urlToFilters();
      useStore.setState({ filters: f, page: 1 });
      fetchAll();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fetchAll]);

  // 30-second polling
  useEffect(() => {
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleTaskSelect = (opId) => selectTask(opId);
  const handleEditTask   = (task) => {
    selectTask(null);
  };
  const handleNewOp     = () => { setEditTask(null); setShowModal(true); };
  const handleDrawerClose = () => selectTask(null);

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
  }

  const handleExport = () => {
    const sel = tasks.filter(t => selectedTaskIds.includes(t.op_id));
    if (!sel.length) return;
    const rows = sel.map(t => `
      <div class="task-page">
        <div class="task-header">
          <span class="task-opid">${t.op_id}</span>
          <span class="task-priority priority-${t.priority}">${t.priority?.toUpperCase()}</span>
          <span class="task-status status-${t.status}">${(t.status||'').replace(/_/g,' ')}</span>
        </div>
        <h2 class="task-title">${esc(t.title||'')}</h2>
        <table class="task-table">
          <tr><th>Division</th><td>${t.division||'—'}</td></tr>
          <tr><th>Category</th><td>${t.category||'—'}</td></tr>
          <tr><th>Impact</th><td>${t.impact||'—'}</td></tr>
          <tr><th>Due Date</th><td>${t.planned_date||'—'}</td></tr>
          <tr><th>Created</th><td>${t.created_at?new Date(t.created_at).toLocaleDateString('en-GB'):'—'}</td></tr>
          <tr><th>Updated</th><td>${t.updated_at?new Date(t.updated_at).toLocaleDateString('en-GB'):'—'}</td></tr>
        </table>
        ${t.description?`<div class="task-desc"><h3>Description</h3><p>${esc(t.description)}</p></div>`:''}
      </div>`).join('');
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Ops Export</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;color:#111}
      .task-page{page-break-after:always;padding:20mm 15mm}.task-page:last-child{page-break-after:avoid}
      .task-header{display:flex;align-items:center;gap:8px;margin-bottom:12pt}.task-opid{font-weight:bold;font-size:11pt;color:#1b59b7}
      .task-priority{padding:2pt 6pt;border-radius:3pt;font-size:9pt;font-weight:bold}.priority-critical{background:#fee2e2;color:#dc2626}
      .priority-high{background:#fef3c7;color:#d97706}.priority-medium{background:#dbeafe;color:#2563eb}.priority-low{background:#f1f5f9;color:#64748b}
      .task-status{padding:2pt 6pt;border-radius:3pt;font-size:9pt;text-transform:capitalize}.status-standby{background:#f8fafc;color:#64748b}
      .status-in_progress{background:#dbeafe;color:#1d4ed8}.status-completed{background:#dcfce7;color:#16a34a}.status-cancelled{background:#f1f5f9;color:#94a3b8}
      h2.task-title{font-size:16pt;font-weight:bold;margin-bottom:12pt}table.task-table{width:100%;border-collapse:collapse;margin-bottom:12pt}
      table.task-table th,table.task-table td{text-align:left;padding:4pt 6pt;border-bottom:0.5pt solid #e5e7eb;font-size:10pt}
      table.task-table th{color:#6b7280;font-weight:normal;width:30%}.task-desc{margin-top:8pt}
      .task-desc h3{font-size:10pt;color:#6b7280;margin-bottom:4pt}.task-desc p{font-size:10pt;white-space:pre-wrap;line-height:1.5}
      @page{size:A4 portrait;margin:12mm}
    </style></head><body>${rows}</body></html>`;
    const win = window.open('','_blank');
    win.document.write(html); win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* ── Header (52px, always visible) ─────────────────────────────── */}
        <Header
          onCalendarOpen={() => setShowCalendar(v => !v)}
          onSettingsOpen={() => setShowSettings(v => !v)}
        />

        {/* ── Body: SubHeader + sidebar/content row ───────────────────────── */}
        <div className="app-body">
          {/* SubHeader — breadcrumb + actions, full width of content area */}
          <SubHeader onNewOp={handleNewOp} onExport={handleExport} selectedCount={selectedTaskIds.length} />

          {/* Main row: sidebar (nav) + route content + activity panel */}
          <div className="main-content">
            {/* Sidebar — pure navigation, pulled OUT of routes */}
            <Sidebar />

            {/* Routed content area — KPI tiles always visible + route content */}
            <div className="content-area">
              {/* KPI tiles — always visible on every page */}
              <KPITiles />
              <Routes>
                {/* Dashboard / filtered task list */}
                <Route path="/" element={
                  <TaskTable onTaskSelect={handleTaskSelect} />
                } />
                <Route path="/tasks" element={
                  <TaskTable onTaskSelect={handleTaskSelect} />
                } />
                <Route path="/tasks/:filterType" element={
                  <TaskTable onTaskSelect={handleTaskSelect} />
                } />
                <Route path="/tasks/:filterType/:filterValue" element={
                  <TaskTable onTaskSelect={handleTaskSelect} />
                } />
                {/* Task detail — full page */}
                <Route path="/tasks/:opId" element={
                  <TaskDetail />
                } />
                {/* My Tasks — separate page for logged-in user */}
                <Route path="/my-tasks" element={
                  <MyTasksPage />
                } />
                {/* Library */}
                <Route path="/library" element={
                  <Library />
                } />
                {/* Reports */}
                <Route path="/reports" element={
                  <Reports />
                } />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

            {/* Activity panel — always visible, right side */}
            <ActivityPanel />
          </div>
        </div>

        {/* ── Global overlays ─────────────────────────────────────────────── */}
        <Drawer onClose={handleDrawerClose} onEdit={(task) => { /* edit → open modal */ setEditTask(task); setShowModal(true); }} />
        {showModal && (
          <Modal task={editTask} onClose={() => { setShowModal(false); setEditTask(null); }} />
        )}
        {showCalendar && <CalendarDropdown onClose={() => setShowCalendar(false)} />}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
    </BrowserRouter>
  );
}
