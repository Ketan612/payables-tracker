# Payables Tracker browser testing

## Safety boundary

The browser suite under `tests/e2e` performs real Supabase writes: it creates accounts, cards, people, expenses, payables, settlements, SMS tokens and inbox events. The frontend currently has the production Supabase URL and publishable key embedded in its JavaScript bundles.

**Do not run the browser suite against production.** CI currently runs only backend-independent parser and event-traceability regression tests. The browser suite is retained as test code but is intentionally excluded from GitHub Actions until the app supports runtime Supabase URL/key injection and a dedicated isolated test project is configured.

Do not use a real personal finance account as an E2E user. Do not point browser tests at the production Supabase project, even if a separate test login is used.

## Re-enabling browser E2E safely

Before enabling browser tests:

1. Add runtime Supabase configuration (URL, publishable key and auth storage namespace) consumed consistently by `app.js`, `cashbook.js`, `sms-capture.js`, `sms-admin.js` and every other Supabase client.
2. Provision a separate Supabase test project with schema/migrations matching the app. It must be isolated from production and contain no real financial records.
3. Configure CI-only test project URL/key and dedicated test users as repository secrets.
4. Ensure all test-created records, SMS tokens, mappings, cash movements and settlement records are cleaned in a `finally` block, and assert cleanup succeeded.
5. Add a Person Ledger browser test covering opening the person detail, transaction scrolling, totals, mobile layout and reopening/closing the shared detail dialog.
6. Enable the browser job only after a run against the isolated backend passes and the test database is verified clean afterward.

## Current safe CI coverage

GitHub Actions runs:

```bash
node --test tests/sms-parser.test.mjs tests/sms-event-traceability.test.mjs
```

The Playwright tests remain available for development against a dedicated test backend only. They must not be run locally against production either.

## Migration history

The connected production database reports 22 applied migrations. The repository currently contains only 3 migration SQL files. Do not run `supabase db push`, reset, repair migration history, or mark migrations applied until the missing SQL files have been recovered and compared with the live schema. Reconstructing a migration ledger from names alone is unsafe.
