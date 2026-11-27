# iPhone SMS Capture — first-time setup

This setup uses two separate Shortcuts. Run **Save File** once to capture and save your Payables Tracker token, then use **Capture Financial Messages** for incoming bank SMS. The Message automation is created on the iPhone and runs automatically after setup.

## 1. Generate your private capture token

1. Sign in to Payables Tracker and open **Cash Book → SMS Capture**.
2. Tap **Generate new token**.
3. Copy the token immediately. It is shown only once; the database stores only its hash.
4. Keep it private. Never include it in a screenshot, public document, or support message.

## 2. Run Save File once

1. [Add the Save File Shortcut from iCloud](https://www.icloud.com/shortcuts/e38a8a1dcbbc48938cf37159fe0c95ef), then open it in Apple Shortcuts.
2. Run it once.
3. When prompted, paste the private token generated in Payables Tracker.
4. Let the Shortcut create its **Payables Tracker** folder and save the provided input.
5. Confirm the Shortcut finishes successfully.

You do not need to create the folder manually. Do not add the word `Bearer` to the token when saving it; Bearer is part of the API Authorization header, not the token itself.

## 3. Set up Capture Financial Messages

1. [Add Capture Financial Messages from iCloud](https://www.icloud.com/shortcuts/2116528f970c4895a9d7538440928c12), then open it in Apple Shortcuts.
2. Keep its existing capture endpoint, POST method, JSON message/sender fields, and Authorization header structure unchanged.
3. Replace only the placeholder in the existing Authorization value with your own private token, keeping the format `Bearer <your private token>`. Never share your personal token or publish a Shortcut containing it.
4. Run a manual test with a suitable transaction alert and confirm the endpoint returns a successful capture response.

The capture endpoint is `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/capture`. It parses the SMS and records it in the review inbox or Cash Book according to existing validation and account-mapping rules.

## 4. Create the Message personal automation

1. Open **Shortcuts → Automation → + → Message**.
2. Choose the bank sender and, if available, a message-content filter that matches transaction alerts.
3. Select **Run Immediately** (or turn **Ask Before Running** off on older iOS versions).
4. Choose **Run Shortcut** and select **Capture Financial Messages**.
5. Pass the Message automation's message text and sender as the shortcut input.
6. Save and enable the automation.

Apple requires this personal automation to be created and enabled on the user's own device. A website cannot silently install or enable it.

## 5. Map the bank account and test

1. Return to **SMS Capture → Account identifier mappings**.
2. Enter the account identifier shown in the bank SMS and select the matching Cash Book account.
3. Test with a new, genuine low-value transaction alert.
4. Confirm the response is successful and the transaction appears under the expected account.
5. Verify amount, date, and debit/credit direction before relying on automatic capture.

Never configure the automation to forward OTPs, login codes, balance-only alerts, or promotional messages.

## Security and troubleshooting

- Treat the token as a password. Never share it or publish a Shortcut containing your personal token.
- If the token is exposed, revoke it in SMS Capture, generate a replacement, and update your local Shortcut setup.
- A 401 response means the token is missing, invalid, or revoked.
- A `needs_review` response means the message was captured but one or more fields or account mappings need review.
- A duplicate response means the app detected an existing transaction; do not try to force-post it.
- Keep the daily particulars Shortcut separate from the incoming Message automation.
