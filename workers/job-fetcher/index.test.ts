import { afterEach, describe, expect, it, vi } from "vitest";

const fetchAllEnabledJobSourcesMock = vi.fn();
const workerConfigCtor = class WorkerConfigError extends Error {};

vi.mock("./fetch-all", () => ({
  fetchAllEnabledJobSources: fetchAllEnabledJobSourcesMock,
}));

vi.mock("./supabase", () => ({
  WorkerConfigError: workerConfigCtor,
}));

async function importEntrypoint() {
  vi.resetModules();
  // The module runs immediately on import.
  await import("./index");
}

async function withArgv(args: string[], run: () => Promise<void>) {
  const previous = process.argv;
  process.argv = args;
  try {
    await run();
  } finally {
    process.argv = previous;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  fetchAllEnabledJobSourcesMock.mockReset();
  delete process.env.JOB_FETCH_INTERVAL_MS;
});

describe("job-fetcher CLI entrypoint", () => {
  it("exits 0 for --once when at least one source succeeds", async () => {
    fetchAllEnabledJobSourcesMock.mockResolvedValueOnce({
      processed: 2,
      succeeded: 1,
      failed: 1,
      results: [],
    });

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    await withArgv(["node", "index", "--once"], async () => {
      await importEntrypoint();
    });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits 1 for --once when all processed sources fail", async () => {
    fetchAllEnabledJobSourcesMock.mockResolvedValueOnce({
      processed: 3,
      succeeded: 0,
      failed: 3,
      results: [],
    });

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    await withArgv(["node", "index", "--once"], async () => {
      await importEntrypoint();
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 0 for --once when there are no sources", async () => {
    fetchAllEnabledJobSourcesMock.mockResolvedValueOnce({
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    await withArgv(["node", "index", "--once"], async () => {
      await importEntrypoint();
    });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("schedules interval in continuous mode using default interval", async () => {
    fetchAllEnabledJobSourcesMock.mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });

    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockImplementation((() => 1) as never);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await withArgv(["node", "index"], async () => {
      await importEntrypoint();
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 21600000);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Continuous mode enabled"));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("uses configured JOB_FETCH_INTERVAL_MS when >= 1 minute", async () => {
    process.env.JOB_FETCH_INTERVAL_MS = "120000";
    fetchAllEnabledJobSourcesMock.mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });

    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockImplementation((() => 1) as never);
    await withArgv(["node", "index"], async () => {
      await importEntrypoint();
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 120000);
  });

  it("falls back to default interval when configured value is too small", async () => {
    process.env.JOB_FETCH_INTERVAL_MS = "500";
    fetchAllEnabledJobSourcesMock.mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });

    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockImplementation((() => 1) as never);
    await withArgv(["node", "index"], async () => {
      await importEntrypoint();
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 21600000);
  });

  it("exits 1 and logs configuration error when fetch throws WorkerConfigError", async () => {
    fetchAllEnabledJobSourcesMock.mockRejectedValueOnce(new workerConfigCtor("missing key"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await withArgv(["node", "index", "--once"], async () => {
      await importEntrypoint();
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Configuration error: missing key"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 and logs fatal error when fetch throws non-config error", async () => {
    fetchAllEnabledJobSourcesMock.mockRejectedValueOnce(new Error("boom"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await withArgv(["node", "index", "--once"], async () => {
      await importEntrypoint();
    });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Fatal error: boom"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});