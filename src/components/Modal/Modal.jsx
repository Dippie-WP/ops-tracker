/**
 * Modal/Modal.jsx — Create / Edit task modal.
 * Spec: §5.1 — "+ Create Task" button opens creation modal.
 */

import { useState, useEffect, useRef } from 'react';
import useStore from '../../store';
import api from '../../api/client';

const VALID_STATUSES   = ['standby', 'in_progress', 'completed', 'cancelled'];
const VALID_DIVISIONS  = ['lab', 'databyte', 'home'];
const VALID_CATEGORIES = ['infrastructure', 'software', 'security', 'networking', 'documentation', 'other'];
const DEFAULT_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const DEFAULT_IMPACTS    = ['high', 'medium', 'low'];

function getCustomTypes(key, defaults) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaults;
  } catch { return defaults; }
}

export default function Modal({ task, onClose }) {
  const isEdit        = Boolean(task);
  const createTask    = useStore(s => s.createTask);
  const updateTask    = useStore(s => s.updateTask);
  const [error, setError] = useState(null);
  const [customPriorities, setCustomPriorities] = useState(() => getCustomTypes('priority_types', DEFAULT_PRIORITIES));
  const [customImpacts,   setCustomImpacts]   = useState(() => getCustomTypes('impact_types',    DEFAULT_IMPACTS));
  const [saving, setSaving] = useState(false);
  const [nextOpId, setNextOpId] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef();

  useEffect(() => {
    if (!isEdit) {
      api.getNextOpId().then(id => setNextOpId(id)).catch(() => {});
    }
  }, [isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const form = e.target;
    const fields = {
      title:        form.f_title.value.trim(),
      description:  (form.f_desc.value || '').trim(),
      status:       form.f_status.value,
      priority:     form.f_priority.value,
      planned_date: form.f_date.value || null,
      category:     form.f_category.value,
      impact:       form.f_impact.value,
      division:     form.f_division.value,
    };

    if (!fields.title) { setError('Title is required.'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateTask(task.op_id, fields);
      } else {
        const created = await createTask(fields);
        // Upload pending files
        for (const f of pendingFiles) {
          await api.uploadAttachment(created.op_id, f);
        }
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    setPendingFiles([...pendingFiles, ...Array.from(e.target.files)]);
    e.target.value = '';
  };

  const removeFile = (i) => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i));

  const fileIcon = (f) => {
    if (f.type?.startsWith('image/')) return '🖼';
    if (f.type === 'application/pdf') return '📄';
    return '📎';
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'EDIT OP' : 'NEW OP'}</span>
          {nextOpId && !isEdit && <span className="modal-opid-badge">{nextOpId}</span>}
          {isEdit && task?.op_id && <span className="modal-opid-badge">{task.op_id}</span>}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Form */}
        <form className="modal-form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="f_title">Title *</label>
            <input id="f_title" name="f_title" type="text" required defaultValue={task?.title || ''} placeholder="Operation title..." />
          </div>

          <div className="form-group">
            <label htmlFor="f_desc">Description</label>
            <textarea id="f_desc" name="f_desc" rows={3} defaultValue={task?.description || ''} placeholder="Detailed description..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="f_priority">Priority</label>
              <select id="f_priority" name="f_priority" defaultValue={task?.priority || 'medium'}>
                {customPriorities.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="f_status">Status</label>
              <select id="f_status" name="f_status" defaultValue={task?.status || 'standby'}>
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="f_division">Division</label>
              <select id="f_division" name="f_division" defaultValue={task?.division || 'lab'}>
                {VALID_DIVISIONS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="f_date">Due Date</label>
              <input id="f_date" name="f_date" type="date" defaultValue={task?.planned_date || ''} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="f_category">Category</label>
              <select id="f_category" name="f_category" defaultValue={task?.category || ''}>
                <option value="">—</option>
                {VALID_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="f_impact">Impact</label>
              <select id="f_impact" name="f_impact" defaultValue={task?.impact || 'medium'}>
                {customImpacts.map(i => <option key={i} value={i}>{i.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {/* File upload (create mode only) */}
          {!isEdit && (
            <div className="form-group">
              <label>Attachments</label>
              <div
                className="upload-zone"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '';
                  setPendingFiles([...pendingFiles, ...Array.from(e.dataTransfer.files)]);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                Drop files here or click to browse
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
              {pendingFiles.length > 0 && (
                <div className="pending-files">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="pending-file">
                      <span>{fileIcon(f)} {f.name}</span>
                      <button type="button" className="del" onClick={() => removeFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create OP'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
