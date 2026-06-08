type DashboardCardProps = {
  label: string;
  value: number;
};

export function DashboardCard({ label, value }: DashboardCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
