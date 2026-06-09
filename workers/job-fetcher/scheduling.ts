import type { JobSourceConfig } from "./types";

const DEFAULT_FETCH_INTERVAL_MINUTES = 10;

export function resolveDefaultFetchIntervalMinutes(): number {
  const raw = process.env.DEFAULT_FETCH_INTERVAL_MINUTES;
  if (!raw) {
    return DEFAULT_FETCH_INTERVAL_MINUTES;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_FETCH_INTERVAL_MINUTES;
  }

  return parsed;
}

export function getEffectiveFetchIntervalMinutes(
  source: Pick<JobSourceConfig, "fetch_interval_minutes">,
  defaultFetchIntervalMinutes: number,
): number {
  if (
    source.fetch_interval_minutes != null &&
    Number.isInteger(source.fetch_interval_minutes) &&
    source.fetch_interval_minutes > 0
  ) {
    return source.fetch_interval_minutes;
  }

  return defaultFetchIntervalMinutes;
}

function getLastRunReferenceAt(
  source: Pick<JobSourceConfig, "last_auto_run_at" | "last_run_at">,
): Date | null {
  const reference = source.last_auto_run_at ?? source.last_run_at;
  if (!reference) {
    return null;
  }

  const parsed = new Date(reference);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSourceDue(
  source: Pick<
    JobSourceConfig,
    "last_auto_run_at" | "last_run_at" | "fetch_interval_minutes"
  >,
  now: Date,
  defaultFetchIntervalMinutes: number,
): boolean {
  const lastRun = getLastRunReferenceAt(source);
  if (!lastRun) {
    return true;
  }

  const intervalMinutes = getEffectiveFetchIntervalMinutes(source, defaultFetchIntervalMinutes);
  const dueAtMs = lastRun.getTime() + intervalMinutes * 60 * 1000;
  return now.getTime() >= dueAtMs;
}

export function getNextDueAt(
  source: Pick<
    JobSourceConfig,
    "last_auto_run_at" | "last_run_at" | "fetch_interval_minutes"
  >,
  now: Date,
  defaultFetchIntervalMinutes: number,
): Date | null {
  const lastRun = getLastRunReferenceAt(source);
  if (!lastRun) {
    return null;
  }

  const intervalMinutes = getEffectiveFetchIntervalMinutes(source, defaultFetchIntervalMinutes);
  const nextDue = new Date(lastRun.getTime() + intervalMinutes * 60 * 1000);
  return nextDue.getTime() <= now.getTime() ? now : nextDue;
}
