/**
 * SubHeader — Breadcrumb + action buttons row.
 * Uses store filters for dynamic breadcrumb, URL for special routes.
 */

import { Link, useLocation } from 'react-router-dom';
import useStore from '../../store';

const STATUS_LABELS = {
  in_progress: 'In Progress',
  standby:    'Standby',
  completed:  'Completed',
  cancelled:  'Cancelled',
  overdue:    'Overdue',
};

export default function SubHeader({ onNewOp, onExport, selectedCount }) {
  const location = useLocation();
  const filters  = useStore(s => s.filters);
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const path = location.pathname;

  // Derive breadcrumb from store filters (for sidebar-driven filter state)
  // This takes priority over URL for home-page filters
  function buildBreadcrumb() {
    if (path !== '/') return null; // Use URL-based for non-home routes

    if (filters.status && STATUS_LABELS[filters.status]) {
      return (
        <>
          <Link to="/" className="bc-link">Home</Link>
          <span className="bc-sep">›</span>
          <span className="bc-current">{STATUS_LABELS[filters.status]}</span>
        </>
      );
    }
    if (filters.division) {
      const div = filters.division.charAt(0).toUpperCase() + filters.division.slice(1);
      return (
        <>
          <Link to="/" className="bc-link">Home</Link>
          <span className="bc-sep">›</span>
          <span className="bc-current">{div} Division</span>
        </>
      );
    }
    if (filters.assigned_to) {
      return (
        <>
          <Link to="/" className="bc-link">Home</Link>
          <span className="bc-sep">›</span>
          <span className="bc-current">My Tasks</span>
        </>
      );
    }
    return null; // Home with no filters — just "Home"
  }

  let breadcrumb = null;
  if (path === '/') {
    breadcrumb = buildBreadcrumb();
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
    if (parts[2] === 'cancelled')    label = 'Cancelled';
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
