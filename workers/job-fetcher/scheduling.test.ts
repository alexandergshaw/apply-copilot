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
  it("returns 360 when env is missing", () => {
    withEnv(undefined, () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(360);
    });
  });

  it("returns configured positive integer", () => {
    withEnv("120", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(120);
    });
  });

  it("falls back to 360 on invalid values", () => {
    withEnv("abc", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(360);
    });
    withEnv("0", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(360);
    });
    withEnv("-5", () => {
      expect(resolveDefaultFetchIntervalMinutes()).toBe(360);
    });
  });
});

describe("interval and due calculation", () => {
  const now = new Date("2026-06-09T12:00:00.000Z");

  it("uses source interval override when present", () => {
    expect(
      getEffectiveFetchIntervalMinutes({ fetch_interval_minutes: 15 }, 360),
    ).toBe(15);
  });

  it("uses default interval when source override is null", () => {
    expect(
      getEffectiveFetchIntervalMinutes({ fetch_interval_minutes: null }, 360),
    ).toBe(360);
  });

  it("is due when source has never run", () => {
    expect(
      isSourceDue({ last_run_at: null, fetch_interval_minutes: null }, now, 360),
    ).toBe(true);
  });

  it("is due on interval boundary", () => {
    expect(
      isSourceDue(
        {
          last_run_at: "2026-06-09T06:00:00.000Z",
          fetch_interval_minutes: null,
        },
        now,
        360,
      ),
    ).toBe(true);
  });

  it("is not due before default interval", () => {
    expect(
      isSourceDue(
        {
          last_run_at: "2026-06-09T11:30:00.000Z",
          fetch_interval_minutes: null,
        },
        now,
        360,
      ),
    ).toBe(false);
  });

  it("respects custom interval", () => {
    expect(
      isSourceDue(
        {
          last_run_at: "2026-06-09T11:50:00.000Z",
          fetch_interval_minutes: 15,
        },
        now,
        360,
      ),
    ).toBe(false);

    expect(
      isSourceDue(
        {
          last_run_at: "2026-06-09T11:45:00.000Z",
          fetch_interval_minutes: 15,
        },
        now,
        360,
      ),
    ).toBe(true);
  });

  it("returns next due time for not-yet-due source", () => {
    const nextDue = getNextDueAt(
      {
        last_run_at: "2026-06-09T11:50:00.000Z",
        fetch_interval_minutes: 15,
      },
      now,
      360,
    );

    expect(nextDue?.toISOString()).toBe("2026-06-09T12:05:00.000Z");
  });
});