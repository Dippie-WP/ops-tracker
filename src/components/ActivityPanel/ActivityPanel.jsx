/**
 * ActivityPanel/ActivityPanel.jsx — Activity log sidebar.
 * Spec: §6.6 — 260px fixed panel, filter chips, timeline entries.
 *
 * Data source: GET /api/activity (fetched on load + filter change)
 */

import useStore from '../../store';

const FILTER_CHIPS = ['All', 'Status', 'Priority', 'Comment'];

const TYPE_STYLES = {
  STATUS_CHANGE:   { bg: '#dbeafe', text: '#1d4ed8' },
  PRIORITY_CHANGE:{ bg: '#fffbeb', text: '#d97706' },
  COMMENTED:      { bg: '#ede9fe', text: '#7c3aed' },
  CREATED:        { bg: '#dcfce7', text: '#16a34a' },
  ASSIGNED:       { bg: '#fef2f2', text: '#dc2626' },
  FIELDS_CHANGED: { bg: '#f8fafc', text: '#64748b' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ActivityPanel() {
  const activityType  = useStore(s => s.filters.activityType);
  const setActivityTypeFilter = useStore(s => s.setActivityTypeFilter);
  const activity      = useStore(s => s.activity);
  const tasks        = useStore(s => s.tasks);
  const isLoadingActivity = useStore(s => s.isLoadingActivity);

  const activeChip = activityType || 'All';

  const filtered = activity.filter(a => {
    if (activeChip === 'All')    return true;
    if (activeChip === 'Status')   return a.type === 'STATUS_CHANGE';
    if (activeChip === 'Priority') return a.type === 'PRIORITY_CHANGE';
    if (activeChip === 'Comment')  return a.type === 'COMMENTED';
    return true;
  });

  return (
    <aside className="activity-panel">
      {/* Header */}
      <div className="activity-header">
        <span className="activity-title">Activity Log</span>
        <span className="badge badge-primary">{activity.length}</span>
      </div>

      {/* Filter Chips */}
      <div className="activity-filters">
        {FILTER_CHIPS.map(chip => {
          const chipKey = chip === 'All' ? null : chip.toUpperCase().replace(' ', '_');
          return (
            <button
              key={chip}
              className={`filter-chip${activeChip === (chipKey || null) ? ' active' : ''}`}
              onClick={() => setActivityTypeFilter(chipKey)}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Entries */}
      <div className="activity-feed">
        {isLoadingActivity ? (
          <div className="activity-loading">
            {[1,2,3].map(i => (
              <div key={i} className="activity-skeleton">
                <div className="skel-circle" />
                <div className="skel-lines">
                  <div className="skel-line" />
                  <div className="skel-line short" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="activity-empty">No activity yet</div>
        ) : (
          filtered.map(entry => {
            const typeStyle = TYPE_STYLES[entry.type] || TYPE_STYLES.FIELDS_CHANGED;
            const initials  = entry.user_initials || entry.user_name?.[0] || '?';
            const task = tasks.find(t =>
              String(t.id) === String(entry.task_id) || t.op_id === entry.op_number
            );

            return (
              <div key={entry.id} className="activity-entry">
                <div
                  className="entry-avatar"
                  style={{ background: typeStyle.bg, color: typeStyle.text }}
                >
                  {initials}
                </div>
                <div className="entry-content">
                  <div className="entry-display">
                    {entry.display}
                  </div>
                  {task && (
                    <div
                      className="entry-task-link"
                      onClick={() => useStore.getState().selectTask(task.op_id)}
                    >
                      {task.op_id} · {task.title}
                    </div>
                  )}
                  <div className="entry-time">
                    {timeAgo(entry.timestamp)}
                    {entry.comment && (
                      <span className="entry-comment"> — {entry.comment}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
