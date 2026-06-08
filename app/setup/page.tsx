import { getMissingSupabaseEnvVars } from "@/lib/supabase/config";

export default function SetupPage() {
  const missingVars = getMissingSupabaseEnvVars();
  const isConfigured = missingVars.length === 0;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Setup Diagnostics</h1>
        <p className="text-slate-600">Check whether Supabase environment variables are configured.</p>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Supabase status</h2>
        {isConfigured ? (
          <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Supabase env vars are configured.
          </p>
        ) : (
          <>
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Supabase env vars are missing.
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
              {missingVars.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-700">
              Add values in .env.local, then restart your dev server.
            </p>
          </>
        )}
      </article>
    </section>
  );
}
