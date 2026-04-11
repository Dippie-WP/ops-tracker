/**
 * Sidebar/Sidebar.jsx — Left navigation panel with react-router-dom NavLink.
 * Each section is collapsible. Active item highlighted.
 */

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState({});

  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  function Nav({ to, children, end }) {
    return (
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) => `nav-item${isActive ? ' nav-active' : ''}`}
      >
        {children}
      </NavLink>
    );
  }

  return (
    <aside className="sidebar">
      {/* Workplace */}
      <div className="nav-group">
        <button className="nav-group-header" onClick={() => toggle('workplace')}>
          <span>Workplace</span>
          <span className="chevron">{collapsed.workplace ? '›' : '‹'}</span>
        </button>
        {!collapsed.workplace && (
          <div className="nav-group-items">
            <Nav to="/tasks" end>All Tasks</Nav>
            <Nav to="/tasks/my-tasks">My Tasks</Nav>
            <Nav to="/tasks/in-progress">In Progress</Nav>
            <Nav to="/tasks/pending">Pending</Nav>
            <Nav to="/tasks/completed">Completed</Nav>
            <Nav to="/tasks/overdue">🔴 Overdue</Nav>
          </div>
        )}
      </div>

      {/* Divisions */}
      <div className="nav-group">
        <button className="nav-group-header" onClick={() => toggle('divisions')}>
          <span>Divisions</span>
          <span className="chevron">{collapsed.divisions ? '›' : '‹'}</span>
        </button>
        {!collapsed.divisions && (
          <div className="nav-group-items">
            <Nav to="/division/lab">🔬 Lab</Nav>
            <Nav to="/division/databyte">💾 Databyte</Nav>
            <Nav to="/division/home">🏠 Home</Nav>
          </div>
        )}
      </div>

      {/* System */}
      <div className="nav-group">
        <button className="nav-group-header" onClick={() => toggle('system')}>
          <span>System</span>
          <span className="chevron">{collapsed.system ? '›' : '‹'}</span>
        </button>
        {!collapsed.system && (
          <div className="nav-group-items">
            <Nav to="/" end>📊 Dashboard</Nav>
            <Nav to="/library">📁 Library</Nav>
            <Nav to="/reports">📋 Reports</Nav>
          </div>
        )}
      </div>
    </aside>
  );
}
