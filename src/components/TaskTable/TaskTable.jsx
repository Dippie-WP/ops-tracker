/**
 * TaskTable/TaskTable.jsx — Main ops table.
 * Spec: §6.1 Task Table — 7 columns + checkbox, sortable.
 */

import { useState } from 'react';
import useStore from '../../store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const PRIORITY_COLORS = {
  critical: { dot: '#dc2626', bg: '#fef2f2', text: '#dc2626' },
  high:     { dot: '#d97706', bg: '#fffbeb', text: '#d97706' },
  medium:   { dot: '#2563eb', bg: '#eff6ff', text: '#2563eb' },
  low:      { dot: '#64748b', bg: '#f8fafc', text: '#64748b' },
};

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

function fmtStatus(s) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const COLS = [
  { id: '_checkbox_',  label: '',            width: 40,  sortable: false },
  { id: 'op_id',        label: 'OP ID',       width: 110, sortable: true  },
  { id: 'title',        label: 'TASK',        width: null, sortable: true },
  { id: 'priority',     label: 'PRIORITY',    width: 100, sortable: true },
  { id: 'status',       label: 'STATUS',      width: 110, sortable: true },
  { id: 'division',     label: 'DIVISION',    width: 100, sortable: true },
  { id: 'planned_date', label: 'DUE DATE',    width: 100, sortable: true },
  { id: '_actions_',    label: '',            width: 48,  sortable: false },
];

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="table-row skeleton-row">
      <div className="td" style={{ width: '40px', minWidth: '40px' }} />
      <div className="td" style={{ width: '110px', minWidth: '110px' }}>
        <div className="skel skel-opid" />
      </div>
      <div className="td" style={{ flex: 2, minWidth: '120px' }}>
        <div className="skel skel-title" />
        <div className="skel skel-subtitle" />
      </div>
      <div className="td" style={{ width: '100px', minWidth: '100px' }}>
        <div className="skel skel-badge" />
      </div>
      <div className="td" style={{ width: '110px', minWidth: '110px' }}>
        <div className="skel skel-badge" />
      </div>
      <div className="td" style={{ width: '100px', minWidth: '100px' }}>
        <div className="skel skel-chip" />
      </div>
      <div className="td" style={{ width: '100px', minWidth: '100px' }}>
        <div className="skel skel-date" />
      </div>
      <div className="td" style={{ width: '48px', minWidth: '48px' }} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriorityTag({ priority }) {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.low;
  return (
    <span className="tag tag-priority" style={{ background: c.bg, color: c.text }}>
      <span className="tag-dot" style={{ background: c.dot }} />
      {priority?.toUpperCase()}
    </span>
  );
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.standby;
  return (
    <span className="pill" style={{ background: s.bg, color: s.text }}>
      {fmtStatus(status)}
    </span>
  );
}

