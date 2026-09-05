import type { ISODate } from "@/types";

function parseISO(date: ISODate): { y: number; m: number; d: number } {
  const parts = date.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return { y, m, d };
}

/** Adds `days` to an ISO date string ("2026-11-20") and returns an ISO date string. */
export function addDays(date: ISODate, days: number): ISODate {
  const { y, m, d } = parseISO(date);
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

function monthName(m: number): string {
  return MONTHS[m - 1] ?? "";
}

/** "2026-11-20" -> "20 November 2026" */
export function formatLongDate(date: ISODate): string {
  const { y, m, d } = parseISO(date);
  return `${d} ${monthName(m)} ${y}`;
}

/** "2026-11-20" -> "20 Nov" */
export function formatShortDate(date: ISODate): string {
  const { m, d } = parseISO(date);
  return `${d} ${monthName(m).slice(0, 3)}`;
}

/** Formats a start/end range, collapsing shared month/year like "20–30 November 2026". */
export function formatDateRange(start: ISODate, end: ISODate | null): string {
  if (!end || end === start) return formatLongDate(start);
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.y === e.y && s.m === e.m) {
    return `${s.d}–${e.d} ${monthName(s.m)} ${s.y}`;
  }
  if (s.y === e.y) {
    return `${s.d} ${monthName(s.m)} – ${e.d} ${monthName(e.m)} ${s.y}`;
  }
  return `${formatLongDate(start)} – ${formatLongDate(end)}`;
}

/** Inclusive day count between two ISO dates. */
export function dayCountBetween(start: ISODate, end: ISODate): number {
  const s = parseISO(start);
  const e = parseISO(end);
  const a = Date.UTC(s.y, s.m - 1, s.d);
  const b = Date.UTC(e.y, e.m - 1, e.d);
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
