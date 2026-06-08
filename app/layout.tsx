import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/profile", label: "Profile" },
  { href: "/sources", label: "Sources" },
];

export const metadata: Metadata = {
  title: "ApplyCopilot",
  description: "Mock-data-driven job application command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link className="text-xl font-semibold text-slate-900" href="/dashboard">
                ApplyCopilot
              </Link>
              <nav className="flex flex-wrap gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
