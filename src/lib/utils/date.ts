import type { ISODate } from "@/types";

/** Adds `days` to an ISO date string ("2026-11-20") and returns an ISO date string. */
export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function todayISO(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-11-20" -> "20 November 2026" */
export function formatLongDate(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11-20" -> "20 Nov" */
export function formatShortDate(date: ISODate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]?.slice(0, 3)}`;
}

/** Formats a start/end range, collapsing shared month/year like "20–30 November 2026". */
export function formatDateRange(start: ISODate, end: ISODate | null): string {
  if (!end || end === start) return formatLongDate(start);
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (sy === ey && sm === em) {
    return `${sd}–${ed} ${MONTHS[sm - 1]} ${sy}`;
  }
  if (sy === ey) {
    return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${sy}`;
  }
  return `${formatLongDate(start)} – ${formatLongDate(end)}`;
}

/** Inclusive day count between two ISO dates. */
export function dayCountBetween(start: ISODate, end: ISODate): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const a = Date.UTC(sy, sm - 1, sd);
  const b = Date.UTC(ey, em - 1, ed);
  return Math.round((b - a) / 86400000) + 1;
}

export function formatRelativeUpdated(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
