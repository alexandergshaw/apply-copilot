import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocked.createClientMock,
}));

import {
  WorkerConfigError,
  createFetchRun,
  createServiceClient,
  finishFetchRun,
  loadEnabledJobSources,
  loadJobSourceById,
  updateSourceAfterRun,
} from "./supabase";
import type { JobSourceConfig } from "./types";

function withEnv(next: Record<string, string | undefined>, run: () => void) {
  const prev = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  if (next.NEXT_PUBLIC_SUPABASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = next.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (next.SUPABASE_URL === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = next.SUPABASE_URL;
  }
  if (next.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = next.SUPABASE_SERVICE_ROLE_KEY;
  }

  try {
    run();
  } finally {
    if (prev.NEXT_PUBLIC_SUPABASE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prev.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (prev.SUPABASE_URL === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = prev.SUPABASE_URL;
    }
    if (prev.SUPABASE_SERVICE_ROLE_KEY === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = prev.SUPABASE_SERVICE_ROLE_KEY;
    }
  }
}

function makeSource(overrides: Partial<JobSourceConfig> = {}): JobSourceConfig {
  return {
    id: 1,
    name: "Acme",
    source_type: "greenhouse",
    url: "https://boards.greenhouse.io/acme",
    company_name: "Acme",
    company_slug: "acme",
    last_run_at: null,
    last_auto_run_at: null,
    fetch_interval_minutes: null,
    remote_only: true,
    posted_within_days: 1,
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocked.createClientMock.mockReset();
});

describe("createServiceClient", () => {
  it("uses NEXT_PUBLIC_SUPABASE_URL when present", () => {
    const client = { tag: "client" };
    mocked.createClientMock.mockReturnValue(client);

    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_URL: "https://ignored.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      },
      () => {
        const result = createServiceClient();
        expect(result).toBe(client as never);
      },
    );

    expect(mocked.createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  });

  it("falls back to SUPABASE_URL", () => {
    mocked.createClientMock.mockReturnValue({});

    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_URL: "https://fallback.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      },
      () => {
        createServiceClient();
      },
    );

    expect(mocked.createClientMock).toHaveBeenCalledWith(
      "https://fallback.supabase.co",
      "service-role",
      expect.any(Object),
    );
  });

  it("throws when URL is missing", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      },
      () => {
        expect(() => createServiceClient()).toThrow(WorkerConfigError);
      },
    );
  });

  it("throws when service key is missing", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
      () => {
        expect(() => createServiceClient()).toThrow(WorkerConfigError);
      },
    );
  });
});

describe("source loaders", () => {
  it("loadEnabledJobSources returns only supported source types", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: async () => ({
                data: [
                  {
                    id: 1,
                    name: "G",
                    source_type: "greenhouse",
                    url: "https://boards.greenhouse.io/g",
                    company_name: null,
                    company_slug: null,
                    enabled: true,
                  },
                  {
                    id: 2,
                    name: "Manual",
                    source_type: "manual",
                    url: "https://example.com/manual",
                    company_name: null,
                    company_slug: null,
                    enabled: true,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const result = await loadEnabledJobSources(client as never);

    expect(result).toEqual([
      expect.objectContaining({ id: 1, source_type: "greenhouse" }),
    ]);
  });

  it("loadEnabledJobSources throws on query error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: async () => ({ data: null, error: { message: "boom" } }),
            }),
          }),
        }),
      }),
    };

    await expect(loadEnabledJobSources(client as never)).rejects.toThrow(/Failed to load job sources/);
  });

  it("loadJobSourceById returns null when not found", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    await expect(loadJobSourceById(client as never, 10)).resolves.toBeNull();
  });

  it("loadJobSourceById returns null for unsupported source_type", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 10,
                name: "Manual",
                source_type: "manual",
                url: "https://example.com",
                company_name: null,
                company_slug: null,
                enabled: true,
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    await expect(loadJobSourceById(client as never, 10)).resolves.toBeNull();
  });

  it("loadJobSourceById throws on query error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: "nope" } }),
          }),
        }),
      }),
    };

    await expect(loadJobSourceById(client as never, 1)).rejects.toThrow(/Failed to load job source/);
  });
});

describe("job fetch run lifecycle helpers", () => {
  it("createFetchRun returns id from inserted row", async () => {
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 88 }, error: null }),
          }),
        }),
      }),
    };

    const id = await createFetchRun(client as never, makeSource());
    expect(id).toBe(88);
  });

  it("createFetchRun throws when insert fails", async () => {
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: "insert failed" } }),
          }),
        }),
      }),
    };

    await expect(createFetchRun(client as never, makeSource())).rejects.toThrow(/Failed to create fetch run/);
  });

  it("finishFetchRun updates run row", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from };

    await finishFetchRun(
      client as never,
      10,
      "success",
      { jobsFound: 3, jobsInserted: 2, jobsUpdated: 1, jobsSkipped: 0 },
      null,
    );

    expect(from).toHaveBeenCalledWith("job_fetch_runs");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        jobs_found: 3,
        jobs_inserted: 2,
        jobs_updated: 1,
        jobs_skipped: 0,
        error_message: null,
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", 10);
  });

  it("finishFetchRun throws on update error", async () => {
    const client = {
      from: () => ({
        update: () => ({
          eq: async () => ({ error: { message: "update failed" } }),
        }),
      }),
    };

    await expect(
      finishFetchRun(
        client as never,
        1,
        "failed",
        { jobsFound: 0, jobsInserted: 0, jobsUpdated: 0, jobsSkipped: 0 },
        "boom",
      ),
    ).rejects.toThrow(/Failed to finish fetch run/);
  });
});

describe("updateSourceAfterRun", () => {
  it("increments run_count and clears last_error on success", async () => {
    const jobSourcesTable = {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { run_count: 5 }, error: null }) }),
      }),
      update: (value: Record<string, unknown>) => ({
        eq: async () => ({ error: null, value }),
      }),
    };

    const updateSpy = vi.spyOn(jobSourcesTable, "update");
    const client = {
      from: () => jobSourcesTable,
    };

    await updateSourceAfterRun(client as never, makeSource(), "auto", true, null);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        run_count: 6,
        last_error: null,
        last_auto_run_at: expect.any(String),
      }),
    );
  });

  it("sets last_error on failure and keeps run_count default when null", async () => {
    const jobSourcesTable = {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      update: (value: Record<string, unknown>) => ({
        eq: async () => ({ error: null, value }),
      }),
    };

    const updateSpy = vi.spyOn(jobSourcesTable, "update");
    const client = {
      from: () => jobSourcesTable,
    };

    await updateSourceAfterRun(client as never, makeSource(), "auto", false, "provider failed");

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        run_count: 1,
        last_error: "provider failed",
      }),
    );
  });

  it("does not set last_auto_run_at for successful manual runs", async () => {
    const jobSourcesTable = {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { run_count: 0 }, error: null }) }),
      }),
      update: (value: Record<string, unknown>) => ({
        eq: async () => ({ error: null, value }),
      }),
    };

    const updateSpy = vi.spyOn(jobSourcesTable, "update");
    const client = {
      from: () => jobSourcesTable,
    };

    await updateSourceAfterRun(client as never, makeSource(), "manual", true, null);

    const updateArg = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("last_auto_run_at");
  });

  it("throws when source update fails", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { run_count: 2 }, error: null }) }),
        }),
        update: () => ({
          eq: async () => ({ error: { message: "cannot update" } }),
        }),
      }),
    };

    await expect(
      updateSourceAfterRun(client as never, makeSource(), "auto", true, null),
    ).rejects.toThrow(/Failed to update source/);
  });
});