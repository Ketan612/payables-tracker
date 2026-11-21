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
| Latest main E2E | **Failed; root cause identified** | Run 44936121486: parser passed; 15/16 browser tests passed. Sole failure was Cash Book opening balance race; fix is under PR31 and awaits full E2E validation |
| Vercel | Latest checks seen as Ready | PR28 and PR25 Vercel previews reported Ready; verify latest production deployment separately |
| Render | Previously reported live | Re-verify current deployment/branch before relying on this status |
| Live iPhone SMS forwarding | Pending real-device validation | End-to-end device forwarding and resulting record persistence not yet verified |
| PR31 opening-balance fix | Open / draft; not merged | Parser passed on run 44946212950; browser E2E was running at last check. See PR31 section and P0 plan |

**Important correction to the previous handoff:** PR #25 was merged into `test-env`, not directly into `main`. Its parser fix was later included in PR #28, which promoted the validated `test-env` snapshot to `main`. The parser is present in the current `main` tree. PR25's first workflow run failed in browser E2E, but the subsequent test-env run 44885131579 passed both parser tests and browser E2E.

## Plan of action — priority order

This is the active execution queue. Work top-to-bottom; do not skip validation gates or merge unverified changes.

### P0 — Resolve the current E2E failure / PR31
- [x] Inspect failed main run 44936121486 and its Playwright evidence.
- [x] Identify the failing journey: opening Physical Cash balance at ₹2,600 remained ₹0.
- [x] Confirm root cause from the trace/network request: asynchronous Cash Book redraw overwrote the edit field; Supabase received `opening_balance: 0`.
- [x] Implement guard against rewriting the input while the editor is open.
- [x] Add regression assertion that the upsert request contains 2600.
- [x] Verify main run 44946700141 completed: parser passed, browser E2E failed 15/16; failure still shows ₹0.00 after entering 2600 on main.
- [x] Confirm artifact 14723697034 uploaded with screenshots, video, trace and report.
- [ ] Trigger a fresh full validation specifically on PR31's latest head; prior PR31 runs 44946108610 and 44946212950 were cancelled and do not validate the fix.
- [ ] Review PR31's browser results, screenshots, traces and artifact. Confirm the outgoing Supabase upsert contains 2600 and persisted UI displays ₹2,600.
- [ ] If any test fails, diagnose and fix on the same focused branch; rerun the complete suite.
- [ ] Review PR31 diff and merge only after all required checks pass and the production backup is verified.
- [ ] After merge, verify the exact main commit, production Vercel deployment and Render deployment/branch. Do not assume preview Ready means production is updated.

PR31 details: https://github.com/Ketan612/payables-tracker/pull/31  
Branch: `fix/cashbook-opening-balance-race`; latest known head `d75fbf430953aa35a92308103524262be3bfbc0f` (verify latest PR head before acting).  
Run 44946108610 was cancelled when the tracker commit triggered a newer run; its parser tests passed. Run 44946212950 was cancelled; parser tests passed before cancellation, but browser E2E did not complete. Main run 44946700141 subsequently failed 15/16 browser tests on the same opening-balance assertion, but it tested main without PR31. Artifact 14723697034 contains the full report/video/trace. PR31 remains open/draft and is not merged.

### P1 — Complete SMS integration validation
- [ ] Test invalid and malformed dates; ensure no guessed transaction date is stored.
- [ ] Test duplicate SMS at parser, API/integration and database levels; confirm duplicate detection and no duplicate transaction.
- [ ] Verify account mapping using the live test account and account suffix.
- [ ] Verify the full persistence path: incoming SMS → parser → review/staging → transaction record.
- [ ] Exercise manual-review approval and rejection, including resulting transaction state.
- [ ] Verify admin event monitoring for received, success, failure, duplicate and pending/manual-review events.
- [ ] Confirm non-admin users cannot view admin monitoring or integration event data (UI and RLS).
- [ ] Validate actual iPhone SMS forwarding end-to-end with a controlled test message and verify the resulting record in the app.

### P2 — Validate Physical Cash and custom categories after production release
- [ ] Verify each user gets exactly one system-managed Physical Cash account.
- [ ] Test cash-paid expenses and confirm correct balance/history updates.
- [ ] Test credit-card payments made from Physical Cash and verify linked ledger entries.
- [ ] Test person-to-person settlements paid from Physical Cash and verify linked history.
- [ ] Verify opening-balance create/edit/reload persistence, including zero and non-zero values.
- [ ] Test custom expense category create, edit, selection and persistence.
- [ ] Verify category ownership/isolation between users and RLS enforcement.
- [ ] Check existing-user backfill and new-user account creation without duplicate cash accounts or duplicate ledger rows.

