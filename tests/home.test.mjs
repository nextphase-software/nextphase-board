// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";

const workspace = "a1234567-1234-1234-1234-123456789abc";
const board = "b1234567-1234-1234-1234-123456789abc";
const invitation = "c1234567-1234-1234-1234-123456789abc";
const now = Date.parse("2026-11-02T12:00:00Z");
const row = (id, title = "A") => ({ id, title, workspaceId: workspace, role: "owner",
  createdAt: "2026-10-01T12:00:00Z", editedAt: "2026-11-01T12:00:00Z", openedAt: null, workspaceName: "Studio" });

test("Home links are exact and existing board, invitation and local links keep their meaning", async () => {
  const { parseLink } = await import("../apps/web/src/team/links.ts");
  assert.deepEqual(parseLink("#/files"), { kind: "home", workspace: undefined });
  assert.deepEqual(parseLink("#/files/" + workspace), { kind: "home", workspace });
  for (const fragment of ["#/files/", "#/files/no", "#/files/" + workspace.toUpperCase(),
    "#/files/" + workspace + "/", "#/files/" + workspace + "?sort=title", "#/files?x"]) {
    assert.deepEqual(parseLink(fragment), { kind: "bad" }, fragment);
  }
  for (const fragment of ["", "#notes"]) assert.deepEqual(parseLink(fragment), { kind: "local" });
  assert.deepEqual(parseLink("#/b/" + board), { kind: "board", board });
  assert.deepEqual(parseLink("#/invite/" + invitation), { kind: "invite", invitation, board: undefined });
  assert.deepEqual(parseLink(`#/invite/${invitation}?board=${board}`), { kind: "invite", invitation, board });
});

test("joining pages keeps first positions, replaces repeated rows and appends new IDs", async () => {
  const { joinPages } = await import("../apps/web/src/team/home-rules.ts");
  const first = [row("1"), row("2")], second = [row("2", "B"), row("3"), row("1", "C")];
  const before = structuredClone([first, second]);
  assert.deepEqual(joinPages(first, second), [second[2], second[0], second[1]]);
  assert.deepEqual([first, second], before);
  assert.deepEqual(joinPages([], []), []);
});

for (const [minutes, words] of [
  [-1, "just now"], [0, "just now"], [1, "1 minute ago"], [59, "59 minutes ago"],
  [60, "1 hour ago"], [119, "1 hour ago"], [120, "2 hours ago"], [1439, "23 hours ago"],
  [1440, "yesterday"], [2879, "yesterday"], [2880, "2 days ago"], [10079, "6 days ago"],
  [10080, "1 week ago"], [20159, "1 week ago"], [20160, "2 weeks ago"], [43199, "4 weeks ago"],
  [43200, "last month"], [86399, "last month"], [86400, "2 months ago"], [525599, "12 months ago"],
  [525600, "1 year ago"], [1051200, "2 years ago"],
]) {
  test(`Edited words at ${minutes} elapsed minutes`, async () => {
    const { editedWords } = await import("../apps/web/src/team/home-rules.ts");
    assert.equal(editedWords(new Date(now - minutes * 60000).toISOString(), now), "Edited " + words);
  });
}
test("Edited words for an unreadable time", async () => {
  const { editedWords } = await import("../apps/web/src/team/home-rules.ts");
  assert.equal(editedWords("unreadable", now), "Edited time unavailable");
});

test("Home uses the role and sort words and permits creation and renaming by role", async () => {
  const { roleWords, sortWords, canCreate, canRename } = await import("../apps/web/src/team/home-rules.ts");
  assert.deepEqual(roleWords, { owner: "Owner", editor: "Can edit", viewer: "Can view", guest: "Guest" });
  assert.deepEqual(sortWords, { title: "Alphabetical", created: "Date created", edited: "Last modified" });
  for (const role of ["owner", "editor", "viewer", "guest"]) {
    assert.equal(canCreate(role), ["owner", "editor"].includes(role), role);
  }
  for (const role of ["owner", "editor", "viewer"]) assert.equal(canRename(role), role !== "viewer", role);
});

