# Google Play internal testing preparation (isolated)

This track is intentionally separate from the Android companion build workflow and all existing application/E2E workflows.

## Isolation guarantees
- The dedicated workflow is triggered only by `workflow_dispatch`; it does not run on pushes, pull requests, or commits.
- It runs only when manually started from this preparation branch.
- It runs Android unit tests and builds a signed Android App Bundle (AAB) for Play Console internal testing.
- It does not modify application source, Supabase, Vercel, production data, branch protections, or existing Android/E2E workflows.
- It does not publish to Google Play automatically.

## Prerequisites
1. A Google Play Console developer account and an app record for package `com.payablestracker.sms`.
2. Confirm the package name is registered to the intended Play Console app.
3. Configure GitHub Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. The workflow fails closed if any are missing.
4. The configured signing key must be the intended Play upload key. Do not rotate or replace an existing distribution key without a migration plan.

## Build and upload
1. Open Actions → **Android Play Internal Testing Package** on branch `prep/google-play-internal-testing`.
2. Select **Run workflow**. This is a manual-only workflow.
3. Wait for Android unit tests, AAB build, and signature verification to pass.
4. Download artifact `payables-sms-companion-play-internal-aab`.
5. In Play Console, create an Internal testing release, upload the AAB, complete app content and data safety declarations, add tester accounts or a tester list, and roll out the release to internal testing.
6. Use the Play-generated opt-in link on the Android device to join the test and install through Google Play.

## Important limitations
- A successful CI build does not guarantee Play Console approval or immediate removal of an existing Play Protect sideload block.
- Internal testing requires Play Console setup and applicable developer verification.
- This workflow intentionally does not upload to Play Console; no Play publishing service account or release authorization has been configured here.
- Notification Access is sensitive. Describe it accurately in Play Console declarations and provide a clear in-app disclosure.
- Existing APK distribution and the current Play Protect appeal remain unchanged.
