import type { HistoryEntry } from './historyApi';

function toIsoDayKey(dateValue: string) {
  return new Date(dateValue).toISOString().split('T')[0];
}

export function countSolvesOnDay(entries: Pick<HistoryEntry, 'created_at'>[], targetDate = new Date()) {
  const targetDay = targetDate.toISOString().split('T')[0];
  return entries.reduce((count, entry) => count + (toIsoDayKey(entry.created_at) === targetDay ? 1 : 0), 0);
}

export function buildHistoryByDay(entries: Pick<HistoryEntry, 'created_at'>[]) {
  return entries.reduce<Record<string, number>>((map, entry) => {
    const dayKey = toIsoDayKey(entry.created_at);
    map[dayKey] = (map[dayKey] || 0) + 1;
    return map;
  }, {});
}

export function computeCurrentStreak(entries: Pick<HistoryEntry, 'created_at'>[], now = new Date()) {
  if (!entries.length) return 0;

  const historyByDay = buildHistoryByDay(entries);
  let streak = 0;

  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const dayKey = date.toISOString().split('T')[0];
    if (historyByDay[dayKey]) {
      streak += 1;
      continue;
    }
    if (offset === 0) {
      continue;
    }
    break;
  }

  return streak;
}

export function buildMonthlySolveSeries(
  entries: Pick<HistoryEntry, 'created_at'>[],
  language: string,
  options?: {
    months?: number;
    currentMonthCountOverride?: number | null;
  },
) {
  const months = Math.max(options?.months ?? 5, 1);
  const counts: Record<string, number> = {};

  for (const entry of entries) {
    const monthKey = new Date(entry.created_at).toISOString().slice(0, 7);
    counts[monthKey] = (counts[monthKey] || 0) + 1;
  }

  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const offset = months - index - 1;
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = monthDate.toISOString().slice(0, 7);
    const isCurrentMonth = offset === 0;
    const fallbackCount = counts[monthKey] ?? 0;

    return {
      label: monthDate.toLocaleDateString(language, { month: 'short' }),
      count: isCurrentMonth && typeof options?.currentMonthCountOverride === 'number'
        ? Math.max(options.currentMonthCountOverride, fallbackCount)
        : fallbackCount,
    };
  });
}
