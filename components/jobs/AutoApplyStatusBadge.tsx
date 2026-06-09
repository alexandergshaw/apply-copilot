import type { AutoApplyStatus } from "@/lib/mock-data";

type AutoApplyStatusBadgeProps = {
  status: AutoApplyStatus;
};

const statusStyles: Record<AutoApplyStatus, string> = {
  not_requested: "bg-slate-100 text-slate-700",
  queued: "bg-amber-100 text-amber-700",
  running: "bg-blue-100 text-blue-700",
  needs_review: "bg-orange-100 text-orange-700",
  submitted: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  blocked: "bg-red-100 text-red-700",
  canceled: "bg-slate-200 text-slate-700",
};

const statusLabels: Record<AutoApplyStatus, string> = {
  not_requested: "Not Requested",
  queued: "Queued",
  running: "Running",
  needs_review: "Needs Review",
  submitted: "Submitted",
  failed: "Failed",
  blocked: "Blocked",
  canceled: "Canceled",
};

export function AutoApplyStatusBadge({ status }: AutoApplyStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      Auto Apply: {statusLabels[status]}
    </span>
  );
}
