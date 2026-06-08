import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClientMock } = vi.hoisted(() => ({
  getSupabaseServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

import {
  applications as mockApplications,
  autoApplyRuns as mockAutoApplyRuns,
  jobSources as mockJobSources,
  jobs as mockJobs,
} from "@/lib/mock-data";
import {
  getApplications,
  getAutoApplyRuns,
  getDefaultResumeTemplateForProfile,
  getJob,
  getJobs,
  getJobSourceId,
  getJobSources,
  getProfileId,
  getResumeTemplateById,
  getResumeTemplates,
  getTailoredResumesForJob,
  getUserProfile,
} from "./queries";

type QueryResult = { data: unknown; error: unknown };

/**
 * Builds a chainable Supabase query-builder stub. The builder is both
 * awaitable (for chains terminated by `.order(...)`) and exposes a
 * `maybeSingle()` that resolves the same configured result.
 */
function createQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder.select = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);

  return builder;
}

function createClient(resultByTable: Record<string, QueryResult>) {
  const fromMock = vi.fn((table: string) =>
    createQueryBuilder(resultByTable[table] ?? { data: null, error: null }),
  );
  return { from: fromMock };
}

function useSupabase(resultByTable: Record<string, QueryResult>) {
  const client = createClient(resultByTable);
  getSupabaseServerClientMock.mockReturnValue(client);
  return client;
}

function useNoSupabase() {
  getSupabaseServerClientMock.mockReturnValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getJobs", () => {
  it("returns mock jobs when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getJobs()).resolves.toBe(mockJobs);
  });

  it("maps Supabase rows when configured", async () => {
    useSupabase({
      jobs: {
        data: [
          { id: 1, title: "Backend Engineer", company: "Acme", job_sources: { name: "LinkedIn" } },
        ],
        error: null,
      },
    });

    const result = await getJobs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].role).toBe("Backend Engineer");
    expect(result[0].company).toBe("Acme");
    expect(result[0].source).toBe("LinkedIn");
  });

  it("falls back to mock jobs on query error", async () => {
    useSupabase({ jobs: { data: null, error: { message: "boom" } } });
    await expect(getJobs()).resolves.toBe(mockJobs);
  });
});

describe("getJob", () => {
  it("finds a mock job by id when Supabase is not configured", async () => {
    useNoSupabase();
    const result = await getJob("job-101");
    expect(result?.id).toBe("job-101");
  });

  it("returns null for an unknown mock id when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getJob("does-not-exist")).resolves.toBeNull();
  });

  it("returns null for a non-numeric id when Supabase is configured", async () => {
    useSupabase({});
    await expect(getJob("not-a-number")).resolves.toBeNull();
  });

  it("maps a Supabase row when configured", async () => {
    useSupabase({
      jobs: { data: { id: 5, title: "Staff PM", company: "Cloud" }, error: null },
    });

    const result = await getJob("5");

    expect(result?.id).toBe("5");
    expect(result?.role).toBe("Staff PM");
  });

  it("returns null on query error", async () => {
    useSupabase({ jobs: { data: null, error: { message: "boom" } } });
    await expect(getJob("5")).resolves.toBeNull();
  });
});

describe("getJobSourceId", () => {
  it("returns undefined when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getJobSourceId("5")).resolves.toBeUndefined();
  });

  it("returns undefined for a non-numeric id", async () => {
    useSupabase({});
    await expect(getJobSourceId("nope")).resolves.toBeUndefined();
  });

  it("returns the source id when configured", async () => {
    useSupabase({ jobs: { data: { source_id: 42 }, error: null } });
    await expect(getJobSourceId("5")).resolves.toBe(42);
  });

  it("returns undefined on query error", async () => {
    useSupabase({ jobs: { data: null, error: { message: "boom" } } });
    await expect(getJobSourceId("5")).resolves.toBeUndefined();
  });
});

describe("getApplications", () => {
  it("returns mock applications when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getApplications()).resolves.toBe(mockApplications);
  });

  it("maps Supabase rows when configured", async () => {
    useSupabase({
      applications: {
        data: [{ id: 9, status: "submitted", jobs: { title: "PM", company: "Acme" } }],
        error: null,
      },
    });

    const result = await getApplications();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("9");
    expect(result[0].role).toBe("PM");
    expect(result[0].company).toBe("Acme");
  });

  it("falls back to mock applications on query error", async () => {
    useSupabase({ applications: { data: null, error: { message: "boom" } } });
    await expect(getApplications()).resolves.toBe(mockApplications);
  });
});

describe("getUserProfile", () => {
  it("returns null when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getUserProfile()).resolves.toBeNull();
  });

  it("maps a profile row when configured", async () => {
    useSupabase({
      user_profiles: { data: { id: "profile-1", name: "Ada" }, error: null },
    });

    const result = await getUserProfile();

    expect(result?.id).toBe("profile-1");
    expect(result?.name).toBe("Ada");
  });

  it("returns null on query error", async () => {
    useSupabase({ user_profiles: { data: null, error: { message: "boom" } } });
    await expect(getUserProfile()).resolves.toBeNull();
  });
});

