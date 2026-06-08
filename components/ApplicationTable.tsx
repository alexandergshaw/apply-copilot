import type { Application } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";

type ApplicationTableProps = {
  applications: Application[];
};

export function ApplicationTable({ applications }: ApplicationTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-semibold">Company</th>
            <th className="px-4 py-3 font-semibold">Role</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Applied date</th>
            <th className="px-4 py-3 font-semibold">Follow-up date</th>
            <th className="px-4 py-3 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {applications.map((application) => (
            <tr key={application.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{application.company}</td>
              <td className="px-4 py-3 text-slate-700">{application.role}</td>
              <td className="px-4 py-3"><StatusBadge status={application.status} /></td>
              <td className="px-4 py-3 text-slate-700">{application.appliedDate || "—"}</td>
              <td className="px-4 py-3 text-slate-700">{application.followUpDate || "—"}</td>
              <td className="px-4 py-3 text-slate-700">{application.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
