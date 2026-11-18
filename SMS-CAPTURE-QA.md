# SMS Capture QA Checklist

This document is a repeatable verification plan for the Cash Book SMS Capture module. It is intentionally separate from the production UI.

## Scope and prerequisites

- Use a test Cash Book account, not an account with real expenses.
- The browser UI is in `sms-capture.html`; setup instructions are also shown in the page.
- The capture and token registration endpoints are hosted as Supabase Edge Functions and are not versioned in this repository. Do not mark endpoint/parser checks complete from frontend-only checks.
- A database-level unique key or server-side atomic dedupe is required to guarantee no duplicate Cash Book movement when two separate inbox items with the same reference are approved concurrently.

## Expected parser regression cases

| Case | Expected parse |
|---|---|
| SBI UPI debit: ₹78 to Raj Market, 17 Nov 2026, Ref 632163009448 | direction `out`, amount `78.00`, date `2026-11-17`, description includes `Raj Market`, reference `632163009448`, account identifier `X3142` |
| SBI UPI debit: ₹46 to LALIT MEDICAL, 15 Nov 2026, Ref 631955024954 | direction `out`, amount `46.00`, date `2026-11-15`, description includes `LALIT MEDICAL`, reference `631955024954` |
| Debit/UPI sent | direction `out`; amount and payee extracted; ref/UTR retained if present |
| Credit/UPI received | direction `in`; amount and payer extracted; ref retained if present |
| IMPS/NEFT transfer | direction inferred from debit/credit wording; amount and UTR/ref retained |
| Card purchase / POS | debit direction, amount, merchant, transaction date retained |
| Balance-only, OTP, login, promotional SMS | not posted as a Cash Book transaction |
| Unknown or ambiguous message | no auto-post; review inbox or safe rejection |

Parser behavior for formats not covered by a passing regression test must remain conservative: no guessed direction, amount, date, merchant, or reference.

## UI and token lifecycle

- [ ] Sign in and open Cash Book → SMS Capture Settings.
- [ ] Account list loads; account errors are visible rather than silently ignored.
- [ ] Generate token. Verify it is shown only once and can be copied.
- [ ] Verify token list shows active token without displaying its plaintext value.
- [ ] Revoke token; verify it changes to revoked and the UI refreshes.
- [ ] Register a replacement token after revocation.
- [ ] Verify the revoked token is rejected by the capture endpoint and the replacement token is accepted.
- [ ] Verify missing token, malformed JSON, invalid message, and unauthorized requests fail safely.

## Account mappings

- [ ] Map SBI identifier `X3142` to the correct test Cash Book account.
- [ ] Confirm identifier mapping takes precedence over sender/default mapping.
- [ ] Add a sender/default account mapping and confirm it is used only when no identifier mapping matches.
- [ ] Remove a mapping and verify it no longer applies.
- [ ] Verify account names are escaped and no account selection can cross user ownership.

## Review inbox

- [ ] Uncertain SMS appears in `needs_review` with extracted fields and account selector.
- [ ] Reject changes the inbox status to `ignored` and does not create a Cash Book movement.
- [ ] Approve creates exactly one movement with the selected account, parsed date, direction, amount, description, and reference.
- [ ] Retry approval on the same inbox item does not create another movement.
- [ ] Re-forward the same SMS/reference and confirm the duplicate is blocked or flagged.
- [ ] If two pending inbox rows share a reference, reject one and verify the remaining `needs_review` row can still be approved. An `ignored` row must not permanently block the valid transaction.
- [ ] Force a duplicate-check query error and confirm the item is restored to review with no movement created.
- [ ] Force Cash Book insert failure and confirm inbox returns to review.
- [ ] Force the inbox update after insert to fail and confirm rollback is attempted and its deleted row is verified. If rollback cannot be confirmed, the inbox item must remain `posted` / locked (not reappear as approvable); inspect Cash Book before manual recovery.
- [ ] Approve two separate inbox rows with the same reference at nearly the same time. This is a required concurrency test and must be protected by a database uniqueness constraint/server-side atomic operation before release.

## iPhone Shortcuts

- [ ] Create a Personal Automation for Message and restrict it to bank sender(s) and transaction keywords.
- [ ] Forward only the full incoming Message variable to the capture endpoint.
- [ ] Send a JSON POST with `message` and optional `sender`.
- [ ] Use `Authorization: Bearer YOUR_GENERATED_TOKEN` and `Content-Type: application/json`.
- [ ] Do not forward OTP, authentication, login, balance-only, or promotional SMS.
- [ ] Test with one non-sensitive transaction alert, confirm the inbox/Cash Book result, and re-forward the same SMS to test duplicate handling.

## Evidence log (complete only after live tests)

| Check | Result | Evidence / date |
|---|---|---|
| Static HTML/JS checks | PASS | 2026-11-19: V8 syntax compilation; 16 unique HTML IDs; all JavaScript `$()` ID references resolve; both inbox duplicate queries filter to `needs_review` / `posted`. |
| Token create / revoke | Not verified in this environment | |
| Identifier mapping persistence | Not verified in this environment | |
| Sender/default mapping persistence | Not verified in this environment | |
| Review approve/reject posting | Not verified in this environment | |
| Capture/register endpoint behavior | Not verified in this environment | |
| Parser regression cases | Prior local result reported; not rerun here | |
| Reference dedupe sequential | Not verified in this environment | |
| Reference dedupe concurrent / atomic | Blocked until DB/server-side protection verified | |
| Production deployment | READY | 2026-11-19: commit `456e8d2263cf3cad4ba0c6b81655b7e44f5540ae`; aliases assigned to `payables-tracker-ten.vercel.app`, `payables-tracker-ketan-soni.vercel.app`, and `payables-tracker-git-main-ketan-soni.vercel.app`. |
| Production page browser access | Blocked | 2026-11-19: production `sms-capture.html` could not be opened from this environment (web access reported URL inaccessible). |

Never mark the module ready from static UI checks or a Vercel `READY` deployment alone. A release-ready report must include live endpoint results and the concurrent duplicate test evidence.
