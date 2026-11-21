import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../supabase/functions/sms-capture/index.ts", import.meta.url),
  "utf8",
);

// Keep this source-level guard deliberately narrow: it verifies that each
// terminal capture outcome carries an inbox-row link into the event monitor.
// It does not replace a live Edge Function/database integration test.
const eventObjects = [...source.matchAll(/logEvent\(\{([^}]*)\}\)/gs)].map((match) => match[1]);

function eventsFor(outcome) {
  return eventObjects.filter((event) => new RegExp('outcome:"' + outcome + '"').test(event));
}

test("posted capture events link to the newly created inbox row", () => {
  const events = eventsFor("posted");
  assert.equal(events.length, 1, "expected one posted event branch");
  assert.match(events[0], /source_record_id:\s*inbox\.id/);
});

test("needs-review and Cash Book write failures link to the retained inbox row", () => {
  const needsReview = eventsFor("needs_review");
  const writeFailed = eventsFor("cashbook_write_failed");
  assert.equal(needsReview.length, 1);
  assert.equal(writeFailed.length, 1);
  assert.match(needsReview[0], /source_record_id:\s*inbox\.id/);
  assert.match(writeFailed[0], /source_record_id:\s*inbox\.id/);
});

test("duplicate outcomes always identify the corresponding inbox record", () => {
  const duplicates = eventsFor("duplicate");
  assert.ok(duplicates.length >= 5, "expected all duplicate-handling branches to be logged");
  for (const event of duplicates) {
    assert.match(
      event,
      /source_record_id:/,
      "duplicate event is missing source_record_id: " + event,
    );
  }
  assert.ok(
    duplicates.some((event) => /source_record_id:\s*review\.id/.test(event)),
    "exact-message duplicate should link to its newly created review row",
  );
  assert.ok(
    duplicates.some((event) => /source_record_id:\s*existing\.id/.test(event)),
    "failed duplicate-review insert should link to the original inbox row",
  );
  assert.ok(
    duplicates.some((event) => /source_record_id:\s*duplicateRecord\?\.id/.test(event)),
    "inbox uniqueness collision should link to the resolved duplicate row",
  );
  assert.ok(
    duplicates.some((event) => /source_record_id:\s*inbox\.id/.test(event)),
    "reference/Cash Book uniqueness duplicates should link to the retained inbox row",
  );
});

test("event traceability coverage includes every required capture outcome", () => {
  for (const outcome of [
    "posted",
    "needs_review",
    "cashbook_write_failed",
    "duplicate",
    "inbox_write_failed",
    "account_mapping_lookup_failed",
  ]) {
    assert.ok(eventsFor(outcome).length > 0, "missing event outcome: " + outcome);
  }
});
