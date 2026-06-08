import Link from "next/link";

export default function Home() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-semibold text-slate-900">ApplyCopilot</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        A mock-data MVP for tracking job discovery, review decisions, and application workflows before backend integration.
      </p>
      <div className="mt-6">
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" href="/dashboard">
          Open dashboard
        </Link>
      </div>
    </section>
  );
}