test("a held name replaces only its row's title without mutating rows or other entries", async () => {
  const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
  const names = new Map(), rows = [row("1"), row("2")], before = structuredClone(rows);
  holdName(names, "1", "B", ["A"], now);
  holdName(names, "absent", "Other", ["Old"], now);
  const other = names.get("absent"), otherBefore = structuredClone(other);
  const shown = applyHeldNames(rows, names, now + 1);
  assert.deepEqual(shown, [{ ...rows[0], title: "B" }, rows[1]]);
  assert.deepEqual(rows, before);
  assert.equal(names.get("absent"), other);
  assert.deepEqual(other, otherBefore);
  assert.deepEqual(applyHeldNames([], names, now + 1), []);
});

test("a list showing the held name releases it", async () => {
  const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
  const names = new Map(); holdName(names, "1", "B", ["A"], now);
  assert.deepEqual(applyHeldNames([row("1", "B")], names, now), [row("1", "B")]);
  assert.equal(names.has("1"), false);
});
test("a list showing a replaced name keeps the held name", async () => {
  const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
  const names = new Map(); holdName(names, "1", "B", ["A"], now);
  assert.equal(applyHeldNames([row("1", "A")], names, now)[0].title, "B");
  assert.equal(names.has("1"), true);
});
test("a third name releases the held name and is shown", async () => {
  const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
  const names = new Map(); holdName(names, "1", "B", ["A"], now);
  assert.equal(applyHeldNames([row("1", "Third")], names, now)[0].title, "Third");
  assert.equal(names.has("1"), false);
});
test("successive saved names keep every older name they replaced", async () => {
  const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
  const names = new Map();
  holdName(names, "1", "A", ["Original"], now);
  holdName(names, "1", "B", ["A"], now + 1);
  holdName(names, "1", "C", ["B"], now + 2);
  for (const previous of ["Original", "A", "B"]) {
    assert.equal(applyHeldNames([row("1", previous)], names, now + 3)[0].title, "C");
  }
  assert.equal(names.get("1").heldAt, now + 2);
});
test("a name entry retains the intermediate titles sent before Saved", async () => {
  const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
  const names = new Map(); holdName(names, "1", "ABC", ["A", "AB"], now);
  assert.equal(applyHeldNames([row("1", "AB")], names, now)[0].title, "ABC");
  assert.equal(names.has("1"), true);
});
for (const elapsed of [119999, 120000]) {
  test(`a held name at ${elapsed} milliseconds`, async () => {
    const { holdName, applyHeldNames } = await import("../apps/web/src/team/home-rules.ts");
    const names = new Map(); holdName(names, "1", "B", ["A"], now);
    assert.equal(applyHeldNames([row("1")], names, now + elapsed)[0].title, elapsed < 120000 ? "B" : "A");
    assert.equal(names.has("1"), elapsed < 120000);
  });
}

test("a fitting menu stays at its point", async () => {
  const { placeMenu } = await import("../apps/web/src/team/home-rules.ts");
  assert.deepEqual(placeMenu({ x: 100, y: 200 }, { width: 208, height: 300 }, { width: 1280, height: 800 }),
    { left: 100, top: 200 });
});
test("a menu crossing right and bottom edges keeps an eight pixel inset", async () => {
  const { placeMenu } = await import("../apps/web/src/team/home-rules.ts");
  assert.deepEqual(placeMenu({ x: 1200, y: 700 }, { width: 208, height: 300 }, { width: 1280, height: 800 }),
    { left: 1064, top: 492 });
  assert.deepEqual(placeMenu({ x: 1200, y: 10 }, { width: 208, height: 300 }, { width: 1280, height: 800 }),
    { left: 1064, top: 10 });
  assert.deepEqual(placeMenu({ x: 10, y: 700 }, { width: 208, height: 300 }, { width: 1280, height: 800 }),
    { left: 10, top: 492 });
});
test("a menu is never above or left of four, even in a smaller window", async () => {
  const { placeMenu } = await import("../apps/web/src/team/home-rules.ts");
  assert.deepEqual(placeMenu({ x: -10, y: -20 }, { width: 208, height: 300 }, { width: 1280, height: 800 }),
    { left: 4, top: 4 });
  assert.deepEqual(placeMenu({ x: 100, y: 100 }, { width: 208, height: 300 }, { width: 100, height: 100 }),
    { left: 4, top: 4 });
});
