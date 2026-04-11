/**
 * Dashboard.jsx — Home page. KPI tiles + recent activity.
 * KPI tiles are clickable → navigate to filtered task view.
 */

import { Link } from 'react-router-dom';
import useStore from '../store';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const PRIORITY_COLORS = {
  critical: { dot: '#dc2626', bg: '#fef2f2', text: '#dc2626' },
  high:     { dot: '#d97706', bg: '#fffbeb', text: '#d97706' },
  medium:   { dot: '#2563eb', bg: '#eff6ff', text: '#2563eb' },
  low:      { dot: '#64748b', bg: '#f8fafc', text: '#64748b' },
};

export default function Dashboard() {
  const tasks = useStore(s => s.tasks);

  const total      = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending    = tasks.filter(t => t.status === 'standby').length;
  const completed  = tasks.filter(t => t.status === 'completed').length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(t =>
    t.planned_date &&
    !['completed','cancelled'].includes(t.status) &&
    new Date(t.planned_date) < today
  ).length;

  const recent = [...tasks]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 8);

  const kpis = [
    { label: 'Total Tasks',   value: total,      color: '#1b59b7', to: '/tasks'              },
    { label: 'In Progress',   value: inProgress, color: '#1d4ed8', to: '/tasks/in-progress'   },
    { label: 'Standby',       value: pending,    color: '#d97706', to: '/tasks/standby'        },
    { label: 'Overdue',       value: overdue,    color: '#dc2626', to: '/tasks/overdue'        },
  ];

  return (
    <div className="dashboard">
      {/* KPI Tiles */}
      <div className="kpi-row">
        {kpis.map(k => (
          <Link key={k.to} to={k.to} className="kpi-tile-link">
            <div className="kpi-tile" style={{ '--kpi-color': k.color }}>
              <span className="kpi-value">{k.value}</span>
              <span className="kpi-label">{k.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Tasks */}
      <div className="dashboard-section">
        <h2 className="section-title">Recent Activity</h2>
        {recent.length === 0 ? (
          <div className="empty-state">No tasks yet</div>
        ) : (
          <div className="recent-list">
            {recent.map(t => {
              const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.low;
              return (
                <Link key={t.op_id} to={`/tasks/${t.op_id}`} className="recent-item">
                  <div className="recent-left">
                    <span className="recent-opid">{t.op_id}</span>
                    <span className="recent-title">{t.title}</span>
                  </div>
                  <div className="recent-right">
                    <span
                      className="tag-dot"
                      style={{ background: pc.dot, display: 'inline-block', width: 8, height: 8, borderRadius: '50%' }}
                    />
                    <span className="recent-date">{fmtDate(t.updated_at?.slice(0, 10))}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Link to="/tasks" className="view-all-link">View all tasks →</Link>
      </div>
    </div>
  );
}
