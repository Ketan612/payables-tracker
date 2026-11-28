import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const capture = await readFile(new URL("../supabase/functions/sms-capture/index.ts", import.meta.url), "utf8");
const guide = await readFile(new URL("../docs/iphone-daily-particulars-setup.md", import.meta.url), "utf8");

test("daily particulars guide saves each selection immediately, not as a batch", () => {
  assert.match(guide, /functions\/v1\/sms-capture\/particulars\`/);
  assert.match(guide, /inside the repeat/);
  assert.match(guide, /Do not use the \`particulars-batch\` endpoint/);
  assert.match(guide, /No records to review/);
});

test("single-item particulars endpoint refuses to overwrite saved values", () => {
  assert.match(capture, /Particulars are already saved for this item/);
  assert.match(capture, /Cash Book particulars are already filled/);
  assert.match(capture, /\.is\("user_particulars",null\)/);
  assert.match(capture, /\.or\("particulars\.is\.null,particulars\.eq\."/);
});
