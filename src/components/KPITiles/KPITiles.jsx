/**
 * KPITiles/KPITiles.jsx — Four KPI metric tiles.
 * Spec: §6.2 KPI Tile — derived from filtered task dataset.
 *
 * Tiles (colour accent bars, large count, label, progress bar):
 * - Total Tasks   (blue)
 * - In Progress  (orange)
 * - Overdue      (red)
 * - Completed    (green)
 */

import useStore from '../../store';

function KPITile({ accent, label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="kpi-tile" style={{ '--accent': accent }}>
      <div className="kpi-accent-bar" style={{ background: accent }} />
      <div className="kpi-count">{count}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-progress-track">
        <div className="kpi-progress-fill" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

export default function KPITiles() {
  const getStats = useStore(s => s.getStats);
  const { total, inProgress, overdue, completed } = getStats();

  return (
    <div className="kpi-grid">
      <KPITile accent="#0070f3" label="Total Tasks"   count={total}      total={total}     />
      <KPITile accent="#f59e0b" label="In Progress"   count={inProgress}  total={total}     />
      <KPITile accent="#ef4444" label="Overdue"       count={overdue}     total={total}     />
      <KPITile accent="#16a34a" label="Completed"    count={completed}   total={total}     />
    </div>
  );
}
