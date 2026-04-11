/**
 * TaskDetail.jsx — Full page view for a single task.
 * Shows all task fields + attachments + activity log.
 * Edit button → navigates to edit mode (Modal opens).
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useStore from '../store';
import api from '../api/client';
import Modal from '../components/Modal/Modal';

const PRIORITY_COLORS = {
  critical: { dot: '#dc2626', bg: '#fef2f2', text: '#dc2626' },
  high:     { dot: '#d97706', bg: '#fffbeb', text: '#d97706' },
  medium:   { dot: '#2563eb', bg: '#eff6ff', text: '#2563eb' },
  low:      { dot: '#64748b', bg: '#f8fafc', text: '#64748b' },
};

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default function TaskDetail() {
  const { opId } = useParams();
  const navigate = useNavigate();
  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const fetchAll = useStore(s => s.fetchAll);

  useEffect(() => {
    setLoading(true);
    api.getOpByOpId(opId)
      .then(data => { setTask(data.data || data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [opId]);

  if (loading) return <div className="page-loading">Loading task...</div>;
  if (error)   return <div className="page-error">Error: {error}</div>;
  if (!task)    return <div className="page-error">Task not found</div>;

  const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;

  const rows = [
    ['OP ID',       task.op_id],
    ['Title',       task.title],
    ['Status',      task.status?.replace(/_/g,' ')],
    ['Priority',    task.priority],
    ['Division',    task.division],
    ['Category',    task.category],
    ['Impact',      task.impact],
    ['Due Date',    task.planned_date || '—'],
    ['Created',    task.created_at ? new Date(task.created_at).toLocaleDateString('en-GB') : '—'],
    ['Updated',    task.updated_at ? new Date(task.updated_at).toLocaleDateString('en-GB') : '—'],
  ];

  return (
    <div className="task-detail-page">
      {/* Breadcrumb */}
      <div className="td-breadcrumb">
        <Link to="/tasks" className="td-back-link">← Back to Tasks</Link>
      </div>

      {/* Header */}
      <div className="td-header">
        <div className="td-header-left">
          <span className="td-opid">{task.op_id}</span>
          <span
            className="td-priority-tag"
            style={{ background: pc.bg, color: pc.text }}
          >
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background: pc.dot }} />
            {task.priority?.toUpperCase()}
          </span>
          <span className={`td-status-pill status-${task.status}`}>
            {(task.status||'').replace(/_/g,' ')}
          </span>
        </div>
        <div className="td-header-right">
          <button className="btn-primary" onClick={() => setShowEdit(true)}>Edit Task</button>
        </div>
      </div>

      {/* Title */}
      <h1 className="td-title">{task.title}</h1>

      {/* Info table */}
      <div className="td-section">
        <table className="td-info-table">
          <tbody>
            {rows.filter(([,v]) => v && v !== '—').map(([k,v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Description */}
      {task.description && (
        <div className="td-section">
          <h3 className="td-section-title">Description</h3>
          <p className="td-description">{esc(task.description)}</p>
        </div>
      )}

      {/* Attachments count */}
      <div className="td-section">
        <h3 className="td-section-title">Attachments</h3>
        <p className="td-attachments-count">
          {task.attachment_count > 0
            ? `${task.attachment_count} attachment${task.attachment_count > 1 ? 's' : ''}`
            : 'No attachments'}
        </p>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal
          task={task}
          onClose={() => { setShowEdit(false); fetchAll(); }}
        />
      )}
    </div>
  );
}
