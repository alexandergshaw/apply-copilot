import { describe, expect, it } from "vitest";

import {
  getEffectiveFetchIntervalMinutes,
  getNextDueAt,
  isSourceDue,
  resolveDefaultFetchIntervalMinutes,
} from "./scheduling";

function withEnv(value: string | undefined, run: () => void) {
  const previous = process.env.DEFAULT_FETCH_INTERVAL_MINUTES;
  if (value === undefined) {
    delete process.env.DEFAULT_FETCH_INTERVAL_MINUTES;
  } else {
    process.env.DEFAULT_FETCH_INTERVAL_MINUTES = value;
  }

  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env.DEFAULT_FETCH_INTERVAL_MINUTES;
    } else {
      process.env.DEFAULT_FETCH_INTERVAL_MINUTES = previous;
    }
  }
}

describe("resolveDefaultFetchIntervalMinutes", () => {
  it("returns 10 when env is missing", () => {
    withEnv(undefined, () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(10);
    });
  });

  it("returns configured positive integer", () => {
    withEnv("120", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(120);
    });
  });

  it("falls back to 10 on invalid values", () => {
    withEnv("abc", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(10);
    });
    withEnv("0", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(10);
    });
    withEnv("-5", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(10);
    });
  });
});

describe("interval and due calculation", () => {
  const now = new Date("2026-06-09T12:00:00.000Z");

  it("uses source interval override when present", () => {
    expect(
      getEffectiveFetchIntervalMinutes({ fetch_interval_minutes: 15 }, 10),
    ).toBe(15);
  });

  it("uses default interval when source override is null", () => {
    expect(
      getEffectiveFetchIntervalMinutes({ fetch_interval_minutes: null }, 10),
    ).toBe(10);
  });

  it("is due when source has never run", () => {
    expect(
      isSourceDue(
        { last_auto_run_at: null, last_run_at: null, fetch_interval_minutes: null },
        now,
        10,
      ),
    ).toBe(true);
  });

  it("is due on interval boundary", () => {
    expect(
      isSourceDue(
        {
          last_auto_run_at: null,
          last_run_at: "2026-06-09T11:50:00.000Z",
          fetch_interval_minutes: null,
        },
        now,
        10,
      ),
    ).toBe(true);
  });

  it("is not due before default interval", () => {
    expect(
      isSourceDue(
        {
          last_auto_run_at: null,
          last_run_at: "2026-06-09T11:55:00.000Z",
          fetch_interval_minutes: null,
        },
        now,
        10,
      ),
    ).toBe(false);
  });

  it("respects custom interval", () => {
    expect(
      isSourceDue(
        {
          last_auto_run_at: null,
          last_run_at: "2026-06-09T11:50:00.000Z",
          fetch_interval_minutes: 15,
        },
        now,
        10,
      ),
    ).toBe(false);

    expect(
      isSourceDue(
        {
          last_auto_run_at: null,
          last_run_at: "2026-06-09T11:45:00.000Z",
          fetch_interval_minutes: 15,
        },
        now,
        10,
      ),
    ).toBe(true);
  });

  it("returns next due time for not-yet-due source", () => {
    const nextDue = getNextDueAt(
      {
        last_auto_run_at: null,
        last_run_at: "2026-06-09T11:50:00.000Z",
        fetch_interval_minutes: 15,
      },
      now,
      10,
    );

    expect(nextDue?.toISOString()).toBe("2026-06-09T12:05:00.000Z");
  });

  it("prefers last_auto_run_at over last_run_at for due checks", () => {
    expect(
      isSourceDue(
        {
          last_auto_run_at: "2026-06-09T11:59:00.000Z",
          last_run_at: "2026-06-09T10:00:00.000Z",
          fetch_interval_minutes: 10,
        },
        now,
        10,
      ),
    ).toBe(false);
  });
});