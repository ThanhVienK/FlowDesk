const BASE = '/api';

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...opts.headers };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const data = await res.json() as { error?: string };
      msg = data.error ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Parse a user-typed USDC string like "12.50" to USDC micro-units (integer, 6 decimals) */
export function parseUsdcInput(input: string): number {
  const n = parseFloat(input.replace(/,/g, ''));
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 1_000_000);
}

/** Format USDC micro-units to display string, e.g. "$12.50" */
export function formatUsdc(microUnits: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(microUnits / 1_000_000);
}

/** Truncate an address: 0x1234…5678 */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Relative time, e.g. "2 hours ago" */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Human-friendly frequency label.
 * Accepts new unit+value fields OR legacy frequency string (weekly/biweekly/monthly).
 */
export function frequencyLabel(
  frequencyOrUnit: string,
  value?: number,
  unit?: string,
): string {
  // New model: explicit unit + value
  if (unit && value != null) {
    const u = unit;
    const v = value;
    const plural = (word: string) => v === 1 ? word : `${word}s`;
    if (v === 1) {
      if (u === 'minute') return 'Every minute';
      if (u === 'hour')   return 'Every hour';
      if (u === 'day')    return 'Every day';
      if (u === 'week')   return 'Every week';
      if (u === 'month')  return 'Every month';
    }
    const labels: Record<string, string> = {
      minute: plural('minute'),
      hour:   plural('hour'),
      day:    plural('day'),
      week:   plural('week'),
      month:  plural('month'),
    };
    return `Every ${v} ${labels[u] ?? u}`;
  }
  // Legacy fallback
  if (frequencyOrUnit === 'weekly')   return 'Every week';
  if (frequencyOrUnit === 'biweekly') return 'Every 2 weeks';
  if (frequencyOrUnit === 'monthly')  return 'Every month';
  return frequencyOrUnit;
}

/** Format next_run_at into a human-readable string including time for sub-day intervals */
export function nextRunLabel(iso: string, frequencyUnit?: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.ceil(diffMs / 60000);
  const diffHrs = Math.ceil(diffMs / 3600000);
  const diffDays = Math.ceil(diffMs / 86400000);

  // Sub-day frequencies: show time-relative label
  if (frequencyUnit === 'minute' || frequencyUnit === 'hour') {
    if (diffMs <= 0) return 'Due now';
    if (diffMins < 60) return `In ${diffMins}m`;
    if (diffHrs < 24)  return `In ${diffHrs}h`;
  }

  if (diffMs <= 0) return 'Due now';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7)   return `In ${diffDays} days`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; bgVar: string; colorVar: string }> = {
  all:      { label: 'All',      bg: '', text: '', bgVar: 'var(--surface-muted)',  colorVar: 'var(--muted)'   },
  pending:  { label: 'Pending',  bg: '', text: '', bgVar: 'var(--warning-bg)',     colorVar: 'var(--warning)' },
  approved: { label: 'Approved', bg: '', text: '', bgVar: 'rgba(79,140,232,0.12)', colorVar: 'var(--accent)'  },
  executed: { label: 'Executed', bg: '', text: '', bgVar: 'var(--success-bg)',     colorVar: 'var(--success)' },
  rejected: { label: 'Rejected', bg: '', text: '', bgVar: 'var(--danger-bg)',      colorVar: 'var(--danger)'  },
};
