# Google Play SMS permission declaration — Payables Tracker

## Intended permission and eligible use case
- Permission: `android.permission.RECEIVE_SMS`
- Requested use case: **SMS-based money management** (Google Play's published eligible exception category, subject to review and approval).
- Core feature: optional capture of newly received bank/UPI transaction alerts into the user's own Payables Tracker Cash Book and review inbox.

## Suggested declaration text
Payables Tracker is a personal-finance and money-management application. The Android companion's sole SMS-related purpose is to help the signed-in account holder capture their own newly received bank and UPI transaction alerts as financial records. After the user enters a dedicated device token, reads the in-app disclosure, affirmatively opts in, and grants Android permission, the app receives new SMS broadcasts, locally filters for transaction-like credit/debit alerts, excludes likely OTP/authentication messages, and forwards only matching message text and sender address over HTTPS to the user's Payables Tracker account. The backend uses the data only for transaction parsing, duplicate detection, account mapping, and the user's Cash Book/review workflow.

The app does not read or upload SMS history, does not access contacts, does not send SMS, does not use message data for advertising or profiling, and does not sell SMS data. Users can pause forwarding in the app and revoke/rotate the device token. Filtering is best-effort and captured records remain subject to user review.

## Reviewer instructions to include
1. Sign in using a dedicated Play review test account created for this purpose; never provide a production user's credentials.
2. Open the Android SMS Companion and review the prominent SMS disclosure and privacy notice.
3. Enter a dedicated review device token issued for the review account.
4. Grant SMS access only after accepting the disclosure.
5. Send a controlled test transaction SMS to the test device, then verify that only the matching new message reaches the review account's SMS review/Cash Book workflow.
6. Verify that an OTP-like message and an ordinary non-transaction SMS are not forwarded.
7. Verify that turning off consent stops subsequent forwarding.

## Evidence to prepare before submission
- Public HTTPS privacy policy URL, linked from the app and Play listing.
- Screenshots/video of the disclosure before consent and permission request.
- Demonstration of transaction-only filtering, OTP exclusion, and no SMS-history access.
- Data-flow diagram: Android device -> HTTPS Supabase Edge Function -> user's Payables Tracker review/Cash Book.
- Explanation of encryption at rest for device token and queued payloads, and HTTPS transport.
- Dedicated reviewer account and test instructions.
- Current signed Android App Bundle built from the reviewed source.

## Important
Google Play's SMS-based money-management category is an eligible exception, not an automatic approval. Submit the accurate Permissions Declaration Form in Play Console and wait for Google's decision. Do not distribute the SMS-permission APK through internet sideloading while Play Protect blocks it. Do not ask users to disable Play Protect or bypass Android security.
