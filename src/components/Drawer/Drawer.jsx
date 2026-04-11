/**
 * Drawer/Drawer.jsx — Task detail side panel.
 * Spec: §5.1 Task Management View — drawer slides in from right when task selected.
 */

import useStore from '../../store';

const PRIORITY_COLORS = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#64748b',
};
const STATUS_STYLES = {
  pending: { bg: '#f8fafc', text: '#64748b' },
  in_progress: { bg: '#dbeafe', text: '#1d4ed8' },
  review: { bg: '#ede9fe', text: '#7c3aed' },
  completed: { bg: '#dcfce7', text: '#16a34a' },
  cancelled: { bg: '#f1f5f9', text: '#94a3b8' },
};
const DIV_CHIP = {
  lab: { bg: '#eff6ff', text: '#1d4ed8', icon: '🔬' },
  databyte: { bg: '#f0fdf4', text: '#15803d', icon: '💾' },
  home: { bg: '#fefce8', text: '#a16207', icon: '🏠' },
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileIcon(mime) {
  if (mime?.startsWith('image/')) return '🖼';
  if (mime === 'application/pdf') return '📄';
  return '📎';
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Drawer({ onClose, onEdit }) {
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const tasks           = useStore(s => s.tasks);
  const deleteTask      = useStore(s => s.deleteTask);

  const task = tasks.find(t => t.op_id === selectedTaskId);

  if (!selectedTaskId || !task) return null;

  const today = new Date(); today.setHours(0,0,0,0);
  const dueDate = task.planned_date ? new Date(task.planned_date) : null;
  const isOverdue = dueDate && !['completed','cancelled'].includes(task.status) && dueDate < today;

  const div = DIV_CHIP[task.division] || DIV_CHIP.lab;
  const st  = STATUS_STYLES[task.status] || STATUS_STYLES.pending;

  const handleDelete = async () => {
    if (!confirm(`Delete ${task.op_id}? All attachments will be removed.`)) return;
    await deleteTask(task.op_id);
    onClose();
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        {/* Header */}
        <div className="drawer-header">
          <span className="drawer-opid">{task.op_id}</span>
          <div className="drawer-header-actions">
            <button className="drawer-btn" onClick={() => onEdit(task)}>✎ Edit</button>
            <button className="drawer-btn danger" onClick={handleDelete}>✕ Delete</button>
            <button className="drawer-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          <h2 className="drawer-title">{task.title}</h2>
          {task.description && <p className="drawer-desc">{task.description}</p>}

          {/* Meta grid */}
          <div className="drawer-meta">
            <div className="meta-row">
              <span className="meta-label">Priority</span>
              <span className="meta-value" style={{ color: PRIORITY_COLORS[task.priority] }}>
                ● {task.priority?.toUpperCase()}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="pill" style={{ background: st.bg, color: st.text }}>
                {task.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Division</span>
              <span className="chip" style={{ background: div.bg, color: div.text }}>
                {div.icon} {task.division?.toUpperCase()}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Due Date</span>
              <span className={`meta-value${isOverdue ? ' overdue' : ''}`}>
                {task.planned_date ? fmtDate(task.planned_date) : '—'}
              </span>
            </div>
            {task.category && (
              <div className="meta-row">
                <span className="meta-label">Category</span>
                <span className="meta-value">{task.category}</span>
              </div>
            )}
            {task.impact && (
              <div className="meta-row">
                <span className="meta-label">Impact</span>
                <span className="meta-value">{task.impact.toUpperCase()}</span>
              </div>
            )}
          </div>

          {/* Attachments */}
          {task.attachments?.length > 0 && (
            <div className="drawer-section">
              <div className="section-label">Attachments ({task.attachments.length})</div>
              {task.attachments.map(att => (
                <div key={att.id} className="attach-item">
                  <span className="attach-icon">{fileIcon(att.mime_type)}</span>
                  <div className="attach-info">
                    <div className="attach-name">{att.original_name}</div>
                    <div className="attach-meta">{fmtBytes(att.size_bytes)} · {att.uploaded_at ? fmtDate(att.uploaded_at) : ''}</div>
                  </div>
                  <div className="attach-actions">
                    <a className="attach-btn" href={`/api/ops/${task.op_id}/attachments/${att.id}/download`} download={att.original_name} title="Download">↓</a>
                    <button className="attach-btn del" title="Delete">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
