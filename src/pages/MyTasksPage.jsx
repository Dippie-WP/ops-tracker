/**
 * MyTasksPage.jsx — Tasks assigned to the logged-in user (ZU).
 * Lives at /my-tasks — separate route, full page inside app shell.
 * Fetches via API (assigned_to=zu), filters client-side to active statuses.
 */

import { useEffect, useState } from 'react';
import api from '../api/client';

const ACTIVE_STATUSES = new Set(['in_progress', 'standby', 'overdue']);

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_STYLES = {
  standby:     { bg: '#f8fafc', text: '#64748b' },
  in_progress: { bg: '#dbeafe', text: '#1d4ed8' },
  review:      { bg: '#ede9fe', text: '#7c3aed' },
  completed:   { bg: '#dcfce7', text: '#16a34a' },
  cancelled:   { bg: '#f1f5f9', text: '#94a3b8' },
};

const DIVISION_STYLES = {
  lab:      { bg: '#eff6ff', text: '#1d4ed8', icon: '🔬' },
  databyte: { bg: '#f0fdf4', text: '#15803d', icon: '💾' },
  home:     { bg: '#fefce8', text: '#a16207', icon: '🏠' },
};

const PRIORITY_COLORS = {
  critical: { dot: '#dc2626' },
  high:     { dot: '#d97706' },
  medium:   { dot: '#2563eb' },
  low:      { dot: '#64748b' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api.listOps({ params: { assigned_to: 'zu' } })
      .then(data => {
        const active = (Array.isArray(data) ? data : data.tasks || []).filter(t => ACTIVE_STATUSES.has(t.status));
        setTasks(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="task-table-wrapper"><div style={{padding:'20px',color:'#64748b'}}>Loading my tasks…</div></div>;
  }

  return (
    <div className="task-table-wrapper">
      <div style={{ padding: '8px 16px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid #e5e7eb' }}>
        MY TASKS — {tasks.length} active
      </div>
      <div className="task-table">
        {/* Header */}
        <div className="table-header">
          <div className="th" style={{ width: '110px', minWidth: '110px' }}>OP ID</div>
          <div className="th" style={{ flex: 1, minWidth: '120px' }}>TASK</div>
          <div className="th" style={{ width: '100px', minWidth: '100px' }}>PRIORITY</div>
          <div className="th" style={{ width: '110px', minWidth: '110px' }}>STATUS</div>
          <div className="th" style={{ width: '100px', minWidth: '100px' }}>DIVISION</div>
          <div className="th" style={{ width: '100px', minWidth: '100px' }}>DUE DATE</div>
        </div>
        {tasks.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
            No active tasks assigned to you.
          </div>
        )}
        {tasks.map(task => {
          const ps = STATUS_STYLES[task.status] || STATUS_STYLES.standby;
          const ds = DIVISION_STYLES[task.division] || DIVISION_STYLES.lab;
          const pcs = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
          return (
            <div
              key={task.op_id}
              className={`table-row${selectedId === task.op_id ? ' selected' : ''}`}
              onClick={() => setSelectedId(task.op_id)}
            >
              <div className="td" style={{ width: '110px', minWidth: '110px', fontFamily: 'monospace', fontSize: '12px' }}>
                <span style={{ color: '#1b59b7', fontWeight: 600 }}>{task.op_id}</span>
              </div>
              <div className="td" style={{ flex: 1, minWidth: '120px' }}>
                <span style={{ fontWeight: 500, fontSize: '13px' }}>{esc(task.title || '')}</span>
              </div>
              <div className="td" style={{ width: '100px', minWidth: '100px' }}>
                <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pcs.dot, display: 'inline-block' }} />
                  {task.priority?.toUpperCase()}
                </span>
              </div>
              <div className="td" style={{ width: '110px', minWidth: '110px' }}>
                <span className="pill" style={{ background: ps.bg, color: ps.text, fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                  {task.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="td" style={{ width: '100px', minWidth: '100px' }}>
                <span style={{ fontSize: '11px', background: ds.bg, color: ds.text, padding: '2px 6px', borderRadius: '3px' }}>
                  {ds.icon} {task.division?.toUpperCase()}
                </span>
              </div>
              <div className="td" style={{ width: '100px', minWidth: '100px', fontSize: '12px', color: '#64748b' }}>
                {fmtDate(task.planned_date)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
