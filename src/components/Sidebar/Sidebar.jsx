/**
 * Sidebar/Sidebar.jsx — Left navigation panel.
 * Uses useNavigate() + useLocation() for active highlighting.
 * Sections: Workplace | Divisions | System
 */

import { useLocation, useNavigate } from 'react-router-dom';
import useStore from '../../store';

const ITEMS = [
  { section: 'Workplace', items: [
    { label: 'All Tasks',    icon: '📋', path: '/',                          filter: {} },
    { label: 'My Tasks',     icon: '👤', path: '/my-tasks',                     filter: {} },
    { label: 'In Progress',  icon: '🔵', path: '/tasks/in-progress',   filter: { status: 'in_progress' } },
    { label: 'Standby',       icon: '🟡', path: '/tasks/standby',        filter: { status: 'standby' } },
    { label: 'Completed',     icon: '🟢', path: '/tasks/completed',      filter: { status: 'completed' } },
    { label: 'Cancelled',     icon: '⚪', path: '/tasks/cancelled',      filter: { status: 'cancelled' } },
    { label: 'Overdue',       icon: '🔴', path: '/tasks/overdue',       filter: { status: 'overdue' } },
  ]},
  { section: 'Divisions', items: [
    { label: 'Lab',      icon: '🔬', path: '/',  filter: { division: 'lab' } },
    { label: 'Home',     icon: '🏠', path: '/',  filter: { division: 'home' } },
    { label: 'Databyte', icon: '💾', path: '/',  filter: { division: 'databyte' } },
  ]},
  { section: 'System', items: [
    { label: 'Dashboard',    icon: '📊', path: '/',                           filter: {} },
    { label: 'Library',      icon: '📁', path: '/library',                    filter: {} },
    { label: 'Reports',       icon: '📑', path: '/reports',                   filter: {} },
  ]},
];

export default function Sidebar() {
  const location = useLocation();
  const setFilter = useStore(s => s.setFilter);
  const fetchTasks = useStore(s => s.fetchTasks);
  const clearFilters = useStore(s => s.clearFilters);

  const navigate = useNavigate();

  const filters = useStore(s => s.filters);

  function isActive(item) {
    if (item.path !== '/') return location.pathname.startsWith(item.path);
    if (location.pathname !== '/') return false;
    // At /: only one sidebar item should be active at a time
    const fi = item.filter || {};
    const keys = Object.keys(fi);
    if (keys.length === 0) {
      // 'All Tasks' — active only when NO filters set
      return Object.keys(filters).length === 0;
    }
    // Division/status items — active when filter matches exactly
    return keys.every(k => filters[k] === fi[k]);
  }

  function handleClick(item) {
    if (item.path === '/') {
      navigate('/');
      if (Object.keys(item.filter).length > 0) {
        setFilter(item.filter, { push: false });
        fetchTasks(item.filter);
      } else {
        clearFilters();
      }
      return;
    }
    navigate(item.path);
    setFilter(item.filter, { push: false });
    fetchTasks(item.filter);
  }

  return (
    <aside className="sidebar">
      {ITEMS.map(section => (
        <div key={section.section} className="nav-group">
          <div className="nav-section-label">{section.section}</div>
          {section.items.map(item => (
            <div
              key={item.label}
              className={`nav-item${isActive(item) ? ' nav-active' : ''}`}
              onClick={() => handleClick(item)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
