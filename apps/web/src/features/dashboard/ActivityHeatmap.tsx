import { useMemo } from 'react';

interface ActivityHeatmapProps {
  /** Map of 'YYYY-MM-DD' → session count */
  data?: Record<string, number>;
  weeks?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function getIntensity(count: number): string {
  if (count === 0) return 'bg-bg-elevated opacity-100';
  if (count === 1) return 'bg-accent opacity-20';
  if (count === 2) return 'bg-accent opacity-40';
  if (count <= 4) return 'bg-accent opacity-60';
  return 'bg-accent opacity-100';
}

export default function ActivityHeatmap({ data = {}, weeks = 52 }: ActivityHeatmapProps) {
  const { grid, monthLabels, totalSessions, currentStreak } = useMemo(() => {
    const today = new Date();
    const totalDays = weeks * 7;
    
    // Align to Saturday of the current week (end of grid)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()));
    
    // Compute start date as 52 weeks before the Saturday end date (which makes it a Sunday)
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - totalDays + 1);

    const grid: { date: string; count: number; day: number }[][] = [];
    const monthLabelsMap: { week: number; label: string }[] = [];

    let total = 0;
    let streak = 0;
    let streakBroken = false;

    for (let w = 0; w < weeks; w++) {
      const week: { date: string; count: number; day: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const current = new Date(startDate);
        current.setDate(current.getDate() + w * 7 + d);
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const utcDateStr = current.toISOString().split('T')[0];
        const count = data[dateStr] || data[utcDateStr] || 0;

        if (current <= today) {
          total += count;
          if (!streakBroken) {
            const diff = Math.floor((today.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
            if (diff <= streak && count > 0) {
              streak++;
            } else if (diff === 0 && count > 0) {
              streak++;
            } else if (diff > 0 && count === 0) {
              streakBroken = true;
            }
          }
        }

        week.push({ date: dateStr, count, day: d });

        // Track month boundaries
        if (d === 0 && current.getDate() <= 7) {
          monthLabelsMap.push({ week: w, label: MONTHS[current.getMonth()] });
        }
      }
      grid.push(week);
    }

    return { grid, monthLabels: monthLabelsMap, totalSessions: total, currentStreak: streak };
  }, [data, weeks]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-heading text-text-primary font-sans font-semibold">Activity</h3>
        <div className="flex items-center gap-4">
          <span className="text-caption text-text-muted font-sans">
            {totalSessions} sessions in the last {weeks} weeks
          </span>
          {currentStreak > 0 && (
            <span className="text-caption text-accent font-sans">
              🔥 {currentStreak} day streak
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-0">
          {/* Month labels */}
          <div className="flex ml-8 mb-1">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-[10px] text-text-muted font-sans"
                style={{ marginLeft: m.week > 0 ? `${(m.week - (i > 0 ? monthLabels[i - 1].week : 0)) * 14 - 14}px` : 0 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-0">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-1">
              {DAYS.map((d, i) => (
                <span key={i} className="text-[9px] text-text-muted font-sans h-[12px] flex items-center pr-2">
                  {d}
                </span>
              ))}
            </div>

            {/* Cells */}
            <div className="flex gap-[2px]">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`w-[12px] h-[12px] rounded-[2px] ${getIntensity(day.count)} transition-colors hover:border hover:border-text-primary`}
                      title={`${day.date}: ${day.count} session${day.count !== 1 ? 's' : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-3">
            <span className="text-[9px] text-text-muted font-sans mr-1">Less</span>
            <div className="w-[12px] h-[12px] rounded-[2px] bg-bg-elevated opacity-100" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-accent opacity-20" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-accent opacity-40" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-accent opacity-60" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-accent opacity-100" />
            <span className="text-[9px] text-text-muted font-sans ml-1">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
