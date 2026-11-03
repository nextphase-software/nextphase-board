// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";

function fixedClock() {
  let now = 0;
  const timers = new Set();
  return {
    now: () => now,
    after(ms, run) {
      const timer = { at: now + ms, run }; timers.add(timer);
      return () => timers.delete(timer);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const timer = [...timers].filter((item) => item.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!timer) break;
        now = timer.at; timers.delete(timer); timer.run();
      }
      now = target;
    },
  };
}
async function fixture(sync) {
  const { Adapter } = await import("../packages/board-sync/src/document-adapter.ts");
  const { add, empty, upgrade } = await import("../packages/board-rules/src/document.ts");
  const seed = new Adapter();
  seed.set(add({ ...upgrade(empty()), title: "Launch plan" }, "sticky", 0, 0));
  const clock = fixedClock(), wires = [], events = [];
  const joined = { kind: "joined", role: "editor", epoch: 2, restoreGeneration: 0, revision: 0,
    update: sync.encode(Y.encodeStateAsUpdate(seed.doc)), self: {}, present: [] };
  const session = await sync.BoardSession.join({ clock, clientId: 42, ticket: async () => "ticket",
    open: async () => {
      const wire = {
        sent: [], closes: [], throws: false,
        send(text) { if (this.throws) throw Error("Send failed"); this.sent.push(JSON.parse(text)); },
        close(code) { this.closes.push(code); },
        listen(handlers) { this.handlers = handlers; this.message(joined); },
        message(value) { this.handlers.message(JSON.stringify(value)); },
      };
      wires.push(wire); return wire;
    },
  });
  session.subscribe((event) => events.push(event));
  assert.equal(session.restoreGeneration, 0, "joined accepts the restore generation");
  return { session, seed, wires, events, clock, joined,
    async rejoin(patch = {}) {
      Object.assign(joined, { update: sync.encode(Y.encodeStateAsUpdate(seed.doc)) }, patch);
      await session.reconnect();
      return wires.at(-1);
    },
    finish() { session.close(); seed.destroy(); },
  };
}
const change = (f, title) => f.session.edit({ ...f.session.board, title });
const saved = (wire, requestId, revision = 1) => wire.message({ kind: "saved", requestId, revision });
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

