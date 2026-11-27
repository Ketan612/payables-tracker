import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [edge, cashbook, cashbookHtml, captureHtml, captureJs, reviewHtml, reviewJs, dailyGuide, migration] = await Promise.all([
  read("../supabase/functions/sms-capture/index.ts"),
  read("../cashbook.js"),
  read("../cashbook.html"),
  read("../sms-capture.html"),
  read("../sms-capture.js"),
  read("../sms-review.html"),
  read("../sms-review.js"),
  read("../docs/iphone-daily-particulars-setup.md"),
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

test("iPhone instructions use a daily review instead of per-SMS prompts", () => {
  assert.match(dailyGuide, /Time of Day/);
  assert.match(dailyGuide, /pending-particulars/);
  assert.match(dailyGuide, /suggested_particulars/);
  assert.match(dailyGuide, /Skip for now/);
  assert.match(dailyGuide, /particulars-batch/);
  assert.match(dailyGuide, /BatchItems/);
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
  assert.match(dailyGuide, /Time of Day/);
  assert.match(dailyGuide, /pending-particulars/);
  assert.match(dailyGuide, /BatchItems/);
  assert.match(dailyGuide, /particulars-batch/);
  assert.match(dailyGuide, /After the repeat/);
});

test("batch result retains inbox IDs for retry and Cash Book updates precede inbox completion", () => {
  assert.match(edge, /results\.push\(\{inbox_id:inboxId,\.\.\.saved\}\)/);
  assert.ok(edge.indexOf('from("cash_movements").update({particulars})') < edge.indexOf('from("sms_capture_inbox").update({user_particulars:particulars})'));
});

test("SMS Admin is setup-only and Cash Book links to both SMS destinations", () => {
  assert.doesNotMatch(captureHtml, /iphone-sms-capture-setup|iphone-daily-particulars-setup/);
  assert.doesNotMatch(captureHtml, /id="inbox"|id="clearReviewInbox"/);
  assert.match(captureHtml, /id="generateToken"/);
  assert.match(captureHtml, /id="mappingForm"/);
  assert.match(cashbookHtml, /href="sms-capture\.html"/);
  assert.match(cashbookHtml, /href="sms-review\.html"/);
});
test("SMS Review owns the pending-message workflow and keeps posting safeguards", () => {
  assert.match(reviewHtml, /id="inbox"/);
  assert.match(reviewHtml, /id="clearReviewInbox"/);
  assert.match(reviewJs, /async function approve/);
  assert.match(reviewJs, /async function reject/);
  assert.match(reviewJs, /^async function loadInbox\(/m);
  assert.doesNotMatch(reviewJs, /if\s*\([^)]*clearReviewInbox[^)]*\)\s*async function/);
  assert.match(reviewJs, /Posting outcome is uncertain/);
  assert.match(reviewJs, /Do not retry/);
});


const [particularsManager, particularsManagerJs, cashbookManagerHtml, particularsMigration] = await Promise.all([
  read("../particulars-manager.html"),
  read("../particulars-manager.js"),
  read("../cashbook.html"),
  read("../supabase/migrations/20261128000100_particulars_learning_controls.sql"),
]);

test("particulars manager supports editing, disabling and deleting merchant defaults", () => {
  assert.match(cashbookManagerHtml, /href="particulars-manager\.html"/);
  assert.match(particularsManager, /Merchant defaults/);
  assert.match(particularsManagerJs, /async function toggle/);
  assert.match(particularsManagerJs, /async function remove/);
  assert.match(particularsManagerJs, /async function edit/);
});

test("reviewed transactions remain editable and explicit edits can be learned", () => {
  assert.match(cashbookManagerHtml, /id="editTxnParticulars"/);
  assert.match(cashbookManagerHtml, /id="learnTxnParticulars"/);
  assert.match(cashbook, /particulars_source:"manual"/);
  assert.match(cashbook, /particulars_reviewed_at:new Date\(\)\.toISOString\(\)/);
});

test("daily assignment uses confirmed history only and requires repeated high confidence", () => {
  assert.match(edge, /confirmed_count/);
  assert.match(edge, /Number\(best\.confirmed_count\)>=2/);
  assert.match(edge, /confidence>=0\.8/);
  assert.match(edge, /particulars_source:"automatic"/);
  assert.match(edge, /\.is\("particulars",null\)/);
  assert.match(edge, /\.is\("user_particulars",null\)/);
});

test("particulars provenance and merchant-manager controls are protected by constraints", () => {
  assert.match(particularsMigration, /particulars_source/);
  assert.match(particularsMigration, /particulars_confidence/);
  assert.match(particularsMigration, /is_active/);
  assert.match(particularsMigration, /confirmed_count/);
});
