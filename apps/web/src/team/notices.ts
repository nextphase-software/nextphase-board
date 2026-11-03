// SPDX-License-Identifier: Apache-2.0
const changes = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`;
export const words = {
  notFound: "This board doesn't exist, or you don't have access to it.",
  expired: "Your sign-in has expired. Sign in again to keep editing.",
  signedOut: "You signed out. Sign in again to keep working on this board.",
  accessTitle: "You no longer have access to this board",
  accessRemoved: (workspace: string, count = 0) => count
    ? `The owner of ${workspace} removed your access before ${changes(count)} ${count === 1 ? "was" : "were"} confirmed, so ${count === 1 ? "it" : "they"} may not have been saved.`
    : `The owner of ${workspace} removed your access. Edits you made after that were not saved.`,
  viewOnly: (workspace: string) => `You can view this board. Ask the owner of ${workspace} if you need to edit it.`,
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
  ownerOnly: (workspace: string) => `Only the owner of ${workspace} can invite people and change who has access.`,
  guestGrants: "Remove this person's board access before removing them from the workspace.",
  refusedEdit: (reason: string) => `That change wasn't saved: ${reason.replaceAll("_", " ")}.`,
  refusal: (reason: string) => `That didn't work: ${reason.replaceAll("_", " ")}.`,
  undoChanged: "Someone else changed that, so it was not undone.",
  redoChanged: "Someone else changed that, so it was not redone.",
  noAccount: "There is no Board account for this email. Ask the owner of a board to invite you.",
  wrongCode: "That code is wrong or has expired. Check it, or send a new one.",
  rateLimit: "Wait a minute before asking for another code.",
  signInFailed: "Could not sign in. Try again.",
  codeTitle: "Check your email",
  resendPrompt: "No email? Check spam, or ",
  resendCode: "resend the code",
  signedInAs: (email: string) => `Signed in as ${email}`,
  signInTitle: "Sign in to NextPhase Board",
  signInHelper: "We'll email you a 6-digit code. There is no password.",
  signInFooter: "Only people invited to Board can sign in. Your local boards stay on this device either way.",
  codeHelper: (email: string) => `Enter the 6-digit code we sent to ${email}. It works for one hour.`,
  resendWait: (seconds: number) => `No email? Check spam, or resend the code in ${seconds} s.`,
  gateTitle: "Sign in to open this board",
  gateHelper: "Only people invited to it can open it.",
  opening: "Opening board…",
  shareTitle: "Share this board",
  workspaceTitle: (workspace: string) => `People from ${workspace}`,
  workspaceRow: "Workspace editors and viewers",
  workspaceHelper: (workspace: string) => `Editors and viewers of ${workspace} can open every board in it. Guests open only the boards shared with them.`,
  workspaceInvite: (workspace: string) => `Add an email to invite to ${workspace}`,
  boardInvite: "Add an email to invite",
  grantSource: (role: string | null, workspace: string) => role === "editor" || role === "viewer"
    ? `also ${role} in ${workspace}` : "this board",
  guest: "guest, only boards shared directly",
  removing: "Removing · takes effect within a minute",
  shareFooter: (workspace: string) => `Only people invited to this board and editors and viewers of ${workspace} can open it. Board does not send email: copy each invitation link and send it yourself.`,
  invited: (scope: "board" | "workspace", role: string, days: number) =>
    `Invited to ${scope === "board" ? "this board" : "the workspace"} · ${role} · expires in ${days} days`,
  invitationCopied: (email: string) => `Invitation link copied. Send it to ${email} yourself.`,
  accountFailed: (email: string) => `The invitation was saved, but Board could not create a sign-in account for ${email}. Cancel it and invite again.`,
  pending: "Takes effect within a minute",
  updated: "Access updated.",
  noAnswer: "No answer from the server. Check the list before trying again.",
  boardCopied: "Board link copied.",
  copyFailed: "Could not copy the link. Select and copy it below.",
  offlineWaiting: (count: number) => `Offline — ${changes(count)} waiting`,
  reconnectingWaiting: (count: number) => `Reconnecting… ${changes(count)} ${count === 1 ? "is" : "are"} waiting and will be saved when the board is back. You can look around until then.`,
  notConfirmed: "Not confirmed",
  recovered: (count: number) => count === 1 ? "Back online. Your change was saved." : "Back online. Your changes were saved.",
  boardRestored: (count: number) => `This board was restored to an earlier version, so ${changes(count)} may not have been kept.`,
  accessChanged: (count: number) => `Your access changed while you were offline, so ${changes(count)} may not have been saved.`,
  notKept: (count: number) => `Someone deleted what you changed while you were offline, so ${changes(count)} ${count === 1 ? "wasn't" : "weren't"} kept.`,
  lossSentence: (count: number) => count ? `${changes(count)} may not have been saved.` : "",
  leaveTitle: (count: number) => `Leave before your ${count === 1 ? "change is" : "changes are"} saved?`,
  leaveBody: (count: number, board: string) => `${changes(count)} to “${board}” ${count === 1 ? "hasn't" : "haven't"} been confirmed yet. If you leave now, ${count === 1 ? "it" : "they"} may be lost.`,
  leaveAnyway: "Leave anyway",
  stay: "Stay on this board",
  dismiss: "Dismiss",
};
export function authError(error: { status?: number; code?: string } | null, codeStep: boolean) {
  if (error?.status === 429) return words.rateLimit;
  if (error?.code === "otp_disabled") return words.noAccount;
  if (codeStep && ["otp_expired", "otp_invalid"].includes(error?.code ?? "")) return words.wrongCode;
  return words.signInFailed;
}
export function shareError(error: { status: number; reason: string; needed?: string }, workspace: string) {
  if (!error.status) return words.noAnswer;
  if (error.status === 401) return words.expired;
  if (error.reason === "role_too_low" && error.needed === "owner") return words.ownerOnly(workspace);
  if (error.reason === "guest_has_grants") return words.guestGrants;
  return words.refusal(error.reason);
}
export type RequestState = "sent" | "received" | "waiting" | "saved" | "refused" | "dropped";
export type ChangeRequest = { state: RequestState; group?: string; reason?: string; notKept?: boolean };
export const lossReasons = ["board_restored", "access_changed", "access_removed", "signed_out", "sign_in_expired"] as const;
export type LossReason = typeof lossReasons[number];
export type NoticeReason = "board_restored" | "access_changed" | "not_kept";
export const isOutstanding = (request: ChangeRequest) => ["sent", "received", "waiting"].includes(request.state);
export function countChanges(requests: Iterable<ChangeRequest>) {
  const groups = new Set<string>();
  let count = 0;
  for (const request of requests) {
    if (!request.group) count++;
    else if (!groups.has(request.group)) { groups.add(request.group); count++; }
  }
  return count;
}
export function changeCounts(requests: Iterable<ChangeRequest>, losses: Iterable<ChangeRequest> = []) {
  const current = [...requests], lost = [...losses];
  const byReason = Object.fromEntries(lossReasons.map((reason) => [reason,
    countChanges(lost.filter((request) => request.state === "dropped" && request.reason === reason))])) as Record<LossReason, number>;
  return {
    waiting: countChanges(current.filter(isOutstanding)), byReason,
    notConfirmed: countChanges(lost.filter((request) => request.state === "dropped" && lossReasons.includes(request.reason as LossReason))),
    notKept: countChanges(lost.filter((request) => request.notKept)),
    failed: lost.some((request) => request.state === "refused" || request.state === "dropped" &&
      request.reason !== "session_ended" && !lossReasons.includes(request.reason as LossReason)),
  };
}
export type LossRecord = {
  sequence: number; newestLoss: number;
  observed: Map<string, { created: number; deliberate: boolean; loss: string }>;
  losses: Map<string, ChangeRequest>; dismissed: Set<NoticeReason>;
};
export function emptyLossRecord(): LossRecord {
  return { sequence: 0, newestLoss: 0, observed: new Map(), losses: new Map(), dismissed: new Set() };
}
// Sequence numbers order creation and loss events, rather than clock timestamps
// that could tie. Remember observed losses after clearing so they cannot return.
export function updateLossRecord(previous: LossRecord, requests: ReadonlyMap<string, ChangeRequest>, deliberateId?: string): LossRecord {
  const record = { ...previous, observed: new Map(previous.observed), losses: new Map(previous.losses),
    dismissed: new Set(previous.dismissed) };
  for (const [id, request] of requests) {
    const observed = { ...(record.observed.get(id) ?? { created: ++record.sequence, deliberate: false, loss: "" }) };
    if (id === deliberateId) observed.deliberate = true;
    const loss = (request.state === "refused" ? "refused" : request.state === "dropped" && request.reason !== "session_ended"
      ? `dropped:${request.reason}` : "") + (request.notKept ? ":not_kept" : "");
    if (loss && loss !== observed.loss) {
      record.newestLoss = ++record.sequence;
      if (request.reason === "board_restored" || request.reason === "access_changed") record.dismissed.delete(request.reason);
      if (request.notKept) record.dismissed.delete("not_kept");
      record.losses.set(id, { ...request });
    }
    observed.loss = loss;
    record.observed.set(id, observed);
  }
  if ([...requests].some(([id, request]) => {
    const observed = record.observed.get(id)!;
    return observed.deliberate && observed.created > record.newestLoss && request.state === "saved";
  })) { record.losses.clear(); record.dismissed.clear(); }
  return record;
}
export function dismissNotice(record: LossRecord, reason: NoticeReason): LossRecord {
  return { ...record, dismissed: new Set([...record.dismissed, reason]) };
}
export function lossNotices(record: LossRecord) {
  const counts = changeCounts([], record.losses.values());
  const notices = [
    { reason: "board_restored" as const, count: counts.byReason.board_restored, message: words.boardRestored },
    { reason: "access_changed" as const, count: counts.byReason.access_changed, message: words.accessChanged },
    { reason: "not_kept" as const, count: counts.notKept, message: words.notKept },
  ];
  return notices.filter((notice) => notice.count && !record.dismissed.has(notice.reason))
    .map(({ reason, count, message }) => ({ reason, message: message(count) }));
}
export function saveState(connected: boolean, role: string | undefined, requests: Iterable<ChangeRequest>, losses?: Iterable<ChangeRequest>) {
  const current = [...requests], counts = changeCounts(current, losses ?? current);
  if (counts.failed) return "Not saved";
  if (counts.notConfirmed) return words.notConfirmed;
  if (!connected) return counts.waiting ? words.offlineWaiting(counts.waiting) : "Offline — view only";
  if (current.some((request) => request.state === "sent" || request.state === "received")) return "Saving…";
  return role === "viewer" ? "View only" : "Saved";
}
export function endingMessage(name: OutcomeName, workspace: string, count: number) {
  if (name === "accessRemoved") return words.accessRemoved(workspace, count);
  const message = name === "signedOut" ? words.signedOut : name === "disabled" ? words.disabled : words.expired;
  return message + (count ? " " + words.lossSentence(count) : "");
}
export const retryDelay = (failure: number) => Math.min(30000, 2000 * 2 ** Math.min(failure, 4));
export const renewalDelay = (remainingSeconds: number) => {
  const remaining = Math.max(0, remainingSeconds) * 1000;
  return Math.max(0, remaining - Math.min(60000, remaining / 2));
};
export type OutcomeName = "expired" | "accessRemoved" | "notFound" | "cantJoin" | "disabled"
  | "restoring" | "cantOpen" | "full" | "reconnect" | "signedOut";