for (const phase of ["before received", "after received", "stored with answer lost"]) {
  test(`recovery resends identical requests after a drop ${phase}`, async () => {
    const sync = await import("../packages/board-sync/src/session.ts");
    const f = await fixture(sync);
    try {
      const id = change(f, "Waiting"), first = f.wires[0].sent[0];
      if (phase === "after received") f.wires[0].message({ kind: "received", requestId: id });
      if (phase === "stored with answer lost") Y.applyUpdate(f.seed.doc, sync.decode(first.update));
      f.wires[0].handlers.close(1006);
      assert.equal(f.session.requests.get(id).state, "waiting");
      assert.equal(f.session.present.size, 0);
      const next = await f.rejoin();
      assert.deepEqual(next.sent, [first]);
      assert.equal(f.session.board.title, "Waiting");
      saved(next, id);
      assert.deepEqual(f.events.filter((event) => event.kind === "recovered"), [{ kind: "recovered", requests: 1 }]);
    } finally { f.finish(); }
  });
}
test("three waiting requests resend in original order only after saved", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const ids = [change(f, "One"), change(f, "Two"), change(f, "Three")], originals = [...f.wires[0].sent];
    f.session.interrupt();
    f.session.subscribe((event) => {
      if (event.kind === "joined") assert.equal(f.session.requests.get(ids[0]).state, "sent");
    });
    const wire = await f.rejoin();
    assert.deepEqual(wire.sent, originals.slice(0, 1));
    wire.message({ kind: "received", requestId: ids[0] });
    assert.equal(wire.sent.length, 1);
    saved(wire, ids[0]); assert.deepEqual(wire.sent, originals.slice(0, 2));
    wire.message({ kind: "received", requestId: ids[1] }); assert.equal(wire.sent.length, 2);
    saved(wire, ids[1], 2); assert.deepEqual(wire.sent, originals);
    saved(wire, ids[2], 3);
    assert.equal(f.session.recovering, false);
    assert.deepEqual(f.events.filter((event) => event.kind === "recovered"), [{ kind: "recovered", requests: 3 }]);
  } finally { f.finish(); }
});
for (const [name, patch, reason] of [
  ["restore", { restoreGeneration: 1 }, "board_restored"],
  ["restore before epoch", { restoreGeneration: 1, epoch: 3 }, "board_restored"],
  ["raised epoch", { epoch: 3 }, "access_changed"],
  ["lowered epoch", { epoch: 1 }, "access_changed"],
  ["viewer at the same epoch", { role: "viewer" }, "access_changed"],
]) test(`rejoin fences waiting edits: ${name}`, async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const id = change(f, "Waiting"); f.session.interrupt();
    const wire = await f.rejoin(patch);
    assert.equal(f.session.requests.get(id).state, "dropped");
    assert.equal(f.session.requests.get(id).reason, reason);
    assert.equal(wire.sent.length, 0); assert.equal(f.session.recovering, false);
    assert.equal(f.session.board.title, "Launch plan");
    assert(!f.events.some((event) => event.kind === "recovered"));
    if (patch.role !== "viewer") assert(f.session.requests.has(change(f, "Allowed immediately")));
  } finally { f.finish(); }
});
test("an unanswered request ends its attempt at exactly ten seconds", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const id = change(f, "Waiting"), wire = f.wires[0];
    f.clock.advance(9999); assert.equal(f.session.requests.get(id).state, "sent"); assert.deepEqual(wire.closes, []);
    f.clock.advance(1); assert.equal(f.session.requests.get(id).state, "waiting"); assert.deepEqual(wire.closes, [1000]);
    assert.deepEqual(f.events, [{ kind: "close", code: 4000, reason: "answer_deadline" }]);
    const before = JSON.stringify([...f.session.requests]);
    saved(wire, id, 99); wire.handlers.close(4401);
    assert.equal(JSON.stringify([...f.session.requests]), before); assert.equal(f.events.length, 1); assert.equal(f.session.revision, 0);
  } finally { f.finish(); }
});
test("received restarts the deadline from its own arrival", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const id = change(f, "Waiting"); f.clock.advance(9000);
    f.wires[0].message({ kind: "received", requestId: id });
    f.clock.advance(9999); assert.equal(f.session.requests.get(id).state, "received");
    f.clock.advance(1); assert.equal(f.session.requests.get(id).state, "waiting");
    assert.equal(f.events.at(-1).reason, "answer_deadline");
  } finally { f.finish(); }
});
test("saved cancels the deadline and a resend starts its own deadline", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const first = change(f, "Saved"); saved(f.wires[0], first);
    f.clock.advance(20000); assert.deepEqual(f.wires[0].closes, []);
    const second = change(f, "Waiting"); f.clock.advance(9999); f.session.interrupt();
    const wire = await f.rejoin();
    f.clock.advance(9999); assert.equal(f.session.requests.get(second).state, "sent"); assert.deepEqual(wire.closes, []);
    f.clock.advance(1); assert.equal(f.session.requests.get(second).state, "waiting"); assert.deepEqual(wire.closes, [1000]);
    assert.equal(f.session.requests.get(first).state, "saved");
  } finally { f.finish(); }
});
for (const reason of ["access_removed", "signed_out", "sign_in_expired", "chosen_reason"]) {
  test(`discard ends the attempt and drops outstanding edits with ${reason}`, async () => {
    const sync = await import("../packages/board-sync/src/session.ts");
    const f = await fixture(sync);
    try {
      const first = change(f, "One"), second = change(f, "Two");
      f.wires[0].message({ kind: "received", requestId: first });
      f.session.undo();
      assert(f.session.history.future.length);
      f.session.discard(reason);
      for (const request of f.session.requests.values()) { assert.equal(request.state, "dropped"); assert.equal(request.reason, reason); }
      assert.equal(f.session.history.past.length, 0); assert.equal(f.session.history.future.length, 0);
      assert.equal(f.session.recovering, false); assert.equal(f.session.edit(f.session.board), "join_required");
      assert.equal(f.session.undo(), "join_required"); assert.equal(f.session.redo(), "join_required");
      assert.deepEqual(f.wires[0].closes, [1000]);
      assert.deepEqual(f.events.at(-1), { kind: "discarded", reason });
      saved(f.wires[0], second); assert.equal(f.session.requests.get(second).state, "dropped");
      const next = await f.rejoin(); assert.equal(next.sent.length, 0);
      assert(f.session.requests.has(change(f, "New work")));
    } finally { f.finish(); }
  });
}
test("discard and close preserve final requests and late answers cannot revive them", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const a = change(f, "Saved"); saved(f.wires[0], a);
    const b = change(f, "Refused"), c = change(f, "Dropped");
    f.wires[0].message({ kind: "refused", requestId: b, reason: "invalid_document" }); await tick();
    assert.equal(f.session.requests.get(c).reason, "refused_edit");
    const finals = [a, b, c].map((id) => structuredClone(f.session.requests.get(id)));
    const pending = change(f, "Outstanding");
    f.session.discard("signed_out");
    const dropped = structuredClone(f.session.requests.get(pending));
    const wire = await f.rejoin();
    for (const id of [a, b, c, pending]) {
      saved(wire, id, 100); wire.message({ kind: "received", requestId: id });
      wire.message({ kind: "refused", requestId: id, reason: "epoch_changed" });
    }
    f.session.close(); await f.session.reconnect();
    [a, b, c].forEach((id, i) => assert.deepEqual(f.session.requests.get(id), finals[i]));
    assert.deepEqual(f.session.requests.get(pending), dropped);
    assert.equal(f.wires.length, 3); assert.equal(f.session.revision, 0);
  } finally { f.finish(); }
});
test("close drops sent received and waiting requests with session_ended forever", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const ids = [change(f, "One"), change(f, "Two"), change(f, "Three")];
    f.session.interrupt(); const wire = await f.rejoin();
    wire.message({ kind: "received", requestId: ids[0] });
    f.session.close(); await f.session.reconnect();
    for (const id of ids) {
      assert.equal(f.session.requests.get(id).state, "dropped"); assert.equal(f.session.requests.get(id).reason, "session_ended");
      saved(wire, id); assert.equal(f.session.requests.get(id).state, "dropped");
    }
    assert.equal(wire.sent.length, 1); assert.equal(f.wires.length, 2);
  } finally { f.finish(); }
});
for (const ending of ["interrupt", "discard", "close"]) test(`${ending} ends recovery before another request is sent`, async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const ids = [change(f, "One"), change(f, "Two")], wire = await f.rejoin();
    assert.equal(f.session.recovering, true);
    if (ending === "discard") f.session.discard("signed_out");
    else f.session[ending]();
    assert.equal(f.session.recovering, false);
    saved(wire, ids[0]);
    assert.equal(wire.sent.length, 1);
    assert(!f.events.some((event) => event.kind === "recovered"));
  } finally { f.finish(); }
});
test("send failure reports one 1006 close and ignores every later old-transport event", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const wire = f.wires[0]; wire.throws = true;
    const id = change(f, "Waiting");
    assert.deepEqual(f.events, [{ kind: "close", code: 1006 }]);
    assert.equal(f.session.requests.get(id).state, "waiting"); assert.deepEqual(wire.closes, [1000]);
    wire.message({ kind: "joined", ...f.joined, epoch: 100 });
    wire.message({ kind: "present", connection: "old" }); saved(wire, id);
    wire.handlers.close(4401); f.clock.advance(30000);
    assert.equal(f.session.epoch, 2); assert.equal(f.session.present.size, 0); assert.equal(f.events.length, 1);
    const next = await f.rejoin(); assert.equal(next.sent[0].requestId, id);
  } finally { f.finish(); }
});
test("every transport close ends only its own attempt and interrupt reports no close", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    for (const code of [1000, 1006, 1012, 1013, 4401, 4403, 4409, 4423]) {
      const wire = f.wires.at(-1), before = f.events.length;
      wire.handlers.close(code); wire.handlers.close(code);
      assert.deepEqual(f.events.slice(before), [{ kind: "close", code }]);
      await f.rejoin();
      const count = f.events.length; wire.message(f.joined); assert.equal(f.events.length, count);
    }
    const before = f.events.length; f.session.interrupt(); assert.equal(f.events.length, before);
  } finally { f.finish(); }
});
test("recovered reports two once and never reports an empty recovery", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    await f.rejoin(); assert.equal(f.session.recovering, false);
    assert(!f.events.some((event) => event.kind === "recovered"));
    const ids = [change(f, "One"), change(f, "Two")];
    const wire = await f.rejoin(); saved(wire, ids[0]); saved(wire, ids[1], 2); saved(wire, ids[1], 2);
    assert.deepEqual(f.events.filter((event) => event.kind === "recovered"), [{ kind: "recovered", requests: 2 }]);
  } finally { f.finish(); }
});
test("epoch refusal during recovery refuses one and drops the rest with access_changed", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const ids = [change(f, "One"), change(f, "Two")], wire = await f.rejoin();
    wire.message({ kind: "refused", requestId: ids[0], reason: "epoch_changed" });
    assert.equal(f.session.requests.get(ids[0]).state, "refused");
    assert.equal(f.session.requests.get(ids[1]).state, "dropped");
    assert.equal(f.session.requests.get(ids[1]).reason, "access_changed");
    assert.equal(f.session.recovering, false); assert.equal(wire.sent.length, 1);
    await tick(); assert(!f.events.some((event) => event.kind === "recovered"));
  } finally { f.finish(); }
});
test("not kept requires a touched generation retired by the joined board and is still sent", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const { add } = await import("../packages/board-rules/src/document.ts");
  const f = await fixture(sync);
  try {
    const old = f.session.board.objects[0];
    const first = f.session.edit({ ...f.session.board, objects: [{ ...old, x: 10 }] });
    const second = f.session.edit(add(f.session.board, "sticky", 300, 0));
    f.seed.set({ ...f.session.board, objects: [], retiredGenerations: [old.generation] });
    const wire = await f.rejoin();
    assert.deepEqual(f.session.requests.get(first).touched, [{ id: old.id, generation: old.generation }]);
    assert.equal(f.session.requests.get(first).notKept, true);
    assert.equal(f.session.requests.get(second).notKept, undefined);
    assert.equal(wire.sent[0].requestId, first);
    saved(wire, first); assert.equal(wire.sent[1].requestId, second); saved(wire, second, 2);
    assert.equal(f.session.requests.get(first).state, "saved");
  } finally { f.finish(); }
});
test("edits undo and redo wait until recovered then new work can be undone", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    const id = change(f, "Waiting"), wire = await f.rejoin();
    assert.equal(f.session.recovering, true);
    assert.equal(change(f, "Overtake"), "join_required");
    assert.equal(f.session.undo(), "join_required"); assert.equal(f.session.redo(), "join_required");
    saved(wire, id);
    assert.equal(f.session.undo(), "nothing_to_undo"); assert.equal(f.session.redo(), "nothing_to_undo");
    assert(f.session.requests.has(change(f, "New work")));
    assert(f.session.requests.has(f.session.undo())); assert.equal(f.session.board.title, "Waiting");
    assert(f.session.requests.has(f.session.redo())); assert.equal(f.session.board.title, "New work");
  } finally { f.finish(); }
});
test("every rejoin clears both undo and redo and gives the document a fresh client ID", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const f = await fixture(sync);
  try {
    assert.equal(f.session.doc.clientID, 42);
    const id = change(f, "Saved"); saved(f.wires[0], id);
    const undo = f.session.undo(); saved(f.wires[0], undo, 2);
    assert(f.session.history.future.length);
    await f.rejoin();
    assert.equal(f.session.undo(), "nothing_to_undo"); assert.equal(f.session.redo(), "nothing_to_undo");
    assert.notEqual(f.session.doc.clientID, 42);
    const previous = f.session.doc.clientID; await f.rejoin(); assert.notEqual(f.session.doc.clientID, previous);
  } finally { f.finish(); }
});

