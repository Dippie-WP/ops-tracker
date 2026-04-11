/**
 * Shell/Header.jsx — Top navigation bar.
 * Spec: §5.1 — Shell Header (52px fixed, SAP blue background)
 */

import { useState, useEffect } from 'react';
import useStore from '../../store';

const INITIALS = 'ZU';

export default function Header({ onCalendarOpen, onSettingsOpen }) {
  const [searchFocused, setSearchFocused] = useState(false);
  const setSearch = useStore(s => s.setSearch);
  const filters = useStore(s => s.filters);
  const fetchAll = useStore(s => s.fetchAll);
  const setFilter = useStore(s => s.setFilter);

  // Keyboard shortcut ⌘K / Ctrl+K to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="shell-header">
      {/* Left: Brand */}
      <div className="shell-brand" onClick={() => { setFilter({}, { push: false }); window.history.pushState({}, '', '/'); fetchAll(); }} style={{ cursor: 'pointer' }} title="Back to home">
        <span className="brand-logo">OPS TRACKER</span>
      </div>

      {/* Center: Global Search */}
      <div className={`shell-search${searchFocused ? ' focused' : ''}`}>
        <span className="search-icon">🔍</span>
        <input
          id="global-search"
          type="text"
          placeholder="Search tasks, OP IDs, people..."
          defaultValue={filters.search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        <kbd className="search-kbd">⌘K</kbd>
      </div>

      {/* Right: Icons + Avatar */}
      <div className="shell-actions">
        <button className="shell-icon-btn" title="Calendar (due tasks)" onClick={onCalendarOpen}>📅</button>
        <button className="shell-icon-btn" title="Settings" onClick={onSettingsOpen}>⚙️</button>
        <div className="user-avatar" title="Zun">{INITIALS}</div>
      </div>
    </header>
  );
}
