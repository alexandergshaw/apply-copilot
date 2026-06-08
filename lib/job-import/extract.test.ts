import { describe, expect, it } from "vitest";

import { extractJobPostingFromHtml, PARTIAL_EXTRACTION_WARNING } from "./extract";

describe("extractJobPostingFromHtml", () => {
  it("prefers JSON-LD JobPosting data", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Wrong Title" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Senior Backend Engineer",
              "hiringOrganization": { "name": "Acme Corp" },
              "jobLocation": {
                "address": {
                  "addressLocality": "Austin",
                  "addressRegion": "TX"
                }
              },
              "baseSalary": {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                  "minValue": 140000,
                  "maxValue": 180000,
                  "unitText": "YEAR"
                }
              },
              "description": "<p>Build platform APIs.</p>",
              "url": "/jobs/123"
            }
          </script>
        </head>
        <body><h1>Ignored Heading</h1></body>
      </html>
    `;

    const result = extractJobPostingFromHtml(html, "https://jobs.example.com/posting");

    expect(result).not.toBeNull();
    expect(result?.extraction_source).toBe("json_ld");
    expect(result?.title).toBe("Senior Backend Engineer");
    expect(result?.company).toBe("Acme Corp");
    expect(result?.location).toBe("Austin");
    expect(result?.description).toContain("Build platform APIs.");
    expect(result?.apply_url).toBe("https://jobs.example.com/jobs/123");
    expect(result?.warnings).toHaveLength(0);
  });

  it("falls back to meta tags when JSON-LD is missing", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Product Manager" />
          <meta property="og:description" content="Own product strategy and execution." />
          <meta property="og:url" content="https://careers.example.com/pm" />
        </head>
      </html>
    `;

    const result = extractJobPostingFromHtml(html, "https://careers.example.com/raw");

    expect(result).not.toBeNull();
    expect(result?.extraction_source).toBe("meta");
    expect(result?.title).toBe("Product Manager");
    expect(result?.description).toContain("Own product strategy");
    expect(result?.apply_url).toBe("https://careers.example.com/pm");
  });

  it("uses HTML fallback and includes warning for partial extraction", () => {
    const html = `
      <html>
        <body>
          <main>
            <div class="job-description">
              <p>Join our team to help build developer tooling.</p>
            </div>
          </main>
        </body>
      </html>
    `;

    const result = extractJobPostingFromHtml(html, "https://example.com/job");

    expect(result).not.toBeNull();
    expect(result?.extraction_source).toBe("html_fallback");
    expect(result?.description).toContain("developer tooling");
    expect(result?.title).toBe("");
    expect(result?.warnings).toContain(PARTIAL_EXTRACTION_WARNING);
  });

  it("handles Greenhouse-style pages where og:description is only location", () => {
    const html = `
      <html>
        <head>
          <title>Job Application for Software Engineer at Anaplan</title>
          <meta property="og:title" content="Software Engineer" />
          <meta property="og:description" content="Gurugram, India" />
          <meta property="og:url" content="https://job-boards.greenhouse.io/anaplan/jobs/8571211002" />
        </head>
        <body>
          <main>
            <div class="job__header">
              <div class="job__title">
                <h1>Software Engineer</h1>
                <div class="job__location"><div>Gurugram, India</div></div>
              </div>
            </div>
            <div class="job__description body">
              <div>
                <p>At Anaplan, we are a team of innovators focused on optimizing business decision-making through our platform.</p>
                <p>You will build scalable services and collaborate across engineering teams to deliver customer value.</p>
              </div>
            </div>
          </main>
        </body>
      </html>
    `;

    const result = extractJobPostingFromHtml(
      html,
      "https://job-boards.greenhouse.io/anaplan/jobs/8571211002?gh_src=my.greenhouse.search",
    );

    expect(result).not.toBeNull();
    expect(result?.extraction_source).toBe("html_fallback");
    expect(result?.title).toBe("Software Engineer");
    expect(result?.company).toBe("Anaplan");
    expect(result?.location).toContain("Gurugram, India");
    expect(result?.description).toContain("At Anaplan, we are a team of innovators");
    expect(result?.description).toContain("build scalable services");
    expect(result?.warnings).toHaveLength(0);
  });
});
