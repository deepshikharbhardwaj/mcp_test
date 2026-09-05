import type { DayStatus } from "@/types";

const LABELS: Record<DayStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  generated: "Generated",
  final: "Final",
};

const CLASSES: Record<DayStatus, string> = {
  not_started: "text-mist bg-sand/60",
  draft: "text-amber-800 bg-amber-100",
  generated: "text-sky-800 bg-sky-100",
  final: "text-emerald-800 bg-emerald-100",
};

export function StatusBadge({ status }: { status: DayStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${CLASSES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
