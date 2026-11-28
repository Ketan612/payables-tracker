# iPhone Daily Particulars — setup guide

This is a separate daily Shortcut. It does not replace the Message automation used to capture bank SMS.

## 1. Create the shortcut

In Apple Shortcuts, create a shortcut named **Payables Tracker — Daily Particulars**.

1. Add **Get Contents of URL** with URL `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/pending-particulars`, Method **POST**, headers `Authorization: Bearer YOUR_PRIVATE_TOKEN` and `Content-Type: application/json`, and JSON body `{}`.
2. Read the response dictionary's `items` value. If `count` is zero, show exactly **No records to review** and stop.
3. Repeat with each item. Show its merchant, amount, date, debit/credit direction, and any suggested particulars.
4. Present the suggestions as choices, with **Other** and **Skip for now**. For **Other**, ask for text. A skipped item is left pending for the next run.
5. For each selected description, immediately add a **Get Contents of URL** action inside the repeat:
   - URL: `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/particulars`
   - Method: **POST**
   - Headers: the same Authorization and Content-Type headers
   - JSON body: `inbox_id` = the current item's `inbox_id`; `particulars` = the selected or typed description.
6. Check the response's `ok` value. If true, show a short **Saved** confirmation and continue. If false or the request fails, show the returned error and leave that item pending for retry. Do not add failed items to a batch or mark them complete.
7. Do not use the `particulars-batch` endpoint. Each successful item is saved before the Shortcut moves to the next item, so an interruption does not discard earlier saves.

## 2. Schedule it daily

1. Open **Shortcuts → Automation → + → Time of Day**.
2. Choose your preferred time and set Repeat to **Daily**.
3. Select **Run Immediately** where available.
4. Choose **Run Shortcut** → **Payables Tracker — Daily Particulars**.

Use the same private capture token generated in Payables Tracker. Keep it private and replace it in both shortcuts if you revoke it.

## 3. Important behaviour

- The existing incoming Message automation remains separate and unchanged.
- Existing particulars must never be overwritten by a later Shortcut run.
- Cash Book rows that already have particulars are not part of the pending queue.
- The Shortcut can only be installed on your iPhone by creating it in Apple Shortcuts; this guide does not contain or expose your private token.
