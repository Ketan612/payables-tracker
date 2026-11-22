# Payables Tracker SMS Companion (Android)
Minimal Android-only SMS forwarder. It has no finance dashboard and does not parse or store transaction history.

## User setup
1. Generate an Android capture token in the signed-in Payables Tracker SMS Monitor page.
2. Install the companion APK.
3. Paste the token and save it.
4. Grant SMS permission when Android permits it.
5. Incoming credit/debit transaction alerts are queued and POSTed to the existing Supabase Edge Function.

## Endpoint
POST `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/capture`
Headers: `apikey` (Supabase publishable key), `Authorization: Bearer <capture token>`, `Content-Type: application/json`.
Body: `{"message":"<full SMS text>","sender":"<originating address>"}`

Existing backend parsing, duplicate detection, account mapping and Cash Book/review handling remain authoritative.

## Build
JDK 17 and Android SDK 35; run `gradle :app:assembleDebug` from this directory.

## Permission limitation
`RECEIVE_SMS` is a hard-restricted Android permission on supported versions. Declaring it and showing a runtime prompt does not guarantee an APK installed outside Google Play can receive it; the installer must allowlist restricted permissions. Test on the actual target device before distributing. Google Play also requires a permission declaration and approval. This project is not release-ready until that test passes.
