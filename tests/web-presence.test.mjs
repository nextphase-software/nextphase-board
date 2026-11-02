// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";

function connection(id, person = id, patch = {}) {
  return { connection: id, person, label: id, role: "editor", colour: "#8c3caa",
    cursor: null, selection: [], view: { x: 0, y: 0, width: 1280, height: 800 }, active: true, ...patch };
}

test("presence groups your person first and retains every connection in learnt order", async () => {
  const { groupPeople } = await import("../apps/web/src/team/presence.ts");
  const self = connection("self", "me");
  const others = [connection("ben1", "ben"), connection("chen"), connection("ben2", "ben"), connection("self2", "me")];
  const people = groupPeople(self, others);
  assert.deepEqual(people.map((person) => person.person), ["me", "ben", "chen"]);
  assert.deepEqual(people.map((person) => person.own), [true, false, false]);
  assert.deepEqual(people[0].connections, [self, others[3]]);
  assert.deepEqual(people[1].connections, [others[0], others[2]]);
  assert.equal(people[1].first, others[0]);
});

test("a departing first connection promotes the next label role and colour", async () => {
  const { groupPeople } = await import("../apps/web/src/team/presence.ts");
  const first = connection("ben1", "ben");
  const next = connection("ben2", "ben", { label: "ben.okafor", role: "viewer", colour: "#217450" });
  assert.equal(groupPeople(undefined, [first, next])[0].first, first);
  const remaining = groupPeople(connection("self"), [next])[1];
  assert.equal(remaining.first, next);
  assert.equal(remaining.first.label, "ben.okafor");
  assert.equal(remaining.first.role, "viewer");
  assert.equal(remaining.first.colour, "#217450");
});

test("avatars show one to five people with the exact 767 and 768 pixel boundary", async () => {
  const { groupPeople, avatarPeople } = await import("../apps/web/src/team/presence.ts");
  for (let count = 1; count <= 5; count++) {
    const people = groupPeople(connection("self"), Array.from({ length: count - 1 }, (_, i) => connection(`person${i}`)));
    for (const width of [1280, 768, 767]) {
      const limit = width < 768 ? 1 : 3;
      assert.deepEqual(avatarPeople(people, width), { shown: people.slice(0, limit), overflow: Math.max(0, count - limit) });
    }
  }
});

test("cursor pills add viewer only for a viewer", async () => {
  const { pillWords } = await import("../apps/web/src/team/presence.ts");
  for (const role of ["owner", "editor"]) assert.equal(pillWords({ label: "ben.okafor", role }), "ben.okafor");
  assert.equal(pillWords({ label: "chen", role: "viewer" }), "chen · viewer");
});

test("presence sends the first 250 selected IDs in their own order", async () => {
  const { cutSelection, presenceToSend } = await import("../apps/web/src/team/presence.ts");
  const ids = Array.from({ length: 251 }, (_, i) => `00000000-0000-4000-8000-${String(251 - i).padStart(12, "0")}`);
  for (const count of [0, 1, 249, 250, 251]) {
    const input = ids.slice(0, count), expected = input.slice(0, 250);
    assert.deepEqual(cutSelection(new Set(input)), expected);
    assert.deepEqual(presenceToSend(null, input, { x: 0, y: 0, z: 1 }, { w: 1280, h: 800 }, true).selection, expected);
    assert.deepEqual(input, ids.slice(0, count));
  }
});

test("outgoing presence converts the scene to a board rectangle and preserves visibility", async () => {
  const { presenceToSend } = await import("../apps/web/src/team/presence.ts");
  assert.deepEqual(presenceToSend(null, [], { x: 100, y: -50, z: 2 }, { w: 1280, h: 800 }, false), {
    cursor: null, selection: [], view: { x: -220, y: -250, width: 640, height: 400 }, active: false,
  });
});

test("outgoing cursor and view numbers clamp to the presence contract range", async () => {
  const { presenceToSend } = await import("../apps/web/src/team/presence.ts");
  const value = presenceToSend({ x: 1000500, y: 0 }, [], { x: -999900, y: 0, z: .5 }, { w: 1280, h: 800 }, true);
  assert.deepEqual(value.view, { x: -1000000, y: -800, width: 2560, height: 1600 });
  assert.deepEqual(value.cursor, { x: 1000000, y: 0 });
  const extreme = presenceToSend({ x: -1000500, y: 1000500 }, [], { x: 1e6, y: -1e6, z: .5 }, { w: 2e6, h: 3e6 }, true);
  assert.deepEqual(extreme.cursor, { x: -1e6, y: 1e6 });
  assert.deepEqual(extreme.view, { x: -1e6, y: -1e6, width: 1e6, height: 1e6 });
});

test("follow prefers a currently active connection even after a later inactive message", async () => {
  const { chooseFollow } = await import("../apps/web/src/team/presence.ts");
  const active = connection("active"), laterInactive = connection("inactive", "inactive", { active: false });
  assert.equal(chooseFollow([laterInactive, active], new Map([["active", 1], ["inactive", 2]])), active);
});

test("follow chooses latest receipt among active connections and then among inactive ones", async () => {
  const { chooseFollow } = await import("../apps/web/src/team/presence.ts");
  const first = connection("first"), latest = connection("latest");
  const received = new Map([["first", 4], ["latest", 5]]);
  assert.equal(chooseFollow([latest, first], received), latest);
  first.active = false; latest.active = false;
  assert.equal(chooseFollow([latest, first], received), latest);
  assert.equal(chooseFollow([first], received), first);
  assert.equal(chooseFollow([], received), undefined);
});

test("follow fits equal and differently sized scenes around the sent view centre", async () => {
  const { fitFollow } = await import("../apps/web/src/team/presence.ts");
  const view = { x: -220, y: -250, width: 1280, height: 800 };
  assert.deepEqual(fitFollow(view, { w: 1280, h: 800 }), { x: 420, y: 150, z: 1 });
  assert.deepEqual(fitFollow(view, { w: 900, h: 700 }), { x: 420, y: 150, z: .703125 });
});

test("follow respects the zoom floor ceiling and board centre limits", async () => {
  const { fitFollow } = await import("../apps/web/src/team/presence.ts");
  assert.deepEqual(fitFollow({ x: -1200, y: -700, width: 2560, height: 1600 }, { w: 900, h: 700 }), { x: 80, y: 100, z: .5 });
  assert.deepEqual(fitFollow({ x: 50, y: -100, width: 100, height: 100 }, { w: 1280, h: 800 }), { x: 100, y: -50, z: 2 });
  assert.deepEqual(fitFollow({ x: 1e6, y: 1e6, width: 100, height: 100 }, { w: 1280, h: 800 }), { x: 1e6, y: 1e6, z: 2 });
});

test("only the four uncorrelated reasons are silent presence refusals", async () => {
  const { isPresenceRefusal } = await import("../apps/web/src/team/presence.ts");
  for (const reason of ["presence_too_large", "presence_fields", "presence_selection_limit", "bad_presence"]) {
    assert.equal(isPresenceRefusal({ reason }), true, reason);
    assert.equal(isPresenceRefusal({ reason, requestId: "edit" }), false, reason);
  }
  for (const reason of ["message_too_large", "bad_message", "invalid_update", "other", undefined]) {
    assert.equal(isPresenceRefusal({ reason }), false, String(reason));
  }
});

test("the cursor preference uses exactly the contracted localStorage key", async () => {
  const { SHOW_CURSORS_KEY } = await import("../apps/web/src/team/presence.ts");
  assert.equal(SHOW_CURSORS_KEY, "nextphase-board/presence/show-cursors/v1");
});
