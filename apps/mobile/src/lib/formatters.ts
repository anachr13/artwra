import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

/**
 * Format elapsed seconds as HH:MM:SS
 * e.g. 3723 → "01:02:03"
 */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Format seconds as human-readable duration
 * e.g. 5023 → "1h 23m" or 45 → "45s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const d = dayjs.duration(seconds, 'seconds');
  const h = Math.floor(d.asHours());
  const m = d.minutes();

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return `${m}m`;
}

/**
 * Format a date as relative time (e.g. "2 days ago")
 */
export function formatRelative(dateString: string): string {
  const date = dayjs(dateString);
  const now = dayjs();
  const diffDays = now.diff(date, 'day');

  if (diffDays === 0) {
    const diffHours = now.diff(date, 'hour');
    if (diffHours === 0) {
      const diffMinutes = now.diff(date, 'minute');
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  return date.format('MMM D, YYYY');
}