describe("getProfileId", () => {
  it("returns null when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getProfileId()).resolves.toBeNull();
  });

  it("returns the profile id when configured", async () => {
    useSupabase({ user_profiles: { data: { id: "profile-1" }, error: null } });
    await expect(getProfileId()).resolves.toBe("profile-1");
  });

  it("returns null on query error", async () => {
    useSupabase({ user_profiles: { data: null, error: { message: "boom" } } });
    await expect(getProfileId()).resolves.toBeNull();
  });
});

describe("getResumeTemplates", () => {
  it("returns an empty array when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getResumeTemplates()).resolves.toEqual([]);
  });

  it("maps template rows when configured", async () => {
    useSupabase({
      resume_templates: {
        data: [{ id: 3, profile_id: "p1", name: "PM Template" }],
        error: null,
      },
    });

    const result = await getResumeTemplates();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
    expect(result[0].name).toBe("PM Template");
  });

  it("returns an empty array on query error", async () => {
    useSupabase({ resume_templates: { data: null, error: { message: "boom" } } });
    await expect(getResumeTemplates()).resolves.toEqual([]);
  });
});

describe("getTailoredResumesForJob", () => {
  it("returns an empty array when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getTailoredResumesForJob("5")).resolves.toEqual([]);
  });

  it("returns an empty array for a non-numeric job id", async () => {
    useSupabase({});
    await expect(getTailoredResumesForJob("nope")).resolves.toEqual([]);
  });

  it("maps tailored resume rows when configured", async () => {
    useSupabase({
      tailored_resumes: {
        data: [{ id: 11, job_id: 5, resume_template_id: 3, status: "draft", tailored_text: "Hi" }],
        error: null,
      },
    });

    const result = await getTailoredResumesForJob("5");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(11);
    expect(result[0].status).toBe("draft");
  });

  it("returns an empty array on query error", async () => {
    useSupabase({ tailored_resumes: { data: null, error: { message: "boom" } } });
    await expect(getTailoredResumesForJob("5")).resolves.toEqual([]);
  });
});

describe("getResumeTemplateById", () => {
  it("returns null when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getResumeTemplateById(3)).resolves.toBeNull();
  });

  it("maps a template row when configured", async () => {
    useSupabase({
      resume_templates: { data: { id: 3, profile_id: "p1", name: "PM Template" }, error: null },
    });

    const result = await getResumeTemplateById(3);

    expect(result?.id).toBe(3);
    expect(result?.name).toBe("PM Template");
  });

  it("returns null on query error", async () => {
    useSupabase({ resume_templates: { data: null, error: { message: "boom" } } });
    await expect(getResumeTemplateById(3)).resolves.toBeNull();
  });
});

describe("getDefaultResumeTemplateForProfile", () => {
  it("returns null when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getDefaultResumeTemplateForProfile("p1")).resolves.toBeNull();
  });

  it("maps the default template row when configured", async () => {
    useSupabase({
      resume_templates: {
        data: { id: 3, profile_id: "p1", name: "Default Template" },
        error: null,
      },
    });

    const result = await getDefaultResumeTemplateForProfile("p1");

    expect(result?.id).toBe(3);
    expect(result?.name).toBe("Default Template");
  });

  it("returns null on query error", async () => {
    useSupabase({ resume_templates: { data: null, error: { message: "boom" } } });
    await expect(getDefaultResumeTemplateForProfile("p1")).resolves.toBeNull();
  });
});

describe("getJobSources", () => {
  it("returns mock job sources when Supabase is not configured", async () => {
    useNoSupabase();
    await expect(getJobSources()).resolves.toBe(mockJobSources);
  });

  it("maps job source rows when configured", async () => {
    useSupabase({
      job_sources: {
        data: [{ id: 2, name: "LinkedIn", source_type: "job board", url: "https://x", enabled: true }],
        error: null,
      },
    });

    const result = await getJobSources();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
    expect(result[0].sourceName).toBe("LinkedIn");
  });

  it("falls back to mock job sources on query error", async () => {
    useSupabase({ job_sources: { data: null, error: { message: "boom" } } });
    await expect(getJobSources()).resolves.toBe(mockJobSources);
  });
});

describe("getAutoApplyRuns", () => {
  it("filters mock runs by job id when Supabase is not configured", async () => {
    useNoSupabase();
    const result = await getAutoApplyRuns("job-101");
    expect(result).toEqual(mockAutoApplyRuns.filter((run) => run.jobId === "job-101"));
  });

  it("returns an empty array for a non-numeric job id when configured", async () => {
    useSupabase({});
    await expect(getAutoApplyRuns("nope")).resolves.toEqual([]);
  });

  it("maps auto-apply run rows when configured", async () => {
    useSupabase({
      auto_apply_runs: {
        data: [{ id: 7, job_id: 5, status: "queued" }],
        error: null,
      },
    });

    const result = await getAutoApplyRuns("5");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("7");
    expect(result[0].jobId).toBe("5");
  });

  it("returns an empty array on query error", async () => {
    useSupabase({ auto_apply_runs: { data: null, error: { message: "boom" } } });
    await expect(getAutoApplyRuns("5")).resolves.toEqual([]);
  });
});
