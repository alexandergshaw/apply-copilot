"use client";

type JsonTextareaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows?: number;
  helperText?: string;
};

export function JsonTextarea({
  id,
  label,
  value,
  onChange,
  error,
  rows = 8,
  helperText,
}: JsonTextareaProps) {
  return (
    <label className="block text-sm text-slate-700" htmlFor={id}>
      <span className="mb-1 block font-medium">{label}</span>
      {helperText ? <span className="mb-1 block text-xs text-slate-500">{helperText}</span> : null}
      <textarea
        id={id}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
