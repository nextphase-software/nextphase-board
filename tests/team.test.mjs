// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { teamSettings } from "../scripts/team-settings.mjs";
import { parseLink, boardLink, invitationLink } from "../apps/web/src/team/links.ts";
import { roleSource, roleWords, pendingInvitation, expiresInDays } from "../apps/web/src/team/roles.ts";
import { saveState, classifyClose, failedJoin, attemptOutcome, retryDelay, renewalDelay,
  words, authError, shareError } from "../apps/web/src/team/notices.ts";

const settings = { BOARD_TEAM_FEATURES: "on", BOARD_SUPABASE_URL: "http://localhost:55321/",
  BOARD_SUPABASE_ANON_KEY: "synthetic", BOARD_SERVER_URL: "https://board.example/" };
const board = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", invitation = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("the team switch is exact and validates each required setting", () => {
  for (const value of [undefined, "", "ON", "true", "1", "on "]) {
    assert.equal(teamSettings({ ...settings, BOARD_TEAM_FEATURES: value }), null);
  }
  assert.deepEqual(teamSettings(settings), { supabaseUrl: "http://localhost:55321", anonKey: "synthetic", serverUrl: "https://board.example" });
  for (const name of ["BOARD_SUPABASE_URL", "BOARD_SUPABASE_ANON_KEY", "BOARD_SERVER_URL"]) {
    for (const value of [undefined, "", " "]) assert.throws(() => teamSettings({ ...settings, [name]: value }), new RegExp(name));
  }
  for (const name of ["BOARD_SUPABASE_URL", "BOARD_SERVER_URL"]) {
    for (const value of ["https://example.com/path", "https://example.com/path/..", " https://example.com", "https://example.com?x=1", "https://example.com#x",
      "https://me@example.com", "https://me:secret@example.com", "ftp://example.com", "no URL", "https://example.com?", "https://example.com#"]) {
      assert.throws(() => teamSettings({ ...settings, [name]: value }), new RegExp(name), value);
    }
  }
});
test("team links are strict and written from the page's origin and path", () => {
  assert.deepEqual(parseLink(`#/b/${board}`), { kind: "board", board });
  assert.deepEqual(parseLink(`#/invite/${invitation}`), { kind: "invite", invitation, board: undefined });
  assert.deepEqual(parseLink(`#/invite/${invitation}?board=${board}`), { kind: "invite", invitation, board });
  for (const hash of [`#/b/${board.toUpperCase()}`, `#/b/${board}/`, `#/b/${board}?x=1`,
    `#/invite/${invitation.toUpperCase()}`, `#/invite/${invitation}/`, `#/invite/${invitation}?board=${board}&x=1`,
    `#/invite/${invitation}?board=no`, "#/b/", "#/x"]) assert.deepEqual(parseLink(hash), { kind: "bad" }, hash);
  for (const hash of ["", "#notes"]) assert.deepEqual(parseLink(hash), { kind: "local" });
  for (const path of ["/", "/preview/board"]) {
    const address = `https://board.example${path}?discard=1#old`;
    assert.equal(boardLink(address, board), `https://board.example${path}#/b/${board}`);
    assert.equal(invitationLink(address, invitation, board), `https://board.example${path}#/invite/${invitation}?board=${board}`);
  }
});
test("every workspace role and board grant shows the higher role and its source", () => {
  const expected = {
    owner: [["owner", "both"], ["owner", "both"], ["owner", "workspace"]],
    editor: [["editor", "both"], ["editor", "both"], ["editor", "workspace"]],
    viewer: [["editor", "both"], ["viewer", "both"], ["viewer", "workspace"]],
    guest: [["editor", "this board"], ["viewer", "this board"], [null, "none"]],
    none: [["editor", "this board"], ["viewer", "this board"], [null, "none"]],
  };
  for (const [workspace, pairs] of Object.entries(expected)) ["editor", "viewer", null].forEach((grant, index) => {
    assert.deepEqual(roleSource(workspace === "none" ? null : workspace, grant), { role: pairs[index][0], source: pairs[index][1] });
  });
  assert.deepEqual(["owner", "editor", "viewer", "guest"].map(roleWords), ["owner", "can edit", "can view", "guest"]);
});
test("pending invitations exclude accepted, cancelled and expiry at or before now", () => {
  const expiresAt = "2026-11-01T12:00:00Z", now = Date.parse(expiresAt);
  const value = { expiresAt, acceptedAt: null, cancelledAt: null };
  assert(pendingInvitation(value, now - 1));
  for (const time of [now, now + 1]) assert.equal(pendingInvitation(value, time), false);
  for (const patch of [{ acceptedAt: "2026-10-31T00:00:00Z" }, { cancelledAt: "2026-10-31T00:00:00Z" }]) {
    assert.equal(pendingInvitation({ ...value, ...patch }, now - 1), false);
  }
  assert.equal(expiresInDays(expiresAt, now - 1), 1);
  assert.equal(expiresInDays(expiresAt, now - 86400001), 2);
});
test("save states use the full precedence order; received and sent are never Saved", () => {
  const requests = (...states) => states.map((state) => ({ state }));
  const rows = [
    [false, "editor", [], "Offline — view only"],
    [true, "editor", ["refused"], "Not saved"], [true, "editor", ["dropped"], "Not saved"],
    [true, "editor", ["sent"], "Saving…"], [true, "editor", ["received"], "Saving…"],
    [true, "viewer", [], "View only"], [true, "editor", ["saved"], "Saved"], [true, "owner", [], "Saved"],
  ];
  for (const [connected, role, states, expected] of rows) assert.equal(saveState(connected, role, requests(...states)), expected);
  // All ten precedence pairs, not just adjacent rows.
  const cases = [
    { connected: false, role: "editor", states: [], label: "Offline — view only" },
    { connected: true, role: "editor", states: ["dropped"], label: "Not saved" },
    { connected: true, role: "editor", states: ["received"], label: "Saving…" },
    { connected: true, role: "viewer", states: [], label: "View only" },
    { connected: true, role: "editor", states: ["saved"], label: "Saved" },
  ];
  cases.forEach((higher, index) => cases.slice(index + 1).forEach((lower) => {
    assert.equal(saveState(higher.connected && lower.connected,
      higher.role === "viewer" || lower.role === "viewer" ? "viewer" : "editor",
      requests(...higher.states, ...lower.states)), higher.label);
  }));
});
test("close codes, failed joins, retries and one outcome per attempt", () => {
  const closes = [[4401, "expired", false], [4403, "reconnect", "now"], [4409, "reconnect", "now"],
    [1012, "reconnect", "now"], [4423, "restoring", "later"], [1013, "full", false],
    [1000, "cantOpen", "later"], [1001, "cantOpen", "later"], [1006, "cantOpen", "later"]];
  for (const [code, name, retry] of closes) assert.deepEqual(classifyClose(code), { name, retry });
  const failures = [[401, "token_expired", "expired", false], [404, "not_found", "notFound", false],
    [400, "invalid_label", "cantJoin", false], [403, "account_disabled", "disabled", false],
    [503, "room_locked", "restoring", "later"], [503, "access_log_pruned", "restoring", "later"],
    [503, "service_unavailable", "cantOpen", "later"], [0, "no_answer", "cantOpen", "later"],
    [0, "join_failed", "cantOpen", "later"]];
  for (const reconnecting of [false, true]) for (const [status, reason, expected, retry] of failures) {
    assert.deepEqual(failedJoin(status, reason, reconnecting), {
      name: reconnecting && expected === "notFound" ? "accessRemoved" : expected, retry,
    });
  }
  assert.deepEqual(failedJoin(404, "not_found", false, true), { name: "notFound", retry: false });
  for (const reason of ["invitation_expired", "invitation_used", "invitation_cancelled", "invitation_email_mismatch"]) {
    assert.deepEqual(failedJoin(reason === "invitation_email_mismatch" ? 403 : 410, reason, false, true), {
      name: "notFound", retry: false, message: words[reason],
    });
  }
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => retryDelay(index)), [2000, 4000, 8000, 16000, 30000, 30000]);
  const full = attemptOutcome(null, { kind: "close", code: 1013 });
  assert.deepEqual(attemptOutcome(full, { kind: "failure", reason: "join_failed" }), { name: "full", retry: false });
  const offline = attemptOutcome(null, { kind: "close", code: 1006 });
  assert.strictEqual(attemptOutcome(offline, { kind: "failure", reason: "join_failed" }), offline);
  assert.deepEqual(attemptOutcome(null, { kind: "close", code: 4401 }), { name: "expired", retry: false });
  for (const final of [full, classifyClose(4401), failedJoin(404, "not_found", true)]) {
    for (const event of [{ kind: "close", code: 1006 }, { kind: "close", code: 4403 }, { kind: "failure", status: 503 }]) {
      assert.strictEqual(attemptOutcome(final, event, true), final);
    }
  }
});
test("renewal runs min(60 seconds, half the lifetime) before expiry and never goes negative", () => {
  assert.deepEqual([3600, 120, 60, 10, 0, -10].map(renewalDelay), [3540000, 60000, 30000, 5000, 0, 0]);
});
test("hosted and Auth messages match their contracts character for character", () => {
  const expected = {
    notFound: "This board doesn't exist, or you don't have access to it.",
    expired: "Your sign-in has expired. Sign in again to keep editing.",
    signedOut: "You signed out. Sign in again to keep working on this board.",
    accessTitle: "You no longer have access to this board",
    restoring: "This board is being restored. It will be back shortly.",
    full: "This board has the most people it can hold (50). Try again later.",
    cantOpen: "Can't open this board right now. Trying again…",
    reconnecting: "Reconnecting… You can look around; editing comes back when the board does.",
    invitation_expired: "This invitation has expired. Ask the owner for a new one.",
    invitation_used: "This invitation was already used. Ask the owner for a new one.",
    invitation_cancelled: "This invitation was cancelled. Ask the owner for a new one.",
    invitation_email_mismatch: "This invitation is for another email address. Sign in with that one.",
    disabled: "This account can't open boards right now. Ask the owner of the workspace.",
    cantJoin: "This board can't be opened with this account's email address.",
    guestGrants: "Remove this person's board access before removing them from the workspace.",
    undoChanged: "Someone else changed that, so it was not undone.", redoChanged: "Someone else changed that, so it was not redone.",
    noAccount: "There is no Board account for this email. Ask the owner of a board to invite you.",
    wrongCode: "That code is wrong or has expired. Check it, or send a new one.", rateLimit: "Wait a minute before asking for another code.",
    codeTitle: "Check your email", resendPrompt: "No email? Check spam, or ", resendCode: "resend the code",
    signInFailed: "Could not sign in. Try again.", signInTitle: "Sign in to NextPhase Board",
    signInHelper: "We'll email you a 6-digit code. There is no password.",
    signInFooter: "Only people invited to Board can sign in. Your local boards stay on this device either way.",
    gateTitle: "Sign in to open this board", gateHelper: "Only people invited to it can open it.", opening: "Opening board…",
    shareTitle: "Share this board", workspaceRow: "Workspace editors and viewers", boardInvite: "Add an email to invite",
    guest: "guest, only boards shared directly", removing: "Removing · takes effect within a minute",
    pending: "Takes effect within a minute", updated: "Access updated.",
    noAnswer: "No answer from the server. Check the list before trying again.",
    boardCopied: "Board link copied.", copyFailed: "Could not copy the link. Select and copy it below.",
  };
  for (const [name, expectedWords] of Object.entries(expected)) assert.equal(words[name], expectedWords, name);
  const workspace = "Example team", email = "person@example.com";
  const samples = [
    [words.signedInAs(email), "Signed in as person@example.com"],
    [words.accessRemoved(workspace), "The owner of Example team removed your access. Edits you made after that were not saved."],
    [words.viewOnly(workspace), "You can view this board. Ask the owner of Example team if you need to edit it."],
    [words.ownerOnly(workspace), "Only the owner of Example team can invite people and change who has access."],
    [words.refusedEdit("invalid_update"), "That change wasn't saved: invalid update."],
    [words.refusal("owner_row_immutable"), "That didn't work: owner row immutable."],
    [words.codeHelper(email), "Enter the 6-digit code we sent to person@example.com. It works for one hour."],
    [words.resendWait(60), "No email? Check spam, or resend the code in 60 s."],
    [words.workspaceTitle(workspace), "People from Example team"],
    [words.workspaceHelper(workspace), "Editors and viewers of Example team can open every board in it. Guests open only the boards shared with them."],
    [words.workspaceInvite(workspace), "Add an email to invite to Example team"],
    [words.shareFooter(workspace), "Only people invited to this board and editors and viewers of Example team can open it. Board does not send email: copy each invitation link and send it yourself."],
    [words.grantSource("editor", workspace), "also editor in Example team"],
    [words.grantSource("viewer", workspace), "also viewer in Example team"], [words.grantSource("guest", workspace), "this board"],
    [words.invited("board", "can edit", 7), "Invited to this board · can edit · expires in 7 days"],
    [words.invited("workspace", "can view", 1), "Invited to the workspace · can view · expires in 1 days"],
    [words.invitationCopied(email), "Invitation link copied. Send it to person@example.com yourself."],
    [words.accountFailed(email), "The invitation was saved, but Board could not create a sign-in account for person@example.com. Cancel it and invite again."],
  ];
  for (const [actual, expectedWords] of samples) assert.equal(actual, expectedWords);
  assert.deepEqual(Object.keys(words).sort(), [...Object.keys(expected),
    "accessRemoved", "viewOnly", "ownerOnly", "refusedEdit", "refusal", "codeHelper", "resendWait",
    "workspaceTitle", "workspaceHelper", "workspaceInvite", "shareFooter", "grantSource", "invited",
    "invitationCopied", "accountFailed", "signedInAs"].sort());
  assert.equal(words.resendPrompt + words.resendCode + ".", "No email? Check spam, or resend the code.");
  assert.equal(authError({ code: "otp_disabled" }, false), expected.noAccount);
  assert.equal(authError({ code: "otp_expired" }, true), expected.wrongCode);
  assert.equal(authError({ code: "otp_invalid" }, true), expected.wrongCode);
  assert.equal(authError({ status: 429 }, false), expected.rateLimit);
  for (const error of [null, { status: 500 }, { code: "network" }]) assert.equal(authError(error, false), expected.signInFailed);
  assert.equal(shareError({ status: 0, reason: "no_answer" }, workspace), expected.noAnswer);
  assert.equal(shareError({ status: 401, reason: "token_expired" }, workspace), expected.expired);
  assert.equal(shareError({ status: 403, reason: "role_too_low", needed: "owner" }, workspace), words.ownerOnly(workspace));
  assert.equal(shareError({ status: 409, reason: "guest_has_grants" }, workspace), expected.guestGrants);
  assert.equal(shareError({ status: 409, reason: "owner_row_immutable" }, workspace), "That didn't work: owner row immutable.");
});
