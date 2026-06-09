import type { JobSourceConfig } from "./types";

const DEFAULT_FETCH_INTERVAL_MINUTES = 360;

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

export function isSourceDue(
  source: Pick<JobSourceConfig, "last_run_at" | "fetch_interval_minutes">,
  now: Date,
  defaultFetchIntervalMinutes: number,
): boolean {
  if (!source.last_run_at) {
    return true;
  }

  const lastRun = new Date(source.last_run_at);
  if (Number.isNaN(lastRun.getTime())) {
    return true;
  }

  const intervalMinutes = getEffectiveFetchIntervalMinutes(source, defaultFetchIntervalMinutes);
  const dueAtMs = lastRun.getTime() + intervalMinutes * 60 * 1000;
  return now.getTime() >= dueAtMs;
}

export function getNextDueAt(
  source: Pick<JobSourceConfig, "last_run_at" | "fetch_interval_minutes">,
  now: Date,
  defaultFetchIntervalMinutes: number,
): Date | null {
  if (!source.last_run_at) {
    return null;
  }

  const lastRun = new Date(source.last_run_at);
  if (Number.isNaN(lastRun.getTime())) {
    return null;
  }

  const intervalMinutes = getEffectiveFetchIntervalMinutes(source, defaultFetchIntervalMinutes);
  const nextDue = new Date(lastRun.getTime() + intervalMinutes * 60 * 1000);
  return nextDue.getTime() <= now.getTime() ? now : nextDue;
}
