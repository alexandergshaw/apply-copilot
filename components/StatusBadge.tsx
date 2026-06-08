import type { ApplicationStatus, JobStatus } from "@/lib/mock-data";

type StatusBadgeProps = {
  status: JobStatus | ApplicationStatus;
};

const statusStyles: Record<StatusBadgeProps["status"], string> = {
  new: "bg-slate-100 text-slate-700",
  review: "bg-amber-100 text-amber-700",
  applied: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-indigo-100 text-indigo-700",
  interview: "bg-emerald-100 text-emerald-700",
  offer: "bg-green-100 text-green-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
