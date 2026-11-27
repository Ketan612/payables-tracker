# iPhone SMS Capture — first-time setup

This setup keeps bank SMS capture automatic after the one-time iOS configuration. It does not ask for purchase particulars for every incoming message.

## 1. Generate your private capture token

1. Sign in to Payables Tracker and open **Cash Book → SMS Capture**.
2. Tap **Generate new token**.
3. Copy the token immediately. It is shown only once; the database stores only its hash.
4. Keep it private. Do not paste it into a public document, screenshot, or support message.

## 2. Create the SMS Capture shortcut

In Apple **Shortcuts**:

1. Tap **+** to create a shortcut and name it **Payables Tracker — Capture SMS**.
2. Add **Get Contents of URL**.
3. Set URL to `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/capture`.
4. Set Method to **POST**.
5. Add headers:
   - `Authorization` = `Bearer YOUR_PRIVATE_TOKEN` (replace the placeholder on your device only)
   - `Content-Type` = `application/json`
6. Set Request Body to **JSON** with two text fields:
   - `message` = the incoming message text supplied by the Message automation
   - `sender` = the incoming message sender
7. Add **Show Result** (or a notification) for the response while testing. You can remove this once verified.

The endpoint accepts `message` and `sender`; it parses the SMS and records it in the review inbox or Cash Book according to the existing validation and account-mapping rules. Never configure this shortcut to forward OTPs, login codes, balance-only alerts, or promotional messages.

## 3. Create the Message personal automation

1. Open **Shortcuts → Automation → + → Message**.
2. Choose the sender (your bank) and any available message-content filter that reliably matches transaction alerts.
3. Select **Run Immediately** (or turn **Ask Before Running** off on older iOS versions).
4. Choose **Run Shortcut** and select **Payables Tracker — Capture SMS**.
5. Pass the Message automation's message text and sender as the shortcut input. If your iOS version exposes these as separate variables, select the message body and sender variables explicitly.
6. Save and enable the automation.

Apple requires this personal automation to be created on the user's own device. A website cannot silently install or enable it.

## 4. Map the bank account

1. Return to **SMS Capture → Account identifier mappings**.
2. Enter the account digits/identifier that appears in the SMS (for example, the last digits of the account).
3. Select the matching Cash Book account and save.
4. If the bank's SMS does not expose an account identifier, use the existing sender/default mapping flow if available.

## 5. Test safely

1. Use a new, genuine low-value bank transaction alert (do not replay an old SMS unless you understand duplicate detection).
2. Confirm the response is successful.
3. Confirm the item appears in the SMS inbox or Cash Book under the expected account.
4. Confirm the amount, date, and debit/credit direction before relying on automatic posting.

## Security and troubleshooting

- If the token is exposed, revoke it in SMS Capture and generate a replacement. Update the token in your shortcut.
- A 401 response means the token is missing, invalid, or revoked.
- A `needs_review` response means the message was captured but one or more fields or account mappings need review.
- A duplicate response means the app detected an existing transaction; do not try to force-post it.
- The shortcut is separate from the daily particulars shortcut. Keep the original automatic capture flow independent.
