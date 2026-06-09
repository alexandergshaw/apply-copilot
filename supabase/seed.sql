-- ApplyCopilot seed data
-- Sample profile, sources, jobs, packets, and applications for local development.

-- Sample user profile
insert into user_profiles (name, target_titles, target_locations, min_salary, remote_preference, skills, resume_text)
values (
  'Jordan Rivera',
  array['Senior Product Manager', 'Staff Product Manager', 'Principal Product Manager'],
  array['Remote (US)', 'San Francisco, CA', 'Austin, TX'],
  170000,
  'remote',
  array['Product Strategy', 'Roadmapping', 'Analytics', 'Cross-functional Leadership', 'Experimentation'],
  'Product leader with 8+ years building healthcare and platform products. Reduced patient no-show rate 28%, launched experimentation dashboards used by 200+ engineers, and led enterprise workflow automation rollouts.'
);

-- Job sources
insert into job_sources (name, source_type, url, enabled)
values
  ('LinkedIn', 'job board', 'https://www.linkedin.com/jobs', true),
  ('Greenhouse', 'job board', 'https://boards.greenhouse.io', true),
  ('Lever', 'job board', 'https://jobs.lever.co', true),
  ('Direct Referral', 'referral', 'https://example.com/referrals', false);

-- Example job board worker sources (disabled by default — replace slugs with
-- real company boards before enabling).
insert into job_sources (name, source_type, url, company_name, company_slug, enabled)
values
  (
    'Example Greenhouse Company',
    'greenhouse',
    'https://boards.greenhouse.io/example',
    'Example Greenhouse Company',
    'example',
    false
  );

-- Jobs
insert into jobs (source_id, title, company, location, salary, description, apply_url, status, match_score, match_reason)
values
  (
    (select id from job_sources where name = 'LinkedIn'),
    'Senior Product Manager',
    'Northstar Health',
    'Remote (US)',
    '$170k - $200k',
    'Lead roadmap execution for patient scheduling and care coordination products across web and mobile surfaces.',
    'https://example.com/apply/northstar-spm',
    'review',
    91,
    'Strong overlap with healthcare workflow optimization, analytics-driven prioritization, and cross-functional leadership experience.'
  ),
  (
    (select id from job_sources where name = 'Greenhouse'),
    'Staff Product Manager, AI Platform',
    'Cloudline',
    'San Francisco, CA',
    '$200k - $240k',
    'Own platform strategy for internal AI tooling, experimentation frameworks, and developer enablement.',
    'https://example.com/apply/cloudline-staff-pm',
    'found',
    84,
    'Deep fit with platform product background and prior experience shipping internal enablement tooling.'
  ),
  (
    (select id from job_sources where name = 'Lever'),
    'Principal Product Manager',
    'Blue Oak Labs',
    'Austin, TX',
    null,
    'Drive product strategy for B2B workflow automation products and enterprise integrations.',
    'https://example.com/apply/blueoak-principal-pm',
    'applied',
    88,
    'Strong enterprise SaaS and automation experience with customer discovery and GTM collaboration.'
  );

-- Application packets
insert into application_packets (job_id, tailored_resume, cover_letter, short_answers, risk_notes)
values
  (
    (select id from jobs where apply_url = 'https://example.com/apply/northstar-spm'),
    'Highlight outcomes: reduced no-show rate 28%, launched automated care reminders, and improved clinician NPS.',
    'I''m excited to bring my background in patient experience and workflow systems to Northstar Health''s product organization.',
    '["Why this role: mission and measurable impact in care delivery.", "Leadership style: context-first planning and rapid feedback loops."]'::jsonb,
    'Role asks for prior payer-side domain expertise. Resume currently emphasizes provider-side work.'
  ),
  (
    (select id from jobs where apply_url = 'https://example.com/apply/blueoak-principal-pm'),
    'Lead with enterprise expansion metrics and successful rollout of multi-tenant workflow orchestration.',
    'I thrive in ambiguous, high-impact product spaces and would bring a strong operator mindset to Blue Oak Labs.',
    '["Greatest enterprise win: 3x expansion via integration ecosystem.", "Operating principle: discovery before delivery."]'::jsonb,
    'Compensation range not listed; verify alignment with salary floor.'
  );

-- Applications
insert into applications (job_id, packet_id, status, applied_at, notes, follow_up_date)
values
  (
    (select id from jobs where apply_url = 'https://example.com/apply/blueoak-principal-pm'),
    (select id from application_packets where job_id = (select id from jobs where apply_url = 'https://example.com/apply/blueoak-principal-pm')),
    'submitted',
    now() - interval '3 days',
    'Submitted via Lever. Referred by former colleague on the platform team.',
    current_date + interval '7 days'
  ),
  (
    (select id from jobs where apply_url = 'https://example.com/apply/northstar-spm'),
    (select id from application_packets where job_id = (select id from jobs where apply_url = 'https://example.com/apply/northstar-spm')),
    'review',
    null,
    'Packet drafted and pending final review before submission.',
    current_date + interval '2 days'
  );
