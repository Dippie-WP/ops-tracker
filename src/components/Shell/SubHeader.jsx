/**
 * SubHeader — Breadcrumb + action buttons row.
 * Uses react-router-dom Link for navigation.
 */

import { Link, useLocation } from 'react-router-dom';

export default function SubHeader({ onNewOp, onExport, selectedCount }) {
  const location = useLocation();
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Derive breadcrumb from current path
  const path = location.pathname;

  let breadcrumb = null;
  if (path === '/') {
    breadcrumb = null; // Dashboard has no breadcrumb
  } else if (path.startsWith('/tasks/') && path.split('/').length > 2) {
    const parts = path.split('/');
    const opId = parts[2];
    breadcrumb = (
      <>
        <Link to="/" className="bc-link">Home</Link>
        <span className="bc-sep">›</span>
        <Link to="/tasks" className="bc-link">Tasks</Link>
        <span className="bc-sep">›</span>
        <span className="bc-current">{opId}</span>
      </>
    );
  } else if (path === '/tasks' || path.startsWith('/tasks/')) {
    const parts = path.split('/');
    let label = 'All Tasks';
    if (parts[2] === 'in-progress')  label = 'In Progress';
    if (parts[2] === 'standby')      label = 'Standby';
    if (parts[2] === 'completed')   label = 'Completed';
    if (parts[2] === 'overdue')     label = 'Overdue';
    if (parts[2] === 'my-tasks')    label = 'My Tasks';
    if (parts[2] === 'division')     label = `${parts[3]} Division`;
    breadcrumb = (
      <>
        <Link to="/" className="bc-link">Home</Link>
        <span className="bc-sep">›</span>
        <span className="bc-current">{label}</span>
      </>
    );
  } else if (path === '/library') {
    breadcrumb = (
      <>
        <Link to="/" className="bc-link">Home</Link>
        <span className="bc-sep">›</span>
        <span className="bc-current">Library</span>
      </>
    );
  } else if (path === '/reports') {
    breadcrumb = (
      <>
        <Link to="/" className="bc-link">Home</Link>
        <span className="bc-sep">›</span>
        <span className="bc-current">Reports</span>
      </>
    );
  }

  return (
    <div className="sub-header">
      <nav className="breadcrumb">
        {breadcrumb || (
          <>
            <Link to="/" className="bc-link">Home</Link>
            <span className="bc-sep">›</span>
            <span className="bc-current">Task Management</span>
          </>
        )}
      </nav>
      <div className="sub-header-actions">
        <span className="page-meta">Last sync: {now}</span>
        <button
          className="btn-outline"
          onClick={onExport}
          disabled={selectedCount === 0}
          title={selectedCount === 0 ? 'Select tasks to export' : `Export ${selectedCount} selected task${selectedCount > 1 ? 's' : ''} to PDF`}
        >
          ↓ Export{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
        <button className="btn-primary" onClick={onNewOp}>+ Create Task</button>
      </div>
    </div>
  );
}