### P3 — Release/deployment and operational checks
- [ ] Before any production merge, create a fresh backup of the current `main` SHA and record backup branch/SHA.
- [ ] Validate the candidate commit on its PR branch with parser tests and the full browser E2E suite.
- [ ] Review the single complete E2E recording/report, not fragmented partial runs.
- [ ] Merge only the validated PR; record merge SHA and workflow evidence.
- [ ] Verify Vercel production deployment points to the expected `main` commit and is healthy.
- [ ] Verify Render production service/workflow points to the expected branch/commit and is healthy.
- [ ] Perform a production smoke test of critical modules without creating unintended financial records.
- [ ] Update this file with exact outcomes, evidence links, remaining risks and the next action.

### Definition of done for the current release
- Parser regression tests pass.
- Full browser E2E suite passes, including the opening-balance network payload and persisted ₹2,600 display assertion.
- Physical Cash, custom categories and SMS monitoring regression coverage is green.
- Backup exists before promotion.
- Main merge SHA and Vercel/Render production commit are verified.
- No unexplained failed/cancelled CI run is represented as a pass.

---

### PR #31 — Cash Book opening-balance race fix (not merged)
- URL: https://github.com/Ketan612/payables-tracker/pull/31
- Branch: `fix/cashbook-opening-balance-race`
- Latest known head at this update: `d75fbf430953aa35a92308103524262be3bfbc0f` (confirm current PR head before merging).
- Status: open, draft; no production merge/deployment.
- Root cause: asynchronous Cash Book redraw could overwrite the opening-balance input after the editor opened. The failed test trace showed the request sent `opening_balance: 0` despite the intended ₹2,600 entry; Supabase accepted the zero.
- Fix: preserve the input while editing, await the post-save redraw and surface refresh errors; regression test asserts the outgoing upsert contains 2600.
- Run 44946108610: cancelled after the next PR commit triggered a newer run; parser tests passed.
- Run 44946212950: parser tests passed; browser E2E was in progress at last verification. This is not yet a passing full-suite result.

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
- The later main run 44936121486 failed in browser tests; the single failing test was subsequently traced to an asynchronous Cash Book redraw overwriting the opening-balance editor. Fix and regression assertion are under PR31; validation is pending.

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
| Latest main workflow run | `44936121486` — parser passed; 15/16 browser tests passed; opening-balance race identified |
| PR31 validation run 1 | `44946108610` — parser passed; browser job cancelled when newer commit triggered another run |
| PR31 validation run 2 | `44946212950` — parser passed; browser E2E in progress at last check |
| PR31 latest known head | `d75fbf430953aa35a92308103524262be3bfbc0f` |
| Latest known main commit at tracker read | `f540851b96e9496b30b047b6c32fb7d4b1c6fb7a` |

## Session update log

- **2026-11-21:** Created this handoff tracker from the PR21 merged-chat summary.
- **2026-11-22:** Located PR25; inspected parser diff and tests.
- **2026-11-22 (status refresh):** Verified PR25 merged to test-env; found initial browser E2E failure and subsequent successful test-env run 44885131579. Verified PR28 promoted parser fix to main with 5/5 parser and 14/14 browser E2E. Verified PR29 and PR30 merged; PR29 main E2E and PR30 feature E2E passed. Found latest main run 44936121486 fails at browser E2E while parser tests pass. Next action is inspect the Playwright artifact and identify the exact failing test.
- **2026-11-22 (PR31 investigation):** Inspected run 44936121486 Playwright evidence; identified the sole failing browser test as the opening-balance save in the authenticated journey. The async redraw overwrote the editor and request sent zero. Fix and payload assertion added in PR31. Run 44946108610 was cancelled after a newer PR commit; run 44946212950 parser tests passed and browser tests were running at last check. No production merge.
- **2026-11-22 (plan refresh):** Replaced the stale one-line next action with a prioritized P0–P3 plan, explicit SMS/Physical Cash/custom-category/deployment checklists, and release definition of done. Added PR31 status and validation evidence.
- **Standing instruction:** Update this same file at the end of every Payables Tracker project chat/session, including status-only conversations.