function DivisionChip({ division }) {
  const d = DIVISION_STYLES[division] || DIVISION_STYLES.lab;
  return (
    <span className="chip" style={{ background: d.bg, color: d.text }}>
      {d.icon} {division?.toUpperCase()}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskTable({ onTaskSelect }) {
  const filters          = useStore(s => s.filters);
  const sort             = useStore(s => s.sort);
  const setSort          = useStore(s => s.setSort);
  const getFilteredTasks = useStore(s => s.getFilteredTasks);
  const isLoading        = useStore(s => s.isLoading);
  const selectedTaskIds  = useStore(s => s.selectedTaskIds);
  const toggleTask       = useStore(s => s.toggleTask);
  const selectAllTasks   = useStore(s => s.selectAllTasks);
  const clearSelection   = useStore(s => s.clearSelection);

  const tasks = getFilteredTasks();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const allVisible = tasks.length > 0 && tasks.every(t => selectedTaskIds.includes(t.op_id));
  const someSelected = tasks.some(t => selectedTaskIds.includes(t.op_id));

  const handleSort = (field) => {
    if (!field || field === '_checkbox_' || field === '_actions_') return;
    const newOrder = sort.field === field && sort.order === 'asc' ? 'desc' : 'asc';
    setSort(field, newOrder);
  };

  const handleSelectAll = () => {
    if (allVisible) {
      clearSelection();
    } else {
      selectAllTasks(tasks.map(t => t.op_id));
    }
  };

  const copyOpId = (opId, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(opId).catch(() => {});
  };

  return (
    <div className="task-table-wrapper">
      {/* Priority Legend Strip */}
      <div className="priority-legend">
        {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
          <span key={p} className="legend-item">
            <span className="tag-dot" style={{ background: c.dot }} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="task-table">
        {/* Header */}
        <div className="table-header">
          {COLS.map(col => {
            if (col.id === '_checkbox_') {
              return (
                <div key={col.id} className="th th-checkbox" style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}>
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={allVisible}
                    ref={el => { if (el) el.indeterminate = someSelected && !allVisible; }}
                    onChange={handleSelectAll}
                    title={allVisible ? 'Deselect all' : 'Select all'}
                  />
                </div>
              );
            }
            return (
              <div
                key={col.id}
                className={`th${sort.field === col.id ? ' sorted' : ''}${col.sortable ? ' sortable' : ''}`}
                style={{
                  width: col.width ? `${col.width}px` : undefined,
                  flex: col.width ? 'none' : 1,
                  minWidth: col.width ? `${col.width}px` : '80px',
                }}
                onClick={() => col.sortable && handleSort(col.id)}
              >
                {col.label}
                {col.sortable && (
                  <span className="sort-icon">
                    {sort.field === col.id ? (sort.order === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Skeleton rows during initial load */}
        {isLoading && tasks.length === 0 ? (
          <>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </>
        ) : tasks.length === 0 ? (
          <div className="table-empty">
            <div className="empty-state">No tasks match your filters</div>
            <button
              className="btn-outline"
              onClick={() => useStore.getState().setFilter({ status: null, division: null, search: '' })}
            >
              Clear filters
            </button>
          </div>
        ) : (
          tasks.map(op => {
            const isOverdue = op.planned_date &&
              !['completed', 'cancelled'].includes(op.status) &&
              new Date(op.planned_date) < today;
            const checked = selectedTaskIds.includes(op.op_id);

            return (
              <div
                key={op.op_id}
                className={`table-row${checked ? ' selected' : ''}`}
                onClick={() => onTaskSelect?.(op.op_id)}
              >
                {/* Checkbox */}
                <div className="td td-checkbox" style={{ width: '40px', minWidth: '40px' }}
                  onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="row-checkbox"
                    checked={checked}
                    onChange={() => toggleTask(op.op_id)}
                  />
                </div>

                {/* OP ID */}
                <div className="td td-opid" style={{ width: '110px', minWidth: '110px' }}>
                  <span
                    className="op-id"
                    title="Click to copy OP number"
                    onClick={(e) => copyOpId(op.op_id, e)}
                  >
                    {op.op_id}
                  </span>
                </div>

                {/* Title */}
                <div className="td td-task" style={{ flex: 2, minWidth: '120px' }}>
                  <span className="task-title" title={op.title}>{esc(op.title)}</span>
                  <span className="task-updated">{relativeTime(op.updated_at)}</span>
                </div>

                {/* Priority */}
                <div className="td" style={{ width: '100px', minWidth: '100px' }}>
                  <PriorityTag priority={op.priority} />
                </div>

                {/* Status */}
                <div className="td" style={{ width: '110px', minWidth: '110px' }}>
                  <StatusPill status={op.status} />
                </div>

                {/* Division */}
                <div className="td" style={{ width: '100px', minWidth: '100px' }}>
                  <DivisionChip division={op.division} />
                </div>

                {/* Due Date */}
                <div className={`td td-date${isOverdue ? ' overdue' : ''}`} style={{ width: '100px', minWidth: '100px' }}>
                  {op.planned_date ? (
                    isOverdue ? (
                      <span className="overdue-date">⚠ {fmtDate(op.planned_date)}</span>
                    ) : (
                      fmtDate(op.planned_date)
                    )
                  ) : '—'}
                </div>

                {/* Actions */}
                <div className="td td-actions" style={{ width: '48px', minWidth: '48px' }}
                  onClick={e => e.stopPropagation()}>
                  <button className="row-action-btn" title="More actions">⋮</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="table-footer">
        {tasks.length} of {useStore.getState().tasks.length} ops
        {selectedTaskIds.length > 0 && (
          <span className="sel-count"> · {selectedTaskIds.length} selected</span>
        )}
        {' · '}Sorted by {sort.field} {sort.order === 'asc' ? '↑' : '↓'}
      </div>
    </div>
  );
}
