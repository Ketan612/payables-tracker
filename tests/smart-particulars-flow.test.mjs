import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [edge, cashbook, cashbookHtml, captureHtml, captureJs, migration] = await Promise.all([
  read("../supabase/functions/sms-capture/index.ts"),
  read("../cashbook.js"),
  read("../cashbook.html"),
  read("../sms-capture.html"),
  read("../sms-capture.js"),
  read("../supabase/migrations/20261127075144_cashbook_smart_particulars.sql"),
]);

test("capture response returns merchant suggestions and a stable inbox id", () => {
  assert.match(edge, /suggested_particulars:suggestedParticulars/);
  assert.match(edge, /inbox_id:inbox\.id/);
  assert.match(edge, /buildParticularSuggestions\(savedParticulars\)/);
});

test("the iPhone particulars endpoint is token-scoped and updates the inbox and Cash Book", () => {
  assert.match(edge, /if\(path==="particulars"\)/);
  assert.match(edge, /eq\("user_id",userId\)/);
  assert.match(edge, /user_particulars:particulars/);
  assert.match(edge, /from\("cash_movements"\)\.update\(\{particulars\}\)/);
  assert.match(edge, /from\("cashbook_merchant_particulars"\)/);
});

test("manual review approval carries selected particulars into the ledger", () => {
  assert.match(captureJs, /particulars:String\(r\.user_particulars\|\|""\)\.trim\(\)\|\|null/);
});

test("Cash Book displays and edits particulars separately from the raw description", () => {
  assert.match(cashbook, /x\.particulars\|\|cleanParticular\(x\.description/);
  assert.match(cashbook, /particulars-merchant/);
  assert.match(cashbook, /editTxnParticulars/);
  assert.match(cashbook, /particulars:\$\("editTxnParticulars"\)\.value\.trim\(\)\|\|null/);
  assert.match(cashbookHtml, /id="editTxnParticulars"/);
  assert.match(cashbookHtml, /id="particulars"/);
});

test("iPhone Shortcut instructions explain suggestions, Other, Skip, and the save endpoint", () => {
  assert.match(captureHtml, /Choose from List/);
  assert.match(captureHtml, /suggested_particulars/);
  assert.match(captureHtml, /Skip for now/);
  assert.match(captureHtml, /sms-capture\/particulars/);
  assert.match(captureHtml, /duplicate: true/);
});

test("merchant memory has RLS and authenticated Data API grants", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /grant select, insert, update, delete on public\.cashbook_merchant_particulars to authenticated/i);
  assert.match(migration, /grant all on public\.cashbook_merchant_particulars to service_role/i);
});


test("daily pending endpoint returns only unlabeled review and posted records", () => {
  assert.match(edge, /if\(path==="pending-particulars"\)/);
  assert.match(edge, /\.in\("status",\["needs_review","posted"\]\)/);
  assert.match(edge, /\.is\("user_particulars",null\)/);
  assert.match(edge, /alreadySet/);
  assert.match(edge, /suggested_particulars:buildParticularSuggestions/);
});

test("batch endpoint validates bounded batches and reports per-item outcomes", () => {
  assert.match(edge, /if\(path==="particulars-batch"\)/);
  assert.ok(edge.includes("items.length>100"));
  assert.ok(edge.includes("await saveParticulars(inboxId"));
  assert.ok(edge.includes("succeeded,failed:results.length-succeeded,results"));
});

test("daily iPhone Shortcut fetches a queue and submits one batch after selection", () => {
  assert.match(captureHtml, /Time of Day/);
  assert.match(captureHtml, /pending-particulars/);
  assert.match(captureHtml, /BatchItems/);
  assert.match(captureHtml, /particulars-batch/);
  assert.ok(captureHtml.includes("After <b>End Repeat</b>"));
});

test("batch result retains inbox IDs for retry and Cash Book updates precede inbox completion", () => {
  assert.match(edge, /results\.push\(\{inbox_id:inboxId,\.\.\.saved\}\)/);
  assert.ok(edge.indexOf('from("cash_movements").update({particulars})') < edge.indexOf('from("sms_capture_inbox").update({user_particulars:particulars})'));
});
