import test from "node:test";
import assert from "node:assert/strict";
import { parseSms } from "../supabase/functions/sms-capture/sms-parser.js";

test("ICICI account debit stays a debit when the beneficiary is described as credited", () => {
  const parsed = parseSms("ICICI Bank Acct XX157 debited for Rs 9140.00 on 21-Nov-26; CHETAN RAVINDRA credited. UPI:750372998883. Call 18002662 for dispute. SMS BLOCK 157 to 9215676766");
  assert.equal(parsed.amount, 9140);
  assert.equal(parsed.direction, "out");
  assert.equal(parsed.date, "2026-11-21");
  assert.equal(parsed.account_identifier, "157");
  assert.equal(parsed.reference_number, "750372998883");
  assert.equal(parsed.description, "CHETAN RAVINDRA");
  assert.equal(parsed.reason, null);
});

test("account credit stays a credit when the counterparty is described as debited", () => {
  const parsed = parseSms("ICICI Bank Acct XX157 credited for Rs 1250.00 on 21-Nov-26; RAHUL SHARMA debited. UPI:750372998884.");
  assert.equal(parsed.direction, "in");
  assert.equal(parsed.amount, 1250);
  assert.equal(parsed.date, "2026-11-21");
  assert.equal(parsed.description, "RAHUL SHARMA");
});

test("ordinary debit and credit alerts retain their existing direction", () => {
  assert.equal(parseSms("A/c XX3142 debited by Rs.78 on 17 Nov 2026 to Raj Market Ref 632163009448").direction, "out");
  assert.equal(parseSms("Your A/c XX3142 credited with INR 500 on 17 Nov 2026").direction, "in");
});

test("messages containing both debit and credit words without account context remain in review", () => {
  const parsed = parseSms("Transfer debited from one account and credited to another for Rs 500 on 21-Nov-26");
  assert.equal(parsed.direction, null);
  assert.equal(parsed.reason, "Could not determine debit/credit");
});

test("missing transaction date is never guessed", () => {
  const parsed = parseSms("ICICI Bank Acct XX157 debited for Rs 9140.00; CHETAN RAVINDRA credited. UPI:750372998883");
  assert.equal(parsed.direction, "out");
  assert.equal(parsed.date, null);
  assert.equal(parsed.reason, "Transaction date not found; manual review required");
});

test("invalid calendar dates are rejected instead of rolled into another month", () => {
  for (const message of [
    "A/c XX3142 debited Rs 50 on 31-Feb-2026",
    "A/c XX3142 debited Rs 50 on 31/04/2026",
    "A/c XX3142 debited Rs 50 on 29-Feb-2025"
  ]) {
    const parsed = parseSms(message);
    assert.equal(parsed.date, null, message);
    assert.equal(parsed.reason, "Transaction date not found; manual review required", message);
  }
});

test("valid leap-day dates are retained", () => {
  const parsed = parseSms("A/c XX3142 debited Rs 50 on 29-Feb-2024");
  assert.equal(parsed.date, "2024-02-29");
  assert.equal(parsed.reason, null);
});
