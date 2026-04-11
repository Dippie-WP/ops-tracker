/**
 * SettingsPanel — Right-side panel for user profile, theme, and custom types.
 */

import { useState, useEffect } from 'react';
import useStore from '../../store';

const DEFAULT_PRIORITIES = ['critical','high','medium','low'];
const DEFAULT_IMPACTS    = ['high','medium','low'];

function getCustom(key, defaults) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaults;
  } catch { return defaults; }
}

function saveCustom(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function SettingsPanel({ onClose }) {
  const currentUser = useStore(s => s.currentUser);

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Custom types
  const [priorities, setPriorities] = useState(() => getCustom('priority_types', DEFAULT_PRIORITIES));
  const [impacts,    setImpacts]    = useState(() => getCustom('impact_types',    DEFAULT_IMPACTS));

  // New type inputs
  const [newPriority, setNewPriority] = useState('');
  const [newImpact,   setNewImpact]   = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const addPriority = () => {
    const val = newPriority.trim().toLowerCase();
    if (!val || priorities.includes(val)) return;
    const next = [...priorities, val];
    setPriorities(next);
    saveCustom('priority_types', next);
    setNewPriority('');
  };

  const removePriority = (val) => {
    if (DEFAULT_PRIORITIES.includes(val)) return; // can't remove defaults
    const next = priorities.filter(p => p !== val);
    setPriorities(next);
    saveCustom('priority_types', next);
  };

  const addImpact = () => {
    const val = newImpact.trim().toLowerCase();
    if (!val || impacts.includes(val)) return;
    const next = [...impacts, val];
    setImpacts(next);
    saveCustom('impact_types', next);
    setNewImpact('');
  };

  const removeImpact = (val) => {
    if (DEFAULT_IMPACTS.includes(val)) return;
    const next = impacts.filter(i => i !== val);
    setImpacts(next);
    saveCustom('impact_types', next);
  };

  const divisions = ['lab','network','iot','security','telecom'];

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">
        {/* Header */}
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">

          {/* ── User Profile ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">User Profile</h3>
            <div className="settings-field">
              <label>Name</label>
              <input type="text" value={currentUser?.name || ''} readOnly className="settings-input" />
            </div>
            <div className="settings-field">
              <label>Initials</label>
              <input type="text" value={currentUser?.initials || ''} readOnly className="settings-input" style={{width:60}} />
            </div>
            <div className="settings-field">
              <label>Email</label>
              <input type="text" value={currentUser?.email || ''} readOnly className="settings-input" />
            </div>
            <div className="settings-field">
              <label>Division</label>
              <select className="settings-input" value={currentUser?.division || ''} readOnly>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </section>

          {/* ── Appearance ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            <div className="settings-row">
              <span>Dark mode</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                <span className="toggle-slider" />
              </label>
            </div>
          </section>

          {/* ── Priority Types ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Priority Types</h3>
            <div className="settings-tags">
              {priorities.map(p => (
                <span key={p} className="settings-tag">
                  {p}
                  {!DEFAULT_PRIORITIES.includes(p) && (
                    <button className="tag-remove" onClick={() => removePriority(p)}>✕</button>
                  )}
                </span>
              ))}
            </div>
            <div className="settings-add-row">
              <input
                type="text"
                placeholder="New priority..."
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPriority()}
                className="settings-input"
              />
              <button className="settings-btn" onClick={addPriority}>Add</button>
            </div>
          </section>

          {/* ── Impact Types ── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Impact Types</h3>
            <div className="settings-tags">
              {impacts.map(i => (
                <span key={i} className="settings-tag">
                  {i}
                  {!DEFAULT_IMPACTS.includes(i) && (
                    <button className="tag-remove" onClick={() => removeImpact(i)}>✕</button>
                  )}
                </span>
              ))}
            </div>
            <div className="settings-add-row">
              <input
                type="text"
                placeholder="New impact..."
                value={newImpact}
                onChange={e => setNewImpact(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addImpact()}
                className="settings-input"
              />
              <button className="settings-btn" onClick={addImpact}>Add</button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
