// SPDX-License-Identifier: Apache-2.0
import { BoardSession, type Transport, type Role, type SessionEvent } from "nextphase-board-sync/session.ts";
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import { api, ApiError } from "./api";
import { auth, type AuthSession } from "./auth";
import { socketOrigin } from "./config";
import type { TeamLink } from "./links";
import { chooseFollow, fitFollow, isPresenceRefusal, presenceToSend, SHOW_CURSORS_KEY, type Presence, type PresenceInput } from "./presence";
import type { View } from "../view";
import { attemptOutcome, isSpecialClose, renewalDelay, retryDelay, saveState, words,
  type AttemptEvent, type Outcome } from "./notices";

type Attempt = { outcome: Outcome | null; joined: boolean; cancelled: boolean; timer: ReturnType<typeof setTimeout>;
  socket?: WebSocket; acceptance: boolean };
export type HostedSnapshot = {
  board?: BoardV10; role?: Role; connected: boolean; workspace: string; workspaceId: string;
  outcome: Outcome | null; toast: string; toastId: number; generation: number;
};
export type PresenceSnapshot = {
  self?: Presence; others: Presence[]; followed: string | null; showCursors: boolean;
};
export class HostedBoard {
  private presenceListeners = new Set<() => void>();
  private received = new Map<string, number>();
  private receiveOrder = 0;
  presence: PresenceSnapshot = { others: [], followed: null, showCursors: true };
  subscribePresence = (listener: () => void) => {
    this.presenceListeners.add(listener);
    return () => { this.presenceListeners.delete(listener); };
  };
  getPresence = () => this.presence;
  private publishPresence(change: Partial<PresenceSnapshot>) {
    this.presence = { ...this.presence, ...change };
    for (const listener of this.presenceListeners) listener();
  }
  private clearPresence() {
    this.received.clear();
    this.publishPresence({ self: undefined, others: [], followed: null });
  }
  setPresence(input: PresenceInput) {
    if (this.snapshot.connected && !this.stopped && !this.ended) this.session?.setPresence(input);
  }
  sendPresence(cursor: PresenceInput["cursor"], selection: Iterable<string>, view: View,
    size: { w: number; h: number }, active: boolean) {
    this.setPresence(presenceToSend(cursor, selection, view, size, active));
  }
  followView(size: { w: number; h: number }) {
    const followed = this.presence.others.find((other) => other.connection === this.presence.followed);
    return followed ? fitFollow(followed.view, size) : undefined;
  }
  follow(person: string) {
    const connection = chooseFollow(this.presence.others.filter((other) => other.person === person), this.received);
    if (connection) this.publishPresence({ followed: connection.connection });
  }
  stopFollowing = () => {
    if (this.presence.followed) this.publishPresence({ followed: null });
  };
  toggleCursors = () => {
    const showCursors = !this.presence.showCursors;
    this.publishPresence({ showCursors });
    try { localStorage.setItem(SHOW_CURSORS_KEY, String(showCursors)); } catch { /* Keep the tab's choice in memory. */ }
  };
  private session?: BoardSession<string>;
  private attempt?: Attempt;
  private retry?: ReturnType<typeof setTimeout>;
  private renewal?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private ended = false;
  private failures = 0;
  private notSaved = false;
  private heldExpiry = 0;
  private token?: AuthSession;
  private accepted = false;
  private listeners = new Set<() => void>();
  private local: () => void;
  private link: TeamLink;
  snapshot: HostedSnapshot = { connected: false, workspace: "Workspace", workspaceId: "",
    outcome: null, toast: "", toastId: 0, generation: 0 };
  boardId = "";
  constructor(link: TeamLink, local: () => void) {
    this.link = link;
    try { this.presence.showCursors = localStorage.getItem(SHOW_CURSORS_KEY) !== "false"; }
    catch { /* Unavailable storage defaults to showing cursors. */ }
    this.local = local;
    if (link.kind === "board") this.boardId = link.board;
  }
  get canEdit() { return this.snapshot.connected && this.snapshot.role !== "viewer" && !this.ended; }
  get status() {
    const requests = [...this.session?.requests.values() ?? []];
    if (this.notSaved) requests.push({ state: "dropped", update: "" });
    return saveState(this.snapshot.connected, this.snapshot.role, requests);
  }
  get undoReason() { return this.session?.history.past.length ? "" : "Nothing to undo."; }
  get redoReason() { return this.session?.history.future.length ? "" : "Nothing to redo."; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish(change: Partial<HostedSnapshot> = {}) {
    if (this.stopped) return;
    if ([...this.session?.requests.values() ?? []].some((request) => ["refused", "dropped"].includes(request.state))) this.notSaved = true;
    this.snapshot = { ...this.snapshot, ...change,
      toastId: this.snapshot.toastId + (change.toast === undefined ? 0 : 1) };
    for (const listener of this.listeners) listener();
  }
  toast(message: string) { this.publish({ toast: message }); }
  start() { void this.connect(); }
  private current(attempt: Attempt) { return !this.stopped && !this.ended && !attempt.cancelled && !attempt.outcome && this.attempt === attempt; }
  private beginAttempt() {
    if (this.attempt) { this.attempt.cancelled = true; clearTimeout(this.attempt.timer); }
    const attempt: Attempt = { outcome: null, joined: false, cancelled: false, acceptance: false,
      timer: setTimeout(() => {
        if (!this.current(attempt) || attempt.outcome) return;
        this.finish(attempt, { kind: "failure", reason: "no_answer" });
      }, 15000) };
    this.attempt = attempt;
    this.clearPresence();
    this.publish({ connected: false });
    return attempt;
  }
  private async ticket() {
    const attempt = this.beginAttempt();
    try {
      if (this.link.kind === "invite" && !this.accepted) {
        attempt.acceptance = true;
        const reply = await api<{ boardId: string | null }>(`/invitations/${this.link.invitation}/accept`, "POST");
        if (!this.current(attempt)) throw Error("Abandoned attempt");
        this.accepted = true;
        this.boardId = reply.boardId ?? this.link.board ?? "";
        attempt.acceptance = false;
        if (!this.boardId) { this.stop(); this.local(); throw Error("No destination board"); }
      }
      const details = await api<{ workspaceId: string; role: Role }>(`/boards/${this.boardId}`);
      if (!this.current(attempt)) throw Error("Abandoned attempt");
      const list = await api<{ workspaces: { id: string; name: string }[] }>("/workspaces");
      if (!this.current(attempt)) throw Error("Abandoned attempt");
      this.publish({ workspaceId: details.workspaceId, role: details.role,
        workspace: list.workspaces.find((workspace) => workspace.id === details.workspaceId)?.name ?? "Workspace" });
      const { data } = await auth.getSession();
      this.token = data.session ?? undefined;
      this.heldExpiry = this.token?.expires_at ?? 0;
      const reply = await api<{ ticket: string }>(`/boards/${this.boardId}/join-tickets`, "POST");
      if (!this.current(attempt)) throw Error("Abandoned attempt");
      return reply.ticket;
    } catch (error) {
      if (this.current(attempt)) {
        const failure = error instanceof ApiError ? error : new ApiError(0, "join_failed");
        this.finish(attempt, { kind: "failure", status: failure.status, reason: failure.reason, acceptance: attempt.acceptance });
      }
      throw error;
    }
  }
  private open(ticket: string): Promise<Transport> {
    const attempt = this.attempt!;
    if (!this.current(attempt) || attempt.outcome) return Promise.reject(Error("Abandoned attempt"));
    const socket = new WebSocket(`${socketOrigin}/boards/${this.boardId}/join?ticket=${encodeURIComponent(ticket)}`);
    attempt.socket = socket;
    let handlers: Parameters<Transport["listen"]>[0] | undefined;
    return new Promise((resolve, reject) => {
      socket.onopen = () => {
        if (!this.current(attempt) || attempt.outcome) { socket.close(1000); reject(Error("Abandoned attempt")); return; }
        resolve({ send: (text) => socket.send(text), close: (code) => socket.close(code), listen: (value) => { handlers = value; } });
      };
      socket.onmessage = (event) => {
        if (!this.current(attempt) || attempt.outcome) return;
        handlers?.message(String(event.data));
        if (JSON.parse(String(event.data)).kind === "joined") {
          attempt.joined = true;
          clearTimeout(attempt.timer);
          this.failures = 0;
          this.scheduleRenewal();
        }
      };
      socket.onclose = (event) => {
        if (!this.current(attempt) || attempt.outcome) return;
        handlers?.close(event.code);
        if (attempt.joined || isSpecialClose(event.code)) this.finish(attempt, { kind: "close", code: event.code });
        else void this.probe(attempt);
        reject(Error("WebSocket closed"));
      };
      // Browsers give no status for an upgrade refusal; close supplies its outcome.
      socket.onerror = () => {};
    });
  }
  private async probe(attempt: Attempt) {
    try {
      await api(`/boards/${this.boardId}`);
      if (this.current(attempt)) this.finish(attempt, { kind: "failure", reason: "join_failed" });
    } catch (error) {
      if (this.current(attempt)) {
        const failure = error instanceof ApiError ? error : new ApiError(0, "no_answer");
        this.finish(attempt, { kind: "failure", status: failure.status, reason: failure.reason });
      }
    }
  }
  private finish(attempt: Attempt, event: AttemptEvent) {
    if (!this.current(attempt) || attempt.outcome) return;
    const outcome = attemptOutcome(attempt.outcome, event, !!this.snapshot.board);
    attempt.outcome = outcome;
    clearTimeout(attempt.timer);
    clearTimeout(this.renewal);
    // Closing the shared client marks unacknowledged requests as dropped before
    // the snapshot is published. It never sends them again on the next join.
    this.session?.close();
    attempt.socket?.close(1000);
    this.clearPresence();
    this.publish({ connected: false, outcome });
    if (!outcome.retry) { this.ended = true; return; }
    const delay = outcome.retry === "now" ? 0 : retryDelay(this.failures++);
    this.retry = setTimeout(() => { void this.connect(); }, delay);
  }
  private async connect() {
    if (this.stopped || this.ended) return;
    try {
      const session = await BoardSession.join({
        ticket: () => this.ticket(), open: (ticket) => this.open(ticket),
        clock: { now: Date.now, after: (ms, run) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer); } },
      });
      if (this.stopped || this.ended || this.attempt?.outcome) { session.close(); return; }
      this.session = session;
      session.subscribe((event) => this.changed(session, event));
      this.joined(session);
    } catch {
      // The route, timeout, or transport already classified the attempt. In
      // particular a failed upgrade must finish its details probe first.
    }
  }
  private joined(session: BoardSession<string>) {
    this.received.clear();
    for (const connection of session.present.keys()) this.received.set(connection, ++this.receiveOrder);
    this.publishPresence({ self: session.self, others: [...session.present.values()], followed: null });
    this.publish({ board: session.board, role: session.role, connected: true, outcome: null,
      generation: this.snapshot.generation + 1 });
    this.updateSession(this.token ?? null);
  }
  private changed(session: BoardSession<string>, event: SessionEvent) {
    if (this.stopped || this.ended || session !== this.session) return;
    if (event.kind === "present" || event.kind === "left") {
      const connection = String(event.connection);
      if (event.kind === "present") this.received.set(connection, ++this.receiveOrder);
      else this.received.delete(connection);
      this.publishPresence({ others: [...session.present.values()],
        followed: event.kind === "left" && this.presence.followed === connection ? null : this.presence.followed });
      return;
    }
    if (event.kind === "refused" && isPresenceRefusal({ reason: event.reason, requestId: event.requestId })) return;
    if (event.kind === "joined") this.joined(session);
    else if (event.kind === "refused") {
      this.clearPresence();
      this.publish({ connected: false, toast: words.refusedEdit(String(event.reason)) });
    } else if (event.kind === "join_failed") {
      if (this.attempt && !this.attempt.outcome && !this.attempt.socket) {
        this.finish(this.attempt, { kind: "failure", reason: "join_failed" });
      }
    } else if (event.kind !== "close") this.publish({ board: session.board });
  }
  edit(board: BoardV10, group?: string) {
    if (!this.canEdit || !this.session || JSON.stringify(board) === JSON.stringify(this.session.board)) return false;
    return this.deliberate(() => this.session!.edit(board, group));
  }
  inverse(direction: "undo" | "redo") {
    if (!this.canEdit || !this.session) return;
    const result = this.deliberate(() => this.session![direction]());
    if (typeof result === "string") this.toast(result === "nothing_to_undo"
      ? direction === "undo" ? "Nothing to undo." : "Nothing to redo."
      : ["changed_by_others", "undo_invalid"].includes(result)
        ? direction === "undo" ? words.undoChanged : words.redoChanged : "");
  }
  private deliberate(run: () => string): boolean | string {
    const old = this.notSaved;
    const requests = this.session!.requests;
    const failures = [...requests].filter(([, request]) => ["refused", "dropped"].includes(request.state));
    for (const [id] of failures) requests.delete(id);
    this.notSaved = false;
    const result = run();
    if (!requests.has(result)) {
      this.notSaved = old;
      for (const [id, request] of failures) requests.set(id, request);
      return result;
    }
    this.publish({ board: this.session!.board });
    return true;
  }
  updateSession(session: AuthSession | null) {
    this.token = session ?? undefined;
    if (session && this.snapshot.connected && session.expires_at! > this.heldExpiry && this.attempt?.socket?.readyState === WebSocket.OPEN) {
      this.attempt.socket.send(JSON.stringify({ kind: "renew", token: session.access_token }));
      this.heldExpiry = session.expires_at!;
      this.scheduleRenewal();
    }
  }
  private scheduleRenewal() {
    clearTimeout(this.renewal);
    const remaining = this.heldExpiry - Date.now() / 1000;
    if (remaining <= 0) return;
    this.renewal = setTimeout(() => {
      void (async () => {
        const { data } = await auth.getSession();
        if ((data.session?.expires_at ?? 0) > this.heldExpiry) this.updateSession(data.session);
        else {
          const refreshed = await auth.refreshSession();
          this.updateSession(refreshed.data.session);
        }
      })();
    }, renewalDelay(remaining));
  }
  expire() { this.end("expired"); }
  signedOut() { this.end("signedOut"); }
  private end(name: "expired" | "signedOut") {
    if (this.ended || this.stopped) return;
    this.session?.close(); this.attempt?.socket?.close(1000);
    if (this.attempt) { this.attempt.cancelled = true; clearTimeout(this.attempt.timer); }
    clearTimeout(this.retry); clearTimeout(this.renewal);
    this.clearPresence();
    this.publish({ connected: false, outcome: { name, retry: false } });
    this.ended = true;
  }
  stop() {
    this.clearPresence();
    this.stopped = true;
    if (this.attempt) { this.attempt.cancelled = true; clearTimeout(this.attempt.timer); }
    clearTimeout(this.retry); clearTimeout(this.renewal);
    this.session?.close(); this.attempt?.socket?.close(1000);
  }
}
