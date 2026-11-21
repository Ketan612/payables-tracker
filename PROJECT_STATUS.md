# Payables Tracker — Project Status & Handoff

> **Single source of truth:** Keep this file current after every project chat/session. At the end of each project chat, update this same file with verified status, decisions, test/deployment evidence, and the next action. When starting a new chat, read this file first.
>
> Last updated: 2026-11-22  
> Repository: `Ketan612/payables-tracker`

## Current production status

| Area | Latest verified status | Evidence / notes |
|---|---|---|
| PR21 | Merged to `main` | Merge commit `43dd6120acd77f174d0fc2f182553ac1935c797a`; prior E2E run 44870875458 passed |
| ICICI SMS parser fix (PR25) | Included in production `main` | PR25 merged to `test-env`; subsequently included in validated release PR28 to `main` |
| SMS parser regression tests | Passed 5/5 | Explicit ICICI ₹9,140 debit, beneficiary direction, ordinary debit/credit, ambiguous transfer review, missing-date manual review |
| Validated release PR28 | Merged to `main` | Merge commit `fce88745b8a0b1c4a0caeb7d893db2b77ba5488f`; test-env workflow run 44885131579 passed; PR28 records 14/14 browser E2E |
| SMS admin monitoring (PR29) | Merged to `main` | Merge commit `4ad8e7b35ade0c7b3d41143383ac1bb29ee5734d`; production E2E run 44916710779 passed |
| Physical Cash + custom categories (PR30) | Merged to `main` | PR30 merged; feature-branch E2E run 44923581217 passed |
| Latest main E2E | **Failed** | Run 44936121486; parser regression step passed, browser E2E step failed. Investigate before declaring production regression suite green |
| Vercel | Latest checks seen as Ready | PR28 and PR25 Vercel previews reported Ready; verify latest production deployment separately |
| Render | Previously reported live | Re-verify current deployment/branch before relying on this status |
| Live iPhone SMS forwarding | Pending real-device validation | End-to-end device forwarding and resulting record persistence not yet verified |

**Important correction to the previous handoff:** PR #25 was merged into `test-env`, not directly into `main`. Its parser fix was later included in PR #28, which promoted the validated `test-env` snapshot to `main`. The parser is present in the current `main` tree. PR25's first workflow run failed in browser E2E, but the subsequent test-env run 44885131579 passed both parser tests and browser E2E.

## Next action — do this first

**Validate and review PR #31 (Cash Book opening-balance race fix).**

1. Review PR #31 and its full E2E workflow result; require parser tests and all browser tests to pass.
2. Confirm the opening-balance regression assertion proves the request sends 2600 and the UI displays ₹2,600.
3. Review the PR diff and preserve the production backup/release discipline before any merge.
4. Do not merge PR #31 or change production deployments until the validation is green and the production backup is verified.

### PR #31 — Cash Book opening-balance race fix (validation pending)
- URL: https://github.com/Ketan612/payables-tracker/pull/31
- Branch: `fix/cashbook-opening-balance-race`
- Head commit: `253650ed3ce72b3a77538fc0a4c75d95458c0df7`
- Root cause confirmed from Playwright trace for run 44936121486: an asynchronous Cash Book `draw()` refresh could complete after the opening-balance editor was opened and overwrite the user's typed value. The trace shows the upsert request sent `opening_balance: 0` even though the test had filled 2600; Supabase returned HTTP 201, so the zero was saved.
- Fix: do not rewrite the opening-balance input while the editor is visible; await the post-save redraw and surface refresh errors.
- Regression assertion: full authenticated E2E journey now checks that the Supabase upsert request payload contains `opening_balance: 2600` before checking the displayed balance.
- PR is draft and not merged. No production code or deployment changed.
- PR validation run 44946108610 was started; parser tests passed, browser E2E was still running at the last check. Updating this handoff file on the PR branch will trigger a fresh PR validation run.

## Latest verified PRs and release evidence

### PR #25 — ICICI SMS parser correction
- URL: https://github.com/Ketan612/payables-tracker/pull/25
- Merged into `test-env`; merge commit `b382211e512a8f70b49d2568bae4bd9cdfeec371`.
- Parser change prioritizes the account holder's explicit debit/credit action over beneficiary wording, extracts ICICI-style dates, UPI reference and beneficiary, and routes missing/ambiguous dates/direction to review.
- Initial workflow run 44884487315: parser regression step passed; browser E2E failed.
- Later test-env workflow run 44885131579: parser regression step passed and browser E2E passed.
- PR25 itself was not a direct production merge.

### PR #28 — validated test-env snapshot promoted to main
- URL: https://github.com/Ketan612/payables-tracker/pull/28
- Merge commit: `fce88745b8a0b1c4a0caeb7d893db2b77ba5488f`.
- PR description records parser regression 5/5 and full browser E2E 14/14 passed.
- Test-env run: https://github.com/Ketan612/payables-tracker/actions/runs/44885131579
- Recording/report artifact: https://github.com/Ketan612/payables-tracker/actions/runs/44885131579/artifacts/14699836162
- Production backup before release: `backup/main-before-icici-cashbook-release-20261121`, SHA `eceb30a679b4d883c1045265eae298590edde416`.

