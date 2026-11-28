import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const capture = await readFile(new URL("../supabase/functions/sms-capture/index.ts", import.meta.url), "utf8");
const guide = await readFile(new URL("../docs/iphone-daily-particulars-setup.md", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261128000200_save_cashbook_particulars_atomically.sql", import.meta.url), "utf8");

test("daily particulars guide covers every Cash Book movement and saves one item at a time", () => {
  assert.match(guide, /functions\/v1\/sms-capture\/pending-particulars/);
  assert.match(guide, /movement_id/);
  assert.match(guide, /inside the repeat/);
  assert.match(guide, /Do not use the `particulars-batch` endpoint/);
  assert.match(guide, /No records to review/);
  assert.match(guide, /manual, and settlement entries/);
  assert.match(guide, /magxbczgrxeypryjborr\.supabase\.co/);
  assert.doesNotMatch(guide, /magxbczgrxeyprjyborr/);
});

test("pending particulars endpoint is based on all Cash Book movements, not only SMS inbox rows", () => {
  assert.match(capture, /from\("cash_movements"\)[\s\S]*?or\("particulars\.is\.null,particulars\.eq\."\)/);
  assert.match(capture, /movement_type/);
  assert.match(capture, /movement_id:movement\.id/);
});

test("single-item save uses atomic RPC and preserves existing particulars", () => {
  assert.match(capture, /rpc\("save_cashbook_particulars"/);
  assert.match(capture, /Particulars are already saved/);
  assert.match(migration, /for update/i);
  assert.match(migration, /nullif\(btrim\(particulars\), ''\) is null/i);
  assert.match(migration, /update public\.sms_capture_inbox/);
});