## Product feature tracking — proposed operating model (2026-11-22)

Keep `PROJECT_STATUS.md`. It is the durable project handoff, architecture/operational notes, release history, verified deployment/test evidence, and current next-action summary. **Do not use it as the only feature backlog**: a long checklist in Markdown is difficult to prioritize, assign, filter, and update as features move through development.

Recommended split of responsibilities:
- **GitHub Issues:** one issue per feature, enhancement, bug, or technical task. Each issue should capture problem/user value, scope, acceptance criteria, priority, dependencies, and test expectations.
- **GitHub Projects board (recommended feature roadmap):** one row/card per issue, with workflow status (Backlog → Ready → In Progress → In Review → Testing → Done), priority (P0–P3), area/module (SMS, Cash Book, Physical Cash, Categories, Cards, Settlements, Admin/Monitoring, Platform/Infra), target release, and blocked/dependency indicator. Link each issue to its PR and relevant Actions run/artifact.
- **Pull Requests:** implementation and code review record; link back to the issue. PR merge is not by itself proof of release—retain deployment verification separately.
- **Milestones/releases:** group issues by planned release/version; close only when acceptance criteria and release checks are complete.
- **PROJECT_STATUS.md:** retain the high-level current snapshot, decisions, release gates, important risks, exact main/backup/deployment SHAs, test evidence, and next action. Link to the board and key issues once established; avoid duplicating every backlog item here.

Operating rules:
1. Every planned feature gets an issue before implementation; no feature exists only as a chat message or checkbox.
2. Every issue has explicit acceptance criteria and a priority. Keep unprioritized ideas in Backlog.
3. Update the board as work changes state; link branch/PR, CI run, recording/artifact, and deployment evidence.
4. Mark Done only after acceptance criteria pass and the intended environment is verified.
5. Keep production backup/merge/deployment gates in this status file and the release checklist; never infer production completion from a green preview.
6. Review the board at the start of each planning session and refresh this file at the end of every project chat.

**Implementation status:** A full GitHub Projects board could not be created through the currently available GitHub connection because it exposes repository issue/PR actions but no GitHub Projects V2 create/update actions. To avoid leaving the backlog untracked, four structured GitHub Issues were created as the first working backlog. The board remains pending until a Projects-capable connection/UI is available.

