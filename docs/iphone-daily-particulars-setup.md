# iPhone Daily Particulars — setup guide

This is a separate daily Shortcut. It does not replace the Message automation used to capture bank SMS.

## 1. Create the shortcut

In Apple Shortcuts, create a shortcut named **Payables Tracker — Daily Particulars**.

### Load the pending transactions

1. Add **Get Contents of URL** with URL `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/pending-particulars`, Method **POST**, headers `Authorization: Bearer YOUR_PRIVATE_TOKEN` and `Content-Type: application/json`, and JSON body `{}`.
2. Add **Get Dictionary Value** for key `count`. Add an **If** action: if count is `0`, use **Show Alert** with the exact text **No records to review**, then **Stop This Shortcut**. Put the remaining actions in the Otherwise branch.
3. In Otherwise, get the dictionary value for key `items`, then add **Repeat with Each** using that list.

### Inside Repeat with Each — show details and let me choose

4. Get these values from **Repeat Item** using **Get Dictionary Value**: `merchant`, `amount`, `date`, `direction`, `movement_type`, and `suggested_particulars`.
5. Add **Show Alert** to display the transaction details only, for example:
   - Merchant: [merchant]
   - Amount: ₹[amount]
   - Date: [date]
   - Direction: [direction]
   - Type: [movement_type]

   This alert is informational. Its **OK** button only dismisses the details; it does not choose or save particulars.
6. Add a **List** action containing exactly two extra options: `Other` and `Skip for now`.
7. Add **Combine Lists**. Combine the `suggested_particulars` list from the current Repeat Item with the List containing `Other` and `Skip for now`.
8. Add **Choose from List** and set its input to the combined list. This is the actual selection screen. The user must tap a suggested particular, **Other**, or **Skip for now**.
9. Add an **If** action for the selected result:
   - If result is **Skip for now**, do nothing for this item and continue the Repeat.
   - Otherwise, if result is **Other**, add **Ask for Input** (Text) with prompt `Enter particulars`. Use its answer as the selected particulars.
   - Otherwise, use the selected suggested particular as the particulars value.

### Inside the non-skip branch — save this one item immediately

10. Add **Get Dictionary Value** from **Repeat Item** for key `movement_id`.
11. Add **Get Contents of URL** immediately after the selection, inside the non-skip branch:
   - URL: `https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/particulars`
   - Method: **POST**
   - Headers: the same Authorization and Content-Type headers
   - Request Body: **JSON**
   - JSON field `movement_id`: the value from step 10
   - JSON field `particulars`: the selected or typed description
12. Get the response dictionary's `ok` value. If true, show **Saved**. If false, show the returned `error` value and leave the item pending for retry. If the request itself fails, show the error and do not mark it complete.
13. Continue the Repeat with Each. Each successful item is saved before the next item is processed. Do not collect choices for a batch and do not call `particulars-batch`.

**Important:** Do not use only **Show Alert** for the selection step. The screen in the screenshot with a single **OK** button is just the details alert. You must add **Choose from List** (step 8) after it.

## 2. Schedule it daily

1. Open **Shortcuts → Automation → + → Time of Day**.
2. Choose your preferred time and set Repeat to **Daily**.
3. Select **Run Immediately** where available.
4. Choose **Run Shortcut** → **Payables Tracker — Daily Particulars**.

Use the same private capture token generated in Payables Tracker. Keep it private and replace it in both shortcuts if you revoke it.

## 3. Important behaviour

- The existing incoming Message automation remains separate and unchanged.
- Existing particulars must never be overwritten by a later Shortcut run.
- All Cash Book movement types are included when particulars are blank, including SMS, manual, and settlement entries.
- Cash Book rows that already have particulars are not part of the pending queue.
- Each save uses a database transaction: Cash Book particulars and any linked posted SMS inbox particulars are updated atomically; existing values are preserved.
- The Shortcut can only be installed on your iPhone by creating it in Apple Shortcuts; this guide does not contain or expose your private token.
