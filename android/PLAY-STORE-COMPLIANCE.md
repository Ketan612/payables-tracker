# Google Play SMS Permission Readiness

## Product use case

Payables Tracker is a personal money-management application. Its Android companion captures incoming bank transaction alerts so the user can track debit and credit transactions in their own Cash Book. SMS capture is a core feature, not an advertising, profiling, authentication, or messaging feature.

## Policy position

Google Play classifies SMS permissions as restricted personal and sensitive data. Its current policy lists SMS-based money management (for example, apps that track and manage budgets) among exception use cases, subject to review and approval. Eligibility is not automatic and approval must not be assumed.

The app must not request or use restricted SMS permissions until the distribution strategy and required declaration are approved. Do not add placeholder SMS permissions to a release manifest prematurely.

## Data minimization

- Process only newly received messages.
- Locally filter for bank transaction notifications.
- Forward only likely debit/credit/refund/deposit transaction alerts.
- Never upload the user's full SMS inbox.
- Never use SMS data for ads, marketing, profiling, or unrelated product analytics.
- Do not access OTPs, personal conversations, contacts, call logs, or location.
- Keep raw SMS content only as long as required by the existing capture/review workflow and the user's retention controls.

## Required user experience

Before enabling capture, show a prominent disclosure explaining:
- Which messages are accessed (incoming financial transaction SMS only).
- Why they are accessed (populate the user's own money-management ledger).
- What is transmitted (sender and original transaction alert text).
- Where it is sent (the user's authenticated Payables Tracker account).
- How to pause or disconnect capture.

Require affirmative consent. Provide a privacy policy link and an always-available pause/disconnect control.

## Submission checklist

- [ ] Confirm current Play Console policy and exception eligibility at submission time.
- [ ] Complete SMS permissions declaration with accurate core-functionality justification.
- [ ] Supply reviewer instructions and a test account if requested.
- [ ] Provide prominent in-app disclosure and affirmative consent.
- [ ] Publish privacy policy covering SMS access, processing, transmission, retention, deletion and security.
- [ ] Complete Data safety form accurately.
- [ ] Verify that no non-financial SMS content is uploaded.
- [ ] Verify token encryption and no secrets/raw messages in logs.
- [ ] Verify permission denial, revocation, pause, disconnect and uninstall behaviour.
- [ ] Obtain explicit Play approval before public rollout.

## If permission approval is denied

Do not bypass the decision using notification listener access or another API to extract the same SMS data. Keep the automatic SMS feature disabled for Play distribution and reassess a genuinely policy-compliant alternative with the user.