test("change counts group requests and count mixed waiting and saved once", async () => {
  const { countChanges, changeCounts } = await import("../apps/web/src/team/notices.ts");
  const requests = [
    { group: "typing", state: "waiting" }, { group: "typing", state: "saved" }, { group: "typing", state: "received" },
    { state: "sent" }, { state: "saved" },
  ];
  assert.equal(countChanges(requests), 3); assert.equal(changeCounts(requests).waiting, 2);
  assert.equal(changeCounts(requests.slice(0, 2)).waiting, 1);
});
test("the loss record keeps separate reason counts and only a later saved deliberate edit clears it", async () => {
  const { emptyLossRecord, updateLossRecord, changeCounts, saveState } = await import("../apps/web/src/team/notices.ts");
  const requests = new Map(), observe = (id) => { record = updateLossRecord(record, requests, id); };
  let record = emptyLossRecord();
  requests.set("a", { state: "dropped", reason: "access_changed" }); observe();
  requests.set("before", { state: "sent" }); observe("before");
  requests.set("b", { state: "dropped", reason: "board_restored" }); observe();
  assert.equal(changeCounts([], record.losses.values()).byReason.access_changed, 1);
  assert.equal(changeCounts([], record.losses.values()).byReason.board_restored, 1);
  assert.equal(changeCounts([], record.losses.values()).notConfirmed, 2);
  requests.set("recovery", { state: "sent" }); observe(); requests.get("recovery").state = "saved"; observe();
  requests.get("before").state = "saved"; observe();
  assert.equal(record.losses.size, 2);
  requests.set("after", { state: "sent" }); observe("after");
  assert.equal(saveState(true, "editor", requests.values(), record.losses.values()), "Not confirmed");
  requests.get("after").state = "saved"; observe(); assert.equal(record.losses.size, 0);
  observe(); assert.equal(record.losses.size, 0, "old losses do not return");
});
test("Dismiss hides only its notice and a newer loss shows it again", async () => {
  const { emptyLossRecord, updateLossRecord, dismissNotice, lossNotices, saveState } = await import("../apps/web/src/team/notices.ts");
  const requests = new Map([["a", { state: "dropped", reason: "board_restored" }]]);
  let record = updateLossRecord(emptyLossRecord(), requests);
  assert.equal(lossNotices(record).length, 1);
  record = dismissNotice(record, "board_restored"); assert.equal(lossNotices(record).length, 0);
  assert.equal(saveState(true, "editor", [], record.losses.values()), "Not confirmed");
  requests.set("b", { state: "dropped", reason: "board_restored" }); record = updateLossRecord(record, requests);
  assert.equal(lossNotices(record)[0].message, "This board was restored to an earlier version, so 2 changes may not have been kept.");
  const kept = new Map([["c", { state: "saved", notKept: true }]]);
  const deleted = updateLossRecord(emptyLossRecord(), kept);
  assert.equal(saveState(true, "editor", kept.values(), deleted.losses.values()), "Saved");
  assert.equal(lossNotices(deleted)[0].reason, "not_kept");
});
test("all seven save states and every compatible precedence pair follow hosted storage v4", async () => {
  const { saveState } = await import("../apps/web/src/team/notices.ts");
  const rows = [
    { losses: [{ state: "refused" }], label: "Not saved" },
    { losses: [{ state: "dropped", reason: "board_restored" }], label: "Not confirmed" },
    { connected: false, requests: [{ state: "waiting", group: "one" }], label: "Offline — 1 change waiting" },
    { connected: false, label: "Offline — view only" },
    { requests: [{ state: "received", group: "one" }], label: "Saving…" },
    { role: "viewer", label: "View only" },
    { label: "Saved" },
  ];
  for (const row of rows) assert.equal(saveState(row.connected ?? true, row.role ?? "editor", row.requests ?? [], row.losses ?? []), row.label);
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    if (i === 2 && j === 3 || i === 3 && j === 4) continue; // These predicates cannot both hold.
    const high = rows[i], low = rows[j];
    assert.equal(saveState(high.connected !== false && low.connected !== false, high.role ?? low.role ?? "editor",
      [...high.requests ?? [], ...low.requests ?? []], [...high.losses ?? [], ...low.losses ?? []]), high.label, `${high.label} above ${low.label}`);
  }
  assert.equal(saveState(true, "editor", [{ state: "sent" }]), "Saving…");
  assert.equal(saveState(true, "editor", [{ state: "dropped", reason: "session_ended" }]), "Saved");
  assert.equal(saveState(true, "editor", [{ state: "dropped", reason: "refused_edit" }]), "Not saved");
});
for (const n of [1, 2]) test(`every recovery message matches exactly for N=${n}`, async () => {
  const { words, endingMessage } = await import("../apps/web/src/team/notices.ts");
  const one = n === 1, noun = one ? "1 change" : "2 changes";
  assert.equal(words.offlineWaiting(n), `Offline — ${noun} waiting`);
  assert.equal(words.reconnectingWaiting(n), `Reconnecting… ${noun} ${one ? "is" : "are"} waiting and will be saved when the board is back. You can look around until then.`);
  assert.equal(words.reconnecting, "Reconnecting… You can look around; editing comes back when the board does.");
  assert.equal(words.notConfirmed, "Not confirmed");
  assert.equal(words.recovered(n), one ? "Back online. Your change was saved." : "Back online. Your changes were saved.");
  assert.equal(words.boardRestored(n), `This board was restored to an earlier version, so ${noun} may not have been kept.`);
  assert.equal(words.accessChanged(n), `Your access changed while you were offline, so ${noun} may not have been saved.`);
  assert.equal(words.notKept(n), `Someone deleted what you changed while you were offline, so ${noun} ${one ? "wasn't" : "weren't"} kept.`);
  assert.equal(words.accessRemoved("Acme", n), `The owner of Acme removed your access before ${noun} ${one ? "was" : "were"} confirmed, so ${one ? "it" : "they"} may not have been saved.`);
  assert.equal(endingMessage("accessRemoved", "Acme", n), words.accessRemoved("Acme", n));
  for (const [name, body] of [["expired", "Your sign-in has expired. Sign in again to keep editing."],
    ["signedOut", "You signed out. Sign in again to keep working on this board."],
    ["disabled", "This account can't open boards right now. Ask the owner of the workspace."]]) {
    assert.equal(endingMessage(name, "Acme", n), `${body} ${noun} may not have been saved.`);
    assert.equal(endingMessage(name, "Acme", 0), body);
  }
  assert.equal(words.lossSentence(n), `${noun} may not have been saved.`);
  assert.equal(words.leaveTitle(n), one ? "Leave before your change is saved?" : "Leave before your changes are saved?");
  assert.equal(words.leaveBody(n, "Launch plan"), `${noun} to “Launch plan” ${one ? "hasn't" : "haven't"} been confirmed yet. If you leave now, ${one ? "it" : "they"} may be lost.`);
  assert.equal(words.leaveAnyway, "Leave anyway"); assert.equal(words.stay, "Stay on this board"); assert.equal(words.dismiss, "Dismiss");
});
test("1013 and invalid_label retry only on a rejoin with waiting work and the first outcome wins", async () => {
  const { attemptOutcome } = await import("../apps/web/src/team/notices.ts");
  for (const [event, ending] of [[{ kind: "close", code: 1013 }, "full"],
    [{ kind: "failure", status: 400, reason: "invalid_label" }, "cantJoin"]]) {
    for (const rejoining of [false, true]) for (const waiting of [0, 1]) {
      assert.deepEqual(attemptOutcome(null, event, rejoining, waiting), rejoining && waiting
        ? { name: "reconnect", retry: "later" } : { name: ending, retry: false });
    }
    const first = { name: "expired", retry: false };
    assert.strictEqual(attemptOutcome(first, event, true, 2), first);
  }
});