export type Outcome = { name: OutcomeName; retry: false | "now" | "later"; message?: string };
export type AttemptEvent = { kind: "close"; code: number }
  | { kind: "failure"; status?: number; reason?: string; acceptance?: boolean };
const specialCloses = new Set([1012, 1013, 4401, 4403, 4409, 4423]);
export const isSpecialClose = (code: number) => specialCloses.has(code);
export function classifyClose(code: number): Outcome {
  if (code === 4401) return { name: "expired", retry: false };
  if (code === 1013) return { name: "full", retry: false };
  if ([4403, 4409, 1012].includes(code)) return { name: "reconnect", retry: "now" };
  if (code === 4423) return { name: "restoring", retry: "later" };
  return { name: "cantOpen", retry: "later" };
}
export function failedJoin(status = 0, reason = "no_answer", reconnecting = false, acceptance = false): Outcome {
  if (status === 401) return { name: "expired", retry: false };
  if (status === 404) return { name: reconnecting ? "accessRemoved" : "notFound", retry: false };
  if (acceptance && (status === 410 || reason === "invitation_email_mismatch")) {
    const messages: Record<string, string> = {
      invitation_expired: words.invitation_expired,
      invitation_used: words.invitation_used,
      invitation_cancelled: words.invitation_cancelled,
      invitation_email_mismatch: words.invitation_email_mismatch,
    };
    return { name: "notFound", retry: false, message: messages[reason] ?? words.notFound };
  }
  if (status === 400 && reason === "invalid_label") return { name: "cantJoin", retry: false };
  if (status === 403 && reason === "account_disabled") return { name: "disabled", retry: false };
  if (status === 503 && ["room_locked", "access_log_pruned"].includes(reason)) return { name: "restoring", retry: "later" };
  return { name: "cantOpen", retry: "later" };
}
// A transport can close and then reject the same join. Only its first outcome wins.
export function attemptOutcome(previous: Outcome | null, event: AttemptEvent, reconnecting = false, waiting = 0): Outcome {
  if (previous) return previous;
  if (reconnecting && waiting > 0 && (event.kind === "close" && event.code === 1013 ||
    event.kind === "failure" && event.status === 400 && event.reason === "invalid_label")) {
    return { name: "reconnect", retry: "later" };
  }
  return event.kind === "close" ? classifyClose(event.code)
    : failedJoin(event.status, event.reason, reconnecting, event.acceptance);
}
