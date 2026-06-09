import { describe, expect, it } from "vitest";

import { parseGreenhouseSourceFromUrl } from "./greenhouse";

describe("parseGreenhouseSourceFromUrl", () => {
  it("parses boards.greenhouse.io slug URL", () => {
    const result = parseGreenhouseSourceFromUrl("https://boards.greenhouse.io/acme-inc");

    expect(result).toEqual({
      sourceType: "greenhouse",
      sourceName: "Greenhouse - Acme Inc",
      companyName: "Acme Inc",
      companySlug: "acme-inc",
      canonicalUrl: "https://boards.greenhouse.io/acme-inc",
    });
  });

  it("parses boards.greenhouse.io slug/jobs URL", () => {
    const result = parseGreenhouseSourceFromUrl("https://boards.greenhouse.io/acme/jobs");

    expect(result?.companySlug).toBe("acme");
    expect(result?.canonicalUrl).toBe("https://boards.greenhouse.io/acme");
  });

  it("parses job-boards.greenhouse.io URL and normalizes canonical host", () => {
    const result = parseGreenhouseSourceFromUrl(
      "https://job-boards.greenhouse.io/example_co/jobs/123",
    );

    expect(result?.companySlug).toBe("example_co");
    expect(result?.companyName).toBe("Example Co");
    expect(result?.canonicalUrl).toBe("https://boards.greenhouse.io/example_co");
  });

  it("ignores query and hash segments", () => {
    const result = parseGreenhouseSourceFromUrl(
      "https://boards.greenhouse.io/netlify/jobs?gh_jid=1#section",
    );

    expect(result?.companySlug).toBe("netlify");
    expect(result?.canonicalUrl).toBe("https://boards.greenhouse.io/netlify");
  });

  it("normalizes uppercase slugs", () => {
    const result = parseGreenhouseSourceFromUrl("https://boards.greenhouse.io/ACME_INC");

    expect(result?.companySlug).toBe("acme_inc");
    expect(result?.companyName).toBe("Acme Inc");
  });

  it("returns null for non-greenhouse URL", () => {
    const result = parseGreenhouseSourceFromUrl("https://example.com/acme/jobs");

    expect(result).toBeNull();
  });

  it("returns null for empty slug", () => {
    const result = parseGreenhouseSourceFromUrl("https://boards.greenhouse.io/");

    expect(result).toBeNull();
  });

  it("returns null for malformed URL", () => {
    const result = parseGreenhouseSourceFromUrl("not-a-url");

    expect(result).toBeNull();
  });
});
