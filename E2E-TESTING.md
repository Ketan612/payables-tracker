# Payables Tracker browser testing
Playwright end-to-end tests run against the deployed application using a dedicated Supabase test user, never the production owner's account.

## Required GitHub Actions secrets
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key. Used only by the CI provisioning script; never commit or expose it in frontend code.
- `TEST_USER_EMAIL`: Dedicated test-only email address.
- `TEST_USER_PASSWORD`: Strong password for that test account.

The workflow creates the test user if absent. If it exists, it resets that dedicated test user's password. Use an account that is never used for real financial records.

## Run locally
```bash
npm install
npx playwright install chromium
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... BASE_URL=https://payables-tracker-ten.vercel.app npx playwright test
```

## Current coverage
- Login and authenticated navigation across Dashboard, Cash Book and SMS Capture.
- Session persistence after direct navigation and refresh.
- SMS reminder preference control loads for the authenticated user.
- Browser JavaScript errors on Cash Book and SMS Capture.
- Mobile viewport overflow check.

Tests intentionally do not add, approve, reject or delete financial records. Add mutation tests only with explicit fixtures and cleanup scoped to the dedicated test user.

GitHub Actions runs on pushes, pull requests, manual dispatch and daily at 08:00 IST. HTML reports, traces, screenshots and videos are uploaded as a 14-day artifact.