# iPhone Daily Particulars — setup guide

This is a separate daily Shortcut. It does not replace the Message automation used to capture bank SMS.

## 1. Create the shortcut

In Apple Shortcuts, create a shortcut named **Payables Tracker — Daily Particulars**.

1. Add **Get Contents of URL** with URL `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/pending-particulars`, Method **POST**, headers `Authorization: Bearer YOUR_PRIVATE_TOKEN` and `Content-Type: application/json`, and JSON body `{}`.
2. Get the response dictionary's `items` value. If `count` is zero, show “No transactions need particulars today” and stop.
3. Repeat with each item. Show its merchant, amount, date, and debit/credit direction.
4. Present `suggested_particulars` as choices. Include an **Other** choice (ask for text) and **Skip for now**. A skipped item is not submitted and remains pending for the next run.
5. For each selected description, add a dictionary with `inbox_id` (the current item's `inbox_id`) and `particulars` (the selected or typed description) to a list variable named `BatchItems`.
6. After the repeat, if BatchItems is empty, stop.
7. Add one **Get Contents of URL** with URL `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/particulars-batch`, Method **POST**, the same headers, and JSON body with `items` = `BatchItems`.
8. Show the returned `succeeded` and `failed` counts. Failed items are reported individually and remain eligible for retry.

## 2. Schedule it daily

1. Open **Shortcuts → Automation → + → Time of Day**.
2. Choose your preferred time and set Repeat to **Daily**.
3. Select **Run Immediately** where available.
4. Choose **Run Shortcut** → **Payables Tracker — Daily Particulars**.

Use the same private capture token generated in Payables Tracker. Keep it private and replace it in both shortcuts if you revoke it.
