# ApplyCopilot Architecture

## GitHub-first workflow

ApplyCopilot development is driven through GitHub issues and pull requests. Work is planned in issues, implemented on branches, and reviewed in PRs before merge. This keeps decisions, tradeoffs, and implementation context visible to everyone contributing to the project.

## Supabase migrations workflow

The app is currently mock-data-driven, but the persistence layer is designed for Supabase. Database schema changes should be implemented as migration files, committed to version control, and applied consistently across environments. Application code should always assume migration-managed schema evolution rather than ad hoc database edits.

## Worker architecture

Background workers are planned as a separate execution layer from the Next.js frontend. Workers will eventually handle ingestion, enrichment, and draft packet preparation while writing state changes to Supabase tables that the web app reads from. This split keeps UI response times predictable and makes asynchronous processing easier to reason about.

## Human approval before applying

Even after automation is introduced, all application actions require a human approval checkpoint. The system can prepare recommendations and draft materials, but the final decision to submit remains explicit and user-controlled.

## No automatic form submission in MVP

The MVP does not perform any automatic form submission. It supports discovery, review, and preparation workflows only, ensuring high trust and low operational risk while the product foundation is established.