### PR #29 — SMS admin monitoring improvements
- URL: https://github.com/Ketan612/payables-tracker/pull/29
- Merged to `main`; merge commit `4ad8e7b35ade0c7b3d41143383ac1bb29ee5734d`.
- Added live pending manual-review count, latest successful capture timestamp, admin-only access coverage and non-admin RLS isolation.
- Main E2E run 44916710779 passed.

### PR #30 — Physical Cash ledger and custom expense categories
- URL: https://github.com/Ketan612/payables-tracker/pull/30
- Merged to `main`; PR metadata shows merge completed.
- Added system-managed Physical Cash account, safe linked cash-history backfill, user-scoped custom expense categories and RLS/E2E coverage.
- Feature branch E2E run 44923581217 passed.
- The later main run 44936121486 failed in browser tests; root cause is not yet known.

## SMS integration validation checklist

- [x] Parser correction merged into production through PR28
- [x] ICICI explicit-date ₹9,140 debit parser regression
- [x] Beneficiary wording does not reverse account debit/credit
- [x] Ambiguous debit/credit without account context routed to review
- [x] Missing transaction date is not guessed; manual review required
- [ ] Invalid-date handling independently covered and verified
- [ ] Duplicate SMS handling verified at integration/database level
- [ ] Account mapping verified with live test account
- [ ] Transaction/review persistence verified end-to-end
- [ ] Approval and rejection flows verified end-to-end
- [ ] Live iPhone SMS forwarding verified
- [ ] Admin monitor success/failure/duplicate/pending event behavior verified in production

## Deferred / follow-up work

- Complete live iPhone SMS forwarding validation.
- Confirm duplicate event visibility and persistence in SMS review/admin monitoring.
- Continue validating admin monitoring metrics and RLS behavior.
- Confirm Physical Cash account behavior for cash expenses, card payments and person settlements after production merge.
- Verify custom category creation, persistence, editing and user isolation after production merge.

## Release and branch rules

- Production branch: `main`.
- Test branch used for recent validated snapshot: `test-env`.
- Also documented in README: `test/e2e-stabilization`; confirm which test branch is active for each new task rather than assuming.
- Validate changes on test branch and Vercel preview before production promotion.
- Before a production promotion, create/verify a main backup and record its branch/SHA.
- Keep production data/schema safe; do not make unrelated schema or production-data changes.
- Do not treat a Vercel preview being Ready as proof that production deployment is correct.
- One focused change at a time; record exact branch, commit, workflow run, artifact and deployment evidence.
- At the end of every project chat, update this file. Do not create multiple competing status files.

## Latest evidence / identifiers

| Item | Value |
|---|---|
| PR21 merge commit | `43dd6120acd77f174d0fc2f182553ac1935c797a` |
| PR21 E2E run | `44870875458` — passed |
| PR25 parser commit | `b382211e512a8f70b49d2568bae4bd9cdfeec371` |
| PR25 initial workflow | `44884487315` — parser tests passed; browser E2E failed |
| PR28 release commit | `fce88745b8a0b1c4a0caeb7d893db2b77ba5488f` |
| PR28 validated test-env run | `44885131579` — parser tests + browser E2E passed |
| PR28 recorded parser/E2E counts | 5/5 parser; 14/14 browser E2E |
| PR29 merge commit | `4ad8e7b35ade0c7b3d41143383ac1bb29ee5734d` |
| PR29 main E2E run | `44916710779` — passed |
| PR30 feature E2E run | `44923581217` — passed |
| Latest main workflow run | `44936121486` — browser E2E failed; parser step passed |
| Latest known main commit at tracker read | `f540851b96e9496b30b047b6c32fb7d4b1c6fb7a` |

## Session update log

- **2026-11-21:** Created this handoff tracker from the PR21 merged-chat summary.
- **2026-11-22:** Located PR25; inspected parser diff and tests.
- **2026-11-22 (status refresh):** Verified PR25 merged to test-env; found initial browser E2E failure and subsequent successful test-env run 44885131579. Verified PR28 promoted parser fix to main with 5/5 parser and 14/14 browser E2E. Verified PR29 and PR30 merged; PR29 main E2E and PR30 feature E2E passed. Found latest main run 44936121486 fails at browser E2E while parser tests pass. Next action is inspect the Playwright artifact and identify the exact failing test.
- **2026-11-22 (failure investigation and fix):** Inspected run 44936121486 logs, screenshot and trace. Identified the sole failing test as the full authenticated E2E journey at `tests/e2e/app-session.spec.ts:102`; Supabase received an opening-balance upsert payload of 0 instead of 2600 because a pending async redraw overwrote the open editor. Implemented guard + awaited redraw in `cashbook.js`, added a request-payload regression assertion, and opened draft PR31. Validation run 44946108610 had parser tests pass; browser tests were still running at the last check. No merge or production deployment performed.
- **Standing instruction:** Update this same file at the end of every Payables Tracker project chat/session, including status-only conversations.
