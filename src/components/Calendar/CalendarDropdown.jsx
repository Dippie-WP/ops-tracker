/**
 * CalendarDropdown — Mini calendar showing due-task counts per day.
 * Click a day to filter tasks by planned_date.
 * Click outside to close.
 */

import { useState, useEffect, useRef } from 'react';
import useStore from '../../store';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toISO(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export default function CalendarDropdown({ onClose }) {
  const tasks = useStore(s => s.tasks);
  const filters = useStore(s => s.filters);
  const setFilter = useStore(s => s.setFilter);
  const fetchAll = useStore(s => s.fetchAll);
  const ref = useRef();

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const activeDate = filters.planned_date || null;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Count tasks per day
  const dueByDay = {};
  tasks.forEach(t => {
    if (!t.planned_date) return;
    const d = t.planned_date.slice(0, 10);
    dueByDay[d] = (dueByDay[d] || 0) + 1;
  });

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y-1); setMonth(11); }
    else setMonth(m => m-1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y+1); setMonth(0); }
    else setMonth(m => m+1);
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const date = toISO(year, month, day);
    setFilter({ ...filters, planned_date: date }, { push: true });
    fetchAll();
    onClose();
  };

  const handleClear = () => {
    const { planned_date, ...rest } = filters;
    setFilter(rest, { push: true });
    fetchAll();
    onClose();
  };

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="cal-dropdown" ref={ref}>
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <span className="cal-title">{MONTHS[month]} {year}</span>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>

      {/* Day labels */}
      <div className="cal-grid cal-days-header">
        {DAYS.map(d => <span key={d}>{d}</span>)}
      </div>

      {/* Day cells */}
      <div className="cal-grid cal-days">
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const dateStr = toISO(year, month, day);
          const count = dueByDay[dateStr] || 0;
          const isToday = dateStr === todayISO;
          const isActive = dateStr === activeDate;
          return (
            <button
              key={dateStr}
              className={`cal-day${isToday ? ' today' : ''}${isActive ? ' active' : ''}${count > 0 ? ' has-due' : ''}`}
              onClick={() => handleDayClick(day)}
              title={count > 0 ? `${count} task${count>1?'s':''} due` : ''}
            >
              {day}
              {count > 0 && <span className="cal-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="cal-footer">
        {activeDate && (
          <button className="cal-clear" onClick={handleClear}>
            Clear date filter
          </button>
        )}
        {!activeDate && (
          <span className="cal-hint">Click a day with a badge to filter</span>
        )}
      </div>
    </div>
  );
}