for (const reason of ["board_restored", "access_changed"]) {
  test(`F1 recovery preserves the ${reason} notice until a further edit saves on its first send`, async () => {
    const sync = await import("../packages/board-sync/src/session.ts");
    const { emptyLossRecord, updateLossRecord, isOutstanding, changeCounts, lossNotices, saveState } =
      await import("../apps/web/src/team/notices.ts");
    const f = await fixture(sync);
    let record = emptyLossRecord(), recoveringIds = [];
    const observe = (id) => { record = updateLossRecord(record, f.session.requests, id, recoveringIds); };
    f.session.subscribe((event) => {
      if (event.kind === "joined") {
        recoveringIds = [...f.session.requests].filter(([, request]) => isOutstanding(request)).map(([id]) => id);
      }
      observe();
      if (event.kind === "recovered") recoveringIds = [];
    });
    try {
      const lost = change(f, "Unconfirmed edit"); observe(lost);
      f.wires[0].handlers.close(1006);
      await f.rejoin(reason === "board_restored" ? { restoreGeneration: 1 } : { epoch: 3 });
      assert.equal(f.session.requests.get(lost).reason, reason);
      const notice = lossNotices(record);
      assert.equal(notice.length, 1); assert.equal(notice[0].reason, reason);

      const retry = change(f, "Waiting after the loss"); observe(retry);
      assert(record.observed.get(retry).created > record.newestLoss);
      assert.equal(record.observed.get(retry).deliberate, true);
      f.wires.at(-1).handlers.close(1006);
      assert.equal(f.session.requests.get(retry).state, "waiting");
      const wire = await f.rejoin();
      assert.equal(wire.sent[0].requestId, retry);
      saved(wire, retry);
      assert.equal(f.session.requests.get(retry).state, "saved");
      assert.equal(record.losses.size, 1);
      assert.equal(changeCounts([], record.losses.values()).byReason[reason], 1);
      assert.deepEqual(lossNotices(record), notice);
      assert.equal(record.observed.get(retry).deliberate, false);
      assert.equal(saveState(true, "editor", f.session.requests.values(), record.losses.values()), "Not confirmed");
      observe();
      assert.deepEqual(lossNotices(record), notice, "later observations do not restore clearing eligibility");

      const fresh = change(f, "Saved on the open connection"); observe(fresh);
      assert.equal(record.losses.size, 1, "sending a further edit is not enough");
      saved(wire, fresh, 2);
      assert.equal(record.losses.size, 0); assert.deepEqual(lossNotices(record), []);
      assert.equal(saveState(true, "editor", f.session.requests.values(), record.losses.values()), "Saved");
    } finally { f.finish(); }
  });
}
test("F1 a recovered not-kept request keeps its own notice", async () => {
  const sync = await import("../packages/board-sync/src/session.ts");
  const { emptyLossRecord, updateLossRecord, lossNotices, saveState } = await import("../apps/web/src/team/notices.ts");
  const f = await fixture(sync);
  try {
    const object = f.session.board.objects[0];
    const id = f.session.edit({ ...f.session.board, objects: [{ ...object, x: 10 }] });
    let record = updateLossRecord(emptyLossRecord(), f.session.requests, id);
    f.wires[0].handlers.close(1006);
    record = updateLossRecord(record, f.session.requests);
    f.seed.set({ ...f.session.board, objects: [], retiredGenerations: [object.generation] });
    const wire = await f.rejoin();
    assert.equal(f.session.requests.get(id).notKept, true);
    record = updateLossRecord(record, f.session.requests, undefined, [id]);
    const notice = lossNotices(record);
    assert.equal(notice[0].reason, "not_kept");
    saved(wire, id);
    record = updateLossRecord(record, f.session.requests);
    assert.deepEqual(lossNotices(record), notice);
    assert.equal(saveState(true, "editor", f.session.requests.values(), record.losses.values()), "Saved");
  } finally { f.finish(); }
});