### Initial GitHub issue backlog
- [ ] [#32 — P0: Resolve PR31 Cash Book opening-balance E2E failure](https://github.com/Ketan612/payables-tracker/issues/32)
- [ ] [#33 — P1: Complete SMS capture and duplicate-detection validation](https://github.com/Ketan612/payables-tracker/issues/33)
- [ ] [#34 — P1: Verify Physical Cash ledger and custom expense categories](https://github.com/Ketan612/payables-tracker/issues/34)
- [ ] [#35 — P2: Verify production release, deployment and operational health](https://github.com/Ketan612/payables-tracker/issues/35)

These issues contain scope and acceptance criteria. Use them as the active structured backlog until a Projects board is available; link implementation PRs and CI evidence back to the corresponding issue.


## Latest workflow status — 2026-11-22

- Latest completed repository workflow run: [44946700141](https://github.com/Ketan612/payables-tracker/actions/runs/44946700141), workflow **Payables Tracker E2E**, branch `main`, commit `48495ded5ee0a749887fa31493071cb9eacd891e`.
- Status: **failed**. Parser regression passed; app startup passed; browser E2E failed (15/16 passed). The authenticated journey entered 2600 but `#openingDisplay` remained ₹0.00 at test line 102. This run used main, so it does not validate PR31's fix.
- Full Playwright artifact uploaded: [artifact 14723697034](https://github.com/Ketan612/payables-tracker/actions/runs/44946700141/artifacts/14723697034), 18.3 MB; includes report, screenshots, video and trace.
- The preceding main run [44946563275](https://github.com/Ketan612/payables-tracker/actions/runs/44946563275) was cancelled after a newer main commit triggered another run.
- PR31 validation run [44946212950](https://github.com/Ketan612/payables-tracker/actions/runs/44946212950) is **cancelled**, not passed. Parser tests had passed before cancellation; browser result is not a valid completion.
- PR31 remains open/draft and unmerged. PR #31 link: https://github.com/Ketan612/payables-tracker/pull/31
- This latest main run was triggered by the documentation/status update commit, not by PR31 code. It is a useful current-main workflow result but does not replace PR31 branch validation.
- Next action: monitor run 44946563275 to completion; then rerun/validate PR31 separately on its latest head, inspect the full E2E recording/report, and only then proceed to backup/release gates.


## Verification update — 2026-11-22 (latest CI check)

- Verified latest completed main run 44946700141: conclusion `failure`; parser regression succeeded; browser E2E failed 15/16.
- Exact failure: `tests/e2e/app-session.spec.ts` line 102; after filling opening balance with `2600` and clicking save, `#openingDisplay` stayed `₹0.00` for 15 seconds.
- Artifact 14723697034 successfully uploaded (18,284,698 bytes), containing Playwright report, screenshots, video and trace.
- This run's SHA is main commit `48495ded5ee0a749887fa31493071cb9eacd891e`; it does not include PR31. Do not use it as evidence for or against the PR31 code fix.
- PR31 head remains `d75fbf430953aa35a92308103524262be3bfbc0f`, open/draft/unmerged. Its last known workflow run 44946212950 was cancelled, so PR31 still needs a fresh completed full E2E run.
- Next action: trigger and monitor a fresh workflow on PR31 head; verify request payload `opening_balance: 2600`, persisted ₹2,600 display, all browser tests, and full artifact before backup/merge.


## Workflow control change — 2026-11-22

- User decision: stop automatically running the E2E suite on every push/commit to `main`; test runs should be deliberately requested.
- Updated `.github/workflows/e2e.yml` on `main` in commit `3844c1b1fa4b4409e736cad10ec794812e592766`.
- Updated the same workflow on PR31 branch in commit `1da2d419043b977ca11cd95a5ca6e27fbd531ed0`.
- New triggers: `pull_request` targeting `main` or `test-env`, plus manual `workflow_dispatch`. Removed push triggers and the scheduled daily run. Consequently, status-file commits to main will no longer start E2E merely because they are pushes.
- PR31 remains open/draft, not merged. Latest head: `1da2d419043b977ca11cd95a5ca6e27fbd531ed0`.
- Checked workflow runs associated with the new PR31 head; no new run was returned at the time of this update. Earlier run `44946212950` has a cancelled browser job and cannot count as validation.
- The available GitHub connection exposes workflow inspection and job rerun actions, but no workflow-dispatch action. Therefore a new manual `workflow_dispatch` run could not be submitted from this session. Do not claim a test was started or passed.
- Next action: use GitHub Actions → Payables Tracker E2E → Run workflow, select branch `fix/cashbook-opening-balance-race`, and run the full suite. Then inspect the browser result and uploaded Playwright artifact. Keep PR31 unmerged until all checks pass.
- Main workflow-control commit is configuration-only; no application code, Supabase schema, or production data was changed.


## Manual PR31 workflow check-in — 2026-11-22

- User reported that the manual workflow was started for PR31.
- PR31 head re-verified as `1da2d419043b977ca11cd95a5ca6e27fbd531ed0`; PR remains open/draft/unmerged.
- The GitHub connection's commit-workflow lookup (which only returns pull-request-triggered runs) returned no run for this head. Combined commit status currently shows Vercel success only; no GitHub Actions result/run ID is exposed yet.
- Therefore execution is **user-reported started, but not independently visible/verified yet**. No test outcome is claimed.
- Await the Actions run ID or run URL to inspect jobs, logs and the full Playwright artifact. Validate parser tests, complete browser suite, opening-balance upsert payload = 2600, persisted ₹2,600 display, and video/screenshots/trace.
- Keep PR31 unmerged until the full run completes successfully.


## PR31 E2E run 44947553597 — 2026-11-22 (in progress)

- Run: https://github.com/Ketan612/payables-tracker/actions/runs/44947553597
- Job: https://github.com/Ketan612/payables-tracker/actions/runs/44947553597/job/136978095669
- Job ID: `136978095669`; job name `browser-tests`.
- Current status at inspection: job `in_progress`; Playwright browser step `in_progress`.
- Completed successfully: checkout, Node setup, npm install, SMS parser regression tests, Chromium install, application startup.
- Pending: Playwright browser suite completion and upload of full Playwright report/screenshots/video/trace.
- Artifact listing currently empty because upload step has not run.
- No pass/fail conclusion yet. Do not merge PR31 or interpret parser success as full E2E success.
- Next action: poll run `44947553597`; after completion inspect browser step conclusion, logs and uploaded artifact. Confirm request payload `opening_balance: 2600` and persisted ₹2,600 display.


## PR31 full E2E verification — 2026-11-22 (PASS)

- Workflow run: https://github.com/Ketan612/payables-tracker/actions/runs/44947553597
- Browser job: https://github.com/Ketan612/payables-tracker/actions/runs/44947553597/job/136978095669
- Tested branch: `fix/cashbook-opening-balance-race`
- Tested commit: `1da2d419043b977ca11cd95a5ca6e27fbd531ed0`
- Job conclusion: **success**. All workflow steps completed, including report upload.
- SMS parser regression: **5/5 passed**.
- Playwright browser suite: **16/16 passed** in 2.4 minutes.
- Complete authenticated E2E journey passed, including Cash Book opening balance, Payables, shared expense, partial/full settlements, credit card outstanding/payment history, SMS auto-post, unmapped SMS review/approval, SMS rejection/token management, and the admin monitor denial for non-admin.
- Other passed coverage: transaction validation/edit/refresh persistence; rapid repeated submit creates one record; Payables filters; Physical Cash/custom category; PWA manifest/install/service worker/mobile/offline checks; two-user RLS isolation.
- Critical regression assertion independently verified in the tested source `tests/e2e/app-session.spec.ts`: wait for successful POST to `/rest/v1/cashbook_opening_balances`, assert `postDataJSON().opening_balance === 2600`, then assert `#openingDisplay` contains `2,600` and closing balance contains `2,600`. The test passed in the 16/16 suite. This confirms the outgoing request and UI assertion; backend persistence is exercised by the authenticated app flow, though no separate direct database query was performed.
- Artifact: [Playwright report, screenshots and videos — 14724322922](https://github.com/Ketan612/payables-tracker/actions/runs/44947553597/artifacts/14724322922), 37,768,465 bytes, 63 files. Downloaded and inspected archive contents; includes the full authenticated journey video, named screenshots for dashboard/Cash Book/Payables/settlements/cards/SMS review and approval, plus per-test videos/screenshots.
- PR31 remains open/draft and **not merged**. No production data or deployment was changed by this validation.
- Next release gates: review PR diff; create and verify a fresh backup of current `main`; then merge only after that backup is confirmed. After merge, verify Vercel production and Render commit/health. Continue pending SMS live-device/duplicate and Physical Cash edge-case validation as separate follow-up work.


## PR31 Cash Book fix released — 2026-11-22

- Fresh pre-merge backup created and verified: `backup/main-before-pr31-cashbook-fix-20261122`.
- Backup SHA: `e6193c36690de1002406e6dcff593f56692a5460`.
- Backup-to-current-main comparison confirms current main is exactly 4 commits ahead of the backup and has no behind commits; backup remains a clean rollback point.
- PR31 was closed as superseded because its branch had fallen 11 commits behind main. Its exact Cash Book fix and regression test were transplanted onto a clean branch based on current main.
- Replacement PR: https://github.com/Ketan612/payables-tracker/pull/36
- PR36 merged successfully. Merge commit: `c59b6124d26e4072ae07968e6d5fd81cf277de73`.
- Main now contains the Cash Book editor redraw-race fix and E2E assertion for successful upsert payload `opening_balance: 2600`, followed by the ₹2,600 opening/closing UI assertions.
- Validation evidence: the exact application/test changes passed in PR31 run `44947553597`: parser 5/5 and Playwright 16/16. PR36 was rebased onto the current main tip without changing those tested source/test changes; the only additional change was workflow trigger configuration.
- E2E trigger policy now in main (`.github/workflows/e2e.yml`):
  - `push` to all branches except `main` runs E2E automatically.
  - `main` has no push, pull-request, or scheduled trigger; it can run only through `workflow_dispatch` (manual run).
  - Pull-request events are disabled so the branch push run is the validation run.
- Vercel production verified READY on main merge SHA `c59b6124d26e4072ae07968e6d5fd81cf277de73`; deployment ID `dpl_7GwUSJtMkFBVECMykffpQx9uGnBt`; URL https://payables-tracker-amnpbxfy4-ketan-soni.vercel.app.
- Render verification is pending workspace selection; no Render service or deployment action was taken.
- No database migration was required for this fix.
- Remaining checks: verify Render service branch/commit and health after the user selects the correct Render workspace; optionally manually dispatch E2E on main after production rollout. Continue pending SMS live-device/duplicate and Physical Cash edge-case validation.


## Render production verification — 2026-11-22

- User confirmed the Render workspace "My Workspace" (`tea-dbjm388ae00c73el4drg`); inspection only, no settings or deployment changes made.
- Located the exact service: `payables-tracker`, service ID `srv-dbjmdq142hec73dfa8t0`, repository `Ketan612/payables-tracker`.
- Service configuration verified: branch `main`; auto-deploy enabled on commit; runtime Python; start command `uvicorn main:app --host 0.0.0.0 --port $PORT`; URL https://payables-tracker.onrender.com; service not suspended.
- Latest Render deployment is live: `dep-dc106q8s00ms7380aqf0`; deployed commit `e5e5260730ab84c82c648ab8115892d8f5303911` (the latest main tracker-status update commit, with PR36 merge in its ancestry).
- Render build event succeeded and deployment-ended event reports succeeded. Runtime logs show Uvicorn started and "Application startup complete"; Render announced "Your service is live".
- App source defines `GET /health` returning `ok: true` and whether the Supabase DB configuration is present. The service has no configured Render healthCheckPath. Render's observed `GET /` and `HEAD /` probes return 404 because no root route is defined; this is not a build/startup failure.
- Direct external HTTP verification of `/health` was not possible through the available network access in this session, so endpoint response and database_configured value remain unconfirmed. No secrets were read.
- No Render configuration, environment variable, service, or deployment setting was changed.
- Remaining operational follow-up: if needed, confirm `https://payables-tracker.onrender.com/health` in a normal browser/client and check `database_configured: true`.

## Operating preference — consolidated execution (2026-11-22)

- User clarified that related Payables Tracker work should be handled end-to-end in one consolidated execution, rather than pausing for approval after each small step or asking the user to say "next".
- Default workflow: read the current status and evidence; inspect dependencies; plan the complete related task; implement changes together on the appropriate branch; run and diagnose tests; produce one consolidated E2E recording/report where supported; create/verify a fresh main backup before production merge; merge only after validation; verify Vercel, Render and application behaviour; then update this file with verified outcomes.
- Ask the user only when a genuine user-only action or explicit authorization is required (for example, account verification, a manual GitHub Actions dispatch unavailable through the connected tools, or a consequential production decision). Do not ask for step-by-step confirmations for routine work already covered by the user's request and standing release rules.
- Continue to respect safety gates: no unapproved production data/settings changes, no merge of unvalidated code, and never report an unverified test/deployment/health check as successful.

## Consolidated pending-work audit — 2026-11-22

### Backlog status refresh
- GitHub issue #32 (Cash Book opening-balance race) closed as completed after PR36 release and verified PR31 candidate E2E evidence: parser 5/5, Playwright 16/16, artifact 14724322922.
- Issues #33 (SMS integration), #34 (Physical Cash/custom categories), and #35 (operational verification) remain open. Added current production audit evidence and gaps as comments to each issue.
- Current Supabase project: `payables-tracker`, ref `magxbczgrxeypryjborr`, region `ap-south-1`, status `ACTIVE_HEALTHY`. All queries below were read-only; no production rows, schema, secrets, or function deployments were changed.

### SMS capture — database and function audit
- Production counts: `sms_capture_inbox` 253 rows — 100 posted, 39 needs_review, 50 duplicate, 64 ignored.
- `sms_capture_events` 261 rows — 59 duplicate, 59 posted, 140 needs_review, 1 cashbook_write_failed, 1 invalid_token, 1 rejected.
- No repeated `(user_id, message_hash)` groups were found. Database unique index `sms_capture_inbox_user_id_message_hash_key` enforces this.
- Database uniqueness guards verified: active inbox reference per user and SMS reference per user in Cash Book movements.
- Current `service_role` has INSERT/SELECT/UPDATE privileges on `cash_movements`; migration history includes the SMS service-role access grant. Active `sms-capture` Edge Function is ACTIVE version 17, updated 2026-11-21.
- One historical `cashbook_write_failed` event exists on 2026-11-19: `permission denied for table cash_movements`. Current grants are present and no later cashbook_write_failed event is recorded. Treat this as a historical failure, not proof of a current outage.
- Event traceability gap found in current function source: duplicate-review events include `source_record_id`, but posted, needs_review and cashbook_write_failed event inserts omit it. Consequently most event rows cannot be joined to their inbox record from the event table. This should be corrected and regression-tested on a branch before deployment.
- Current event-link audit: duplicate outcome has 59 events, 50 linked to duplicate inbox rows; posted outcome has 59 events, 58 with no source link; needs_review has 140 events with no source link. One historical write-failure event has no source link.
- Still pending: controlled signed-in approve/reject/retry tests, same-reference concurrent approval, live iPhone Shortcut forwarding, actual account mapping verification, and non-admin RLS test using a real non-admin session.

### Physical Cash and categories — read-only integrity checks
- 6 profiles; each has exactly one Physical Cash account. No missing or duplicate Physical Cash account among profile owners.
- 25 custom expense categories exist; no duplicate category names per user were found.
- No duplicate Cash Book opening-balance keys `(user_id, account_id, month)` were found.
- Active cash-paid expense/shared-expense transactions: 0 missing payment accounts, 0 missing linked Cash Book movements, and 0 duplicate expense movement groups.
- Cash card payments: 104 rows, all have a payment account. Cash card-bill payments: 4 rows, all have a payment account.
- Cash settlement batches: 4 rows, all have an account. Cash settlements: 4 rows, all have an account.
- One `manual_out` Cash Book movement has no `account_id`; record-level review is needed before classifying it as legacy data or a defect.
- One unconfirmed auth signup created 2026-11-02 has no profile row but has one bank account and seven categories, with no transactions or cash movements. It may be a test signup or manually altered profile. Do not delete or backfill it automatically; confirm intent before any repair.
- UI-level create/edit/reload, cash-funded settlement/card-payment journeys, new-user/existing-user provisioning and cross-user RLS E2E remain pending.

### Operational checks
- Render service remains configured on `main`, auto-deploy on commit; latest recorded deployment `dep-dc106q8s00ms7380aqf0` was LIVE on `e5e5260730ab84c82c648ab8115892d8f5303911`, with successful startup logs.
- Direct access to `https://payables-tracker.onrender.com/health` was attempted but unavailable from the current network client. Actual health JSON and `database_configured` remain unverified.
- Vercel production was previously verified READY on PR36 merge commit `c59b6124d26e4072ae07968e6d5fd81cf277de73`.
- No Render/Vercel settings, deployment, Supabase schema, secrets, or production data were changed in this audit.

### Next consolidated execution order
1. Create a focused branch for SMS observability: include `source_record_id` in posted/needs_review/cashbook_write_failed and other post-inbox outcomes; make event-to-inbox correlation consistent; add tests for invalid date, duplicate, failed-write and retry/approval outcomes; refresh stale `SMS-CAPTURE-QA.md` statements that claim the Edge Function is not versioned in the repository.
2. Run parser regression and full branch E2E once; inspect one complete recording/report. Do not deploy the Edge Function until its code and tests pass and its production-safe behavior is reviewed.
3. Complete Physical Cash controlled UI E2E for opening balance, cash expenses, cash card payments and settlements; investigate the single account-less manual_out and unconfirmed signup as test/legacy candidates without modifying either.
4. Complete live iPhone forwarding and authenticated non-admin RLS checks (these require an actual device/session).
5. Confirm Render `/health` in a normal browser/client and finish safe production smoke checks. Main remains manual-only for E2E; a user-side GitHub Actions workflow_dispatch is still required for a main run if desired.

## PR37 verification update — 2026-11-22

### Latest candidate verification
- PR: https://github.com/Ketan612/payables-tracker/pull/37
- Branch: `fix/sms-event-source-linkage`
- Tested head SHA: `a6b0a0f6a723afff260e28997edfe78e427760c2` (matches PR37 head at verification).
- GitHub Actions run: https://github.com/Ketan612/payables-tracker/actions/runs/44948965134
- Run conclusion: **success**; browser job completed successfully.
- SMS parser regression: **7/7 passed**, including impossible dates (31-Feb, 31-Apr, non-leap 29-Feb) and valid leap-day (29-Feb-2024).
- Playwright: **16/16 passed** (one worker, approximately 2.1 minutes).
- Artifact: [Playwright report, screenshots and videos — 14723854902](https://github.com/Ketan612/payables-tracker/actions/runs/44948965134/artifacts/14723854902), 39,139,867 bytes; uploaded successfully. Artifact expiry shown as 2026-12-05.
- Workflow log warnings: Node.js 20 action-runtime deprecation and Node module-type/URL deprecation warnings; they did not fail the run. Track action-runtime updates separately, not as a blocker for PR37 functionality.
- Confirmed Supabase `sms_capture_events.source_record_id` exists as a UUID column, matching the PR code/admin query.
- PR37 remains OPEN and DRAFT, not merged. No production Edge Function deploy or production data mutation was made by this verification.
- PR37 includes seven files, including a tracker update. Its tracker text was written before this final E2E result and is now superseded by this section; refresh the PR tracker snapshot before merge or ensure main receives the latest verified status.

### What the green run proves — and does not prove
- It proves the candidate commit passed the seven parser unit tests and all 16 existing Playwright browser scenarios, and that the full report/video artifact uploaded.
- The parser tests do not exercise the live Supabase Edge Function event insertion paths. Existing E2E suite passing does not by itself prove every new `source_record_id` outcome (posted, needs_review, cashbook_write_failed, reference duplicate, uniqueness-race duplicate) against the deployed Edge Function.
- The workflow tested the PR branch commit against the configured Supabase test accounts/service credentials. It is not a production deployment verification.
- PR37 can move from draft to review only after a focused code review and targeted integration tests for the new event-linkage paths. Keep production deployment separate.

### Remaining work estimate for final handoff
1. **PR37 review and targeted SMS integration tests (2–4 hours engineering):** inspect event writes and admin query against the real schema; exercise posted/review/failure/duplicate paths in a controlled test environment; verify event.source_record_id points to the expected inbox row; check duplicate replay does not create another Cash Book movement. If these pass, mark PR ready, create a fresh main backup, merge, deploy the versioned Supabase Edge Function and verify deployed version/logging. Do not deploy before targeted integration tests.
2. **Physical Cash/custom-category UI acceptance (2–3 hours):** controlled E2E create/edit/reload for opening balance, cash expense, cash-funded card payment, cash settlement, custom category persistence, and cross-user isolation. Existing database integrity checks were read-only and clean for the audited relationships, but do not replace these UI workflows.
3. **Legacy/test-account reconciliation (30–60 minutes plus owner confirmation):** identify the one `manual_out` cash movement without account_id and the unconfirmed signup lacking a profile. Do not alter either record until its test/legacy status is established.
4. **Device and operational acceptance (30–60 minutes plus user/device time):** run one controlled iPhone Shortcut SMS forward; verify resulting inbox/event/Cash Book record; check Render `/health` in a normal browser and confirm `database_configured: true`; complete safe production smoke checks.
5. **Release closeout (1–2 hours):** fresh main backup, PR merge evidence, Supabase Edge Function deployment/version check, Vercel production SHA/status, Render deployed SHA/health, update issue acceptance evidence, and final status file.

Planning estimate: **about 1 working day of engineering plus access/device-dependent checks**, assuming targeted integration and UI tests pass without new defects. If any test exposes a defect, add a fix-and-rerun cycle; no fixed handoff date is promised.

### Final handoff gate
- [ ] PR37 focused review completed and targeted Edge Function event-link tests pass.
- [ ] PR37 ready, backup created, merge approved and exact main SHA recorded.
- [ ] Supabase Edge Function deployed from the reviewed source and live version verified.
- [ ] Physical Cash/custom-category UI acceptance and two-user isolation pass.
- [ ] Legacy account-less movement and unconfirmed signup disposition recorded without unsafe cleanup.
- [ ] Controlled iPhone Shortcut test passes.
- [ ] Vercel production and Render deployment/health verified on expected release.
- [ ] Production smoke test and issue closeout complete.

### Latest documentation-only head check — 2026-11-22
- To avoid a merge conflict on the shared handoff file, PR37's `PROJECT_STATUS.md` was synchronized to the current main copy (the file contents now match main).
- This produced PR branch head `f727b8370c2fb21561943d2476cac32f58f3af92`; application/function/test code is unchanged from the fully validated commit `a6b0a0f6a723afff260e28997edfe78e427760c2`.
- A new workflow run for the documentation-only head is running: [44949340100](https://github.com/Ketan612/payables-tracker/actions/runs/44949340100). At the latest check it had completed checkout and was installing dependencies; parser and Playwright steps had not started.
- PR37 remains draft/open and not merged. GitHub reported it mergeable at the latest PR metadata check. The full 7/7 + 16/16 validation on the unchanged application code is already green on run 44948965134; run 44949340100 is a fresh latest-head confirmation.
