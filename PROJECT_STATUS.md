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
