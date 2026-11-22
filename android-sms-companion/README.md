# Payables Tracker SMS Notification Companion (Android)

Android-only notification listener for capturing newly arriving bank/UPI SMS notifications. It does not request `RECEIVE_SMS`, read the SMS provider/inbox, or access historical messages.

## User setup
1. Generate an Android capture token in the signed-in Payables Tracker SMS Monitor page.
2. Install the companion APK.
3. Paste the token and save it.
4. Review the in-app disclosure, accept consent, and enable **Payables Tracker notification capture** under Android Notification Access settings.
5. Set the messaging app you use (for example Google Messages or Samsung Messages) as Android's default SMS app. The listener only processes notifications posted by that selected default SMS app.
6. Keep SMS notifications enabled for that messaging app. Incoming bank/UPI SMS notifications that Android displays are filtered and queued for forwarding.

## Scope and limitations
Android Notification Access is a broad OS capability. The companion's code filters package names to the current default SMS app before inspecting notification content. It cannot read SMS notifications that the messaging app does not post, that are suppressed, or that Android hides. Notification layouts vary by messaging app and device; validate on the target device. Notification Access is not a guaranteed substitute for inbox access.

## Data handling
Matching notification text and its conversation title are encrypted before being placed in WorkManager's persistent queue and sent over HTTPS to the existing Supabase Edge Function. The existing backend remains authoritative for parsing, duplicate detection, account mapping and Cash Book/review handling. OTP/authentication exclusions are best-effort.

## Build and tests
JDK 17 and Android SDK 35; run `gradle :app:testDebugUnitTest :app:assembleDebug` from this directory.

## Permissions
The app requests internet access and registers an Android NotificationListenerService protected by `BIND_NOTIFICATION_LISTENER_SERVICE`. It does not declare `RECEIVE_SMS` or register an SMS broadcast receiver.
