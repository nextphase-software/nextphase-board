// SPDX-License-Identifier: Apache-2.0
import { checkReaction, checkReacted, type ReactionId, type ReactionEvent } from "./reactions.ts";
export { REACTIONS, checkReaction, checkReacted, reactionBudget, reactionBytes } from "./reactions.ts";
export type { ReactionId, Reaction, Reacted, ReactionEvent } from "./reactions.ts";
import { checkSpotlightFrame, spotlightProjection, retryClose, terminalSpotlightClose, type SpotlightProjection, type SpotlightCommand } from "./spotlight.ts";
export type { SpotlightProjection, SpotlightSession, SpotlightOwn, SpotlightAction, SpotlightCause, SpotlightFrame, SpotlightReason, SpotlightCommand } from "./spotlight.ts";
import { checkVoteFrame, voteProjection, type VoteProjection, type VoteCommand } from './voting.ts';
export type { VoteProjection, VoteSession, VoteOwn, VoteAction, VoteCause, VoteReason, VoteFrame, VoteTarget, BallotTarget, VoteCommand } from './voting.ts';
import { checkTimerFrame, timerSnapshot, timerInteger, type TimerSnapshot, type TimerFrame, type TimerAction } from "./timer.ts";
export { checkTimerFrame, timerSnapshot, timerInteger } from "./timer.ts";
export type { TimerSnapshot, TimerFrame, TimerAction, TimerCause } from "./timer.ts";
import * as Y from "yjs";
import { type BoardV14 } from "nextphase-board-rules/document.ts";
import { Adapter, type TableOrderHint } from "./document-adapter.ts";
import { readLiveBoard } from "./codec.ts";
import { capture, SharedUndo } from "./undo.ts";
import { normalizeText, textProblem, type CommentOperation, type CommentRequest, type CommentThread } from "./comments.ts";

export type Role = "owner" | "editor" | "viewer";
export type PresenceInput = { cursor: { x: number; y: number } | null; selection: string[];
  view: { x: number; y: number; width: number; height: number }; active: boolean; page: string };
export type Presence = PresenceInput & { connection: string; person: string; label: string; role: Role; colour: string };
export type Clock = { now(): number; after(ms: number, run: () => void): () => void };
export type Transport = { send(text: string): void; close(code: number, reason?:string): void;
  listen(handlers: { message(text: string): void; close(code: number): void }): void };
export type SessionOptions<T> = { ticket(): Promise<T>; open(ticket: T): Promise<Transport>; clock: Clock; clientId?: number };
export type Request = {
  state: "sent" | "received" | "waiting" | "saved" | "refused" | "dropped";
  reason?: string; update: string; text?: string; revision?: number; group?: string; arrivalOf?: string;
  touched: { id: string; generation: string }[]; notKept?: boolean;
};
const outstanding = (request: Request) => ["sent", "received", "waiting"].includes(request.state);
export type SessionEvent = { kind: string; [key: string]: unknown };
const sizeOf = (text: string) => new TextEncoder().encode(text).length;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function coordinates(value: unknown, keys: string[]) {
  return record(value) && Object.keys(value).length === keys.length && keys.every((key) =>
    typeof value[key] === "number" && Number.isFinite(value[key]) && Math.abs(value[key]) <= 1000000);
}
// Used by both the local client and the room, which adds its rate-window check
// before calling this validator. Wire bytes include all received whitespace.
export function checkPresence(value: unknown, size: number, wire = false): PresenceInput | string {
  if (size > 1048576) return "message_too_large";
  if (size > 12288) return "presence_too_large";
  if (!record(value)) return "bad_presence";
  const allowed = wire ? ["kind", "cursor", "selection", "view", "active", "page"] : ["cursor", "selection", "view", "active", "page"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return wire ? "presence_fields" : "bad_presence";
  if (Array.isArray(value.selection) && value.selection.length > 250) return "presence_selection_limit";
  if (Object.keys(value).length !== allowed.length || wire && value.kind !== "presence" ||
    value.cursor !== null && !coordinates(value.cursor, ["x", "y"]) ||
    !coordinates(value.view, ["x", "y", "width", "height"]) ||
    (value.view as any).width <= 0 || (value.view as any).height <= 0 ||
    typeof value.page !== "string" || !uuid.test(value.page) || typeof value.active !== "boolean" || !Array.isArray(value.selection) ||
    value.selection.some((id) => typeof id !== "string" || !uuid.test(id))) return "bad_presence";
  return { cursor: value.cursor as PresenceInput["cursor"], view: value.view as PresenceInput["view"],
    active: value.active, page: value.page, selection: [...new Set(value.selection)] };
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function encode(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = bytes[i] * 65536 + (bytes[i + 1] ?? 0) * 256 + (bytes[i + 2] ?? 0);
    text += alphabet[n >>> 18] + alphabet[n >>> 12 & 63] +
      (i + 1 < bytes.length ? alphabet[n >>> 6 & 63] : "=") + (i + 2 < bytes.length ? alphabet[n & 63] : "=");
  }
  return text;
}
export function decode(text: string) {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const n = alphabet.indexOf(text[i]) * 262144 + alphabet.indexOf(text[i + 1]) * 4096 +
      Math.max(0, alphabet.indexOf(text[i + 2])) * 64 + Math.max(0, alphabet.indexOf(text[i + 3]));
    bytes.push(n >>> 16 & 255);
    if (text[i + 2] !== "=") bytes.push(n >>> 8 & 255);
    if (text[i + 3] !== "=") bytes.push(n & 255);
  }
  return Uint8Array.from(bytes);
}

export class BoardSession<T = unknown> {
  readonly options: SessionOptions<T>;
  readonly requests = new Map<string, Request>();
  readonly present = new Map<string, Presence>();
  readonly threads = new Map<string, CommentThread>();
  readonly commentRequests = new Map<string, CommentRequest>();
  private reactionListener?: (event: ReactionEvent) => void;
  subscribeReactions(listener: (event: ReactionEvent) => void) {
    this.reactionListener = listener;
    return () => { if (this.reactionListener === listener) this.reactionListener = undefined; };
  }
  react(reaction: ReactionId, x: number, y: number) {
    const frame = { kind: 'react', reaction, x, y };
    if (!this.joined || this.votingSnapshot?.session.status === 'running' || typeof checkReaction(frame, sizeOf(JSON.stringify(frame))) === 'string') return false;
    return this.send(JSON.stringify(frame));
  }
  spotlightSnapshot?:SpotlightProjection;
  private retiredSpotlightAuthorities=new Set<string>();
  private spotlightListeners=new Set<(event:SessionEvent)=>void>();
  subscribeSpotlight(listener:(event:SessionEvent)=>void){this.spotlightListeners.add(listener);return()=>{this.spotlightListeners.delete(listener);};}
  private reportSpotlight(event:SessionEvent){for(const listener of this.spotlightListeners)listener(event);}
  spotlightRead(requestId:string){return this.joined&&this.send(JSON.stringify({kind:'spotlight_read',requestId,epoch:this.epoch,restoreGeneration:this.restoreGeneration}));}
  spotlightCommand(command:Omit<SpotlightCommand,'kind'|'epoch'|'restoreGeneration'>){return this.joined&&this.send(JSON.stringify({...command,kind:'spotlight_command',epoch:this.epoch,restoreGeneration:this.restoreGeneration}));}
  timerSnapshot?: TimerSnapshot;
  timerServerNowMs?: number;
  private timerListeners = new Set<(event: SessionEvent) => void>();
  subscribeTimer(listener: (event: SessionEvent) => void) { this.timerListeners.add(listener); return () => { this.timerListeners.delete(listener); }; }
  private reportTimer(event: SessionEvent) { for (const listener of this.timerListeners) listener(event); }
  timerRead(requestId: string) {
    if (!this.joined) return false;
    return this.send(JSON.stringify({kind:"timer_read",requestId,epoch:this.epoch,restoreGeneration:this.restoreGeneration}));
  }
  timerCommand(requestId: string, action: TimerAction, timer: TimerSnapshot, durationMs?: number) {
    if (!this.joined) return false;
    return this.send(JSON.stringify({kind:"timer_command",requestId,epoch:this.epoch,restoreGeneration:this.restoreGeneration,timerId:timer.timerId,expectedVersion:timer.version,action,...(action==="start"?{durationMs}:{})}));
  }
  votingSnapshot?: VoteProjection;
  private votingListeners = new Set<(event: SessionEvent) => void>();
  subscribeVoting(listener:(event:SessionEvent)=>void){this.votingListeners.add(listener);return()=>{this.votingListeners.delete(listener);};}
  private reportVoting(event:SessionEvent){for(const listener of this.votingListeners)listener(event);}
  voteRead(requestId:string){return this.joined&&this.send(JSON.stringify({kind:'vote_read',requestId,epoch:this.epoch,restoreGeneration:this.restoreGeneration}));}
  voteCommand(command:Omit<VoteCommand,'kind'|'epoch'|'restoreGeneration'>){return this.joined&&this.send(JSON.stringify({...command,kind:'vote_command',epoch:this.epoch,restoreGeneration:this.restoreGeneration}));}
  private votingPrivacy(projection:VoteProjection){
    const old=this.votingSnapshot;
    if(old&&(projection.session.sessionVersion<old.session.sessionVersion||projection.session.sessionVersion===old.session.sessionVersion&&old.own&&'ballotVersion'in old.own&&projection.own&&'ballotVersion'in projection.own&&projection.own.ballotVersion<old.own.ballotVersion))return;
    const was=this.votingSnapshot?.session.status==='running',running=projection.session.status==='running';
    this.votingSnapshot=projection;
    if(running && !was)this.reactionListener?.({kind:"reactions_clear"});
    if(was!==running){
      this.timers();
      for(const [id,p] of this.present)this.present.set(id,{...p,cursor:null,selection:[],view:{x:0,y:0,width:1,height:1}});
    }
  }
  commentsReady = false;
  readonly history = new SharedUndo();
  private adapter = new Adapter();
  private transport?: Transport;
  private listeners = new Set<(event: SessionEvent) => void>();
  private generation = 0;
  private joined = false;
  private ended = false;
  private accepted = false;
  private rejectJoin?: (error: Error) => void;
  private deadlines = new Map<string, () => void>();
  private recovery: string[] = [];
  recovering = false;
  private lastPresence?: PresenceInput;
  private heldPresence?: PresenceInput;
  private lastSent = -Infinity;
  private presenceTimes: number[] = [];
  change: { origin: "own" | "remote" | "reload"; connection?: string } = { origin: "reload" };
  private cancelTrailing?: () => void;
  private cancelHeartbeat?: () => void;
  role?: Role;
  self?: Presence;
  epoch = 0;
  restoreGeneration = 0;
  revision = 0;
  get board() { return readLiveBoard(this.adapter.doc); }
  get doc() { return this.adapter.doc; }
  private constructor(options: SessionOptions<T>) { this.options = options; }
  static async join<T>(options: SessionOptions<T>): Promise<BoardSession<T>> {
    const session = new BoardSession(options);
    await session.connect();
    return session;
  }
  subscribe(listener: (event: SessionEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private report(event: SessionEvent) { for (const listener of this.listeners) listener(event); }
  private timers() {
    this.cancelTrailing?.(); this.cancelHeartbeat?.();
    this.cancelTrailing = undefined; this.cancelHeartbeat = undefined;
    this.heldPresence = undefined; this.lastPresence = undefined; this.lastSent = -Infinity; this.presenceTimes = [];
  }
  private cancelDeadline(id: string) {
    this.deadlines.get(id)?.();
    this.deadlines.delete(id);
  }
  private drop(reason: string) {
    for (const [id, request] of this.requests) if (outstanding(request)) {
      request.state = "dropped"; request.reason = reason; this.cancelDeadline(id);
    }
  }
  private endAttempt(event?: SessionEvent, recover=true) {
    const transport = this.transport;
    ++this.generation;
    this.transport = undefined;
    this.joined = false; this.recovering = false; this.recovery = [];
    this.reactionListener?.({kind:"reactions_clear"});
    for (const [id, request] of this.requests) {
      if (request.state === "sent" || request.state === "received") request.state = "waiting";
      this.cancelDeadline(id);
    }
    for (const [id, request] of this.commentRequests) {
      if (request.state === "sent") { request.state = "unconfirmed"; request.reason = "connection_lost"; }
      this.cancelDeadline(id);
    }
    this.timerSnapshot = undefined; this.timerServerNowMs = undefined; this.reportTimer({kind:"timer_closed"});
    this.spotlightSnapshot=undefined;this.retiredSpotlightAuthorities.clear();this.reportSpotlight({kind:"spotlight_closed",recover});
    this.votingSnapshot=undefined;this.reportVoting({kind:"vote_closed"});
    this.commentsReady = false;
    this.timers(); this.present.clear();
    const reject = this.rejectJoin; this.rejectJoin = undefined;
    reject?.(Error("Connection attempt ended"));
    // Invalidate the transport before closing it: close may call back immediately.
    transport?.close(recover?retryClose.code:1000,recover?retryClose.reason:undefined);
    if (event) this.report(event);
  }
  interrupt() { if (!this.ended) this.endAttempt(); }
  async reconnect() {
    if (this.ended) return;
    this.endAttempt();
    await this.connect();
  }
  discard(reason: string) {
    if (this.ended) return;
    this.drop(reason); this.history.clear(); this.threads.clear(); this.commentRequests.clear(); this.endAttempt(undefined,false);
    this.report({ kind: "discarded", reason });
  }
  private async connect() {
    const generation = ++this.generation;
    const ticket = await this.options.ticket();
    if (this.ended || generation !== this.generation) return;
    const transport = await this.options.open(ticket);
    if (this.ended || generation !== this.generation) { transport.close(1000); return; }
    this.transport = transport;
    await new Promise<void>((resolve, reject) => {
      this.rejectJoin = reject;
      transport.listen({
        message: (text) => {
          if (generation !== this.generation || this.ended) return;
          const message = JSON.parse(text);
          this.apply(message, sizeOf(text));
          if (message.kind === "joined") { this.rejectJoin = undefined; resolve(); }
        },
        close: (code) => {
          if (generation !== this.generation || this.ended) return;
          this.endAttempt({ kind: "close", code },!terminalSpotlightClose(code));
        },
      });
    });
  }
  private rejoin() {
    this.history.clear();
    this.endAttempt(undefined,false);
    void this.connect().catch((error) => this.report({ kind: "join_failed", reason: String(error) }));
  }
  private apply(message: any, wireSize = sizeOf(JSON.stringify(message))) {
    if (message?.kind === 'reacted') {
      if (this.joined && this.votingSnapshot?.session.status !== 'running' && checkReacted(message, wireSize) && this.present.has(message.connection)) this.reactionListener?.(message);
      return;
    }
    if (message?.kind === 'refused' && ['reaction_too_large', 'bad_reaction', 'reactions_voting'].includes(message.reason)) return;
    if(typeof message?.kind==='string'&&message.kind.startsWith('spotlight_')){
      if(!checkSpotlightFrame(message,sizeOf(JSON.stringify(message)))){this.reportSpotlight({kind:'spotlight_invalid'});return;}
      if(message.restoreGeneration!==undefined&&message.restoreGeneration!==this.restoreGeneration)return;
      if(message.spotlight){
        const old=this.spotlightSnapshot,next=message.spotlight;
        if(this.retiredSpotlightAuthorities.has(next.session.authorityId))return;
        if(old&&old.session.authorityId===next.session.authorityId&&(next.session.controlVersion<old.session.controlVersion||next.session.controlVersion===old.session.controlVersion&&next.own.membershipVersion<old.own.membershipVersion))return;
        if(old&&old.session.authorityId!==next.session.authorityId)this.retiredSpotlightAuthorities.add(old.session.authorityId);
        this.spotlightSnapshot=next;
      }
      this.reportSpotlight(message);return;
    }
    if(typeof message?.kind==='string'&&message.kind.startsWith('vote_')) {
      if(!checkVoteFrame(message,sizeOf(JSON.stringify(message)))){this.reportVoting({kind:'vote_invalid'});return;}
      if(message.restoreGeneration!==undefined&&message.restoreGeneration!==this.restoreGeneration)return;
      if(message.voting)this.votingPrivacy(message.voting);
      this.reportVoting(message);return;
    }
    if (typeof message?.kind === "string" && message.kind.startsWith("timer_")) {
      if (!checkTimerFrame(message,sizeOf(JSON.stringify(message)))) { this.reportTimer({kind:"timer_invalid"}); return; }
      if (message.restoreGeneration !== undefined && message.restoreGeneration !== this.restoreGeneration) return;
      this.reportTimer(message); return;
    }
    if (message.kind.startsWith("comment")) {
      this.applyComment(message);
      this.report(message);
      return;
    }
    if (message.kind === "history_restoring") { this.drop("board_restored"); this.history.clear(); this.report(message); return; }
    const request = this.requests.get(message.requestId);
    if (["saved", "received", "refused"].includes(message.kind) && request && !outstanding(request)) return;
    if (message.kind === "joined") {
      this.threads.clear(); this.commentsReady = false;
      const rejoined = this.accepted;
      if (rejoined) {
        this.history.clear();
        if (message.restoreGeneration !== this.restoreGeneration) this.drop("board_restored");
        else if (message.epoch !== this.epoch || message.role === "viewer") this.drop("access_changed");
      }
      this.adapter.destroy(); this.adapter = new Adapter();
      if (!rejoined && this.options.clientId !== undefined) this.adapter.doc.clientID = this.options.clientId;
      Y.applyUpdate(this.doc, decode(message.update));
      this.role = message.role; this.epoch = message.epoch; this.revision = message.revision; this.self = message.self;
      this.restoreGeneration = message.restoreGeneration;
      this.timerSnapshot = timerSnapshot(message.timer) ? message.timer : undefined;
      this.timerServerNowMs = timerInteger(message.serverNowMs) ? message.serverNowMs : undefined;
      this.retiredSpotlightAuthorities.clear();this.spotlightSnapshot=spotlightProjection(message.spotlight)?message.spotlight:undefined;
      this.votingSnapshot=voteProjection(message.voting)?message.voting:undefined;
      this.present.clear(); for (const presence of message.present) this.present.set(presence.connection, presence);
      this.joined = true; this.accepted = true;
      const board = this.board;
      this.recovery = [...this.requests].filter(([, value]) => value.state === "waiting").map(([id, value]) => {
        if (value.touched.some((object) => !board.objects.some((current) => current.id === object.id) &&
          board.retiredGenerations.includes(object.generation))) value.notKept = true;
        Y.applyUpdate(this.doc, decode(value.update));
        return id;
      });
      this.recovering = this.recovery.length > 0;
      const first = this.recovery[0];
      // Observers of joined must already see Saving, never Saved for work
      // that is about to be resent. A listener can still interrupt this send.
      if (first) this.requests.get(first)!.state = "sent";
      this.change = { origin: "reload" };
      this.report(message);
      if (this.joined && this.recovering) this.sendRequest(first);
      return;
    } else if (message.kind === "present") {
      const { kind: _kind, ...presence } = message;
      this.present.set(presence.connection, this.votingSnapshot?.session.status==='running'?{...presence,cursor:null,selection:[],view:{x:0,y:0,width:1,height:1}}:presence);
    } else if (message.kind === "left") this.present.delete(message.connection);
    else if (message.kind === "update" || message.kind === "saved") {
      if (message.kind === "saved" && !request) return;
      if (message.update) {
        const before = capture(this.doc);
        Y.applyUpdate(this.doc, decode(message.update));
        this.history.observe(before, capture(this.doc), message.kind === "saved");
        this.change = message.kind === "update" ? { origin: "remote", connection: message.connection } : { origin: "own" };
      }
      this.revision = Math.max(this.revision, message.revision);
      if (message.kind === "saved") {
        request!.state = "saved"; request!.revision = message.revision;
        this.cancelDeadline(message.requestId);
        this.report(message);
        if (this.recovering) {
          const next = this.recovery.find((id) => this.requests.get(id)!.state === "waiting");
          if (next) this.sendRequest(next);
          else {
            const requests = this.recovery.length;
            this.recovering = false; this.recovery = [];
            this.report({ kind: "recovered", requests });
          }
        }
        return;
      }
    } else if (message.kind === "received") {
      if (request && (request.state === "sent" || request.state === "received")) {
        request.state = "received"; this.deadline(message.requestId);
      }
    } else if (message.kind === "refused") {
      const reason = message.reason === "restore_changed" ? "board_restored" : ["epoch_changed", "role_too_low"].includes(message.reason) ? "access_changed" : "refused_edit";
      if (request) {
        request.state = "refused"; request.reason = message.reason; this.cancelDeadline(message.requestId);
        this.drop(reason); this.rejoin();
      }
      else if (message.requestId === undefined &&
        !["presence_too_large", "presence_fields", "presence_selection_limit", "bad_presence"].includes(message.reason)) {
        this.drop(reason); this.rejoin();
      }
    } else if (message.kind === "resync") {
      this.change = { origin: "reload" };
      const touched = [...this.requests.values()].filter(outstanding).flatMap((value) => value.touched);
      for (const [id, value] of this.requests) if (value.state === "received") {
        value.state = "dropped"; this.cancelDeadline(id);
      }
      this.sendEdit(Y.encodeStateAsUpdate(this.doc, decode(message.stateVector)), undefined, touched);
    }
    this.report(message);
  }
  private applyComment(message: any) {
    if (message.kind === "comments_snapshot") {
      if (message.reset) { this.threads.clear(); this.commentsReady = false; }
      if (message.done) this.commentsReady = true;
    } else if (message.kind === "comment_changed") {
      if (message.thread === null) this.threads.delete(message.threadId);
      else {
        const current = this.threads.get(message.threadId);
        if (message.thread) this.threads.set(message.threadId, { ...message.thread, comments: current?.comments ?? [] });
        const thread = this.threads.get(message.threadId);
        if (thread && Object.hasOwn(message, "comment")) {
          thread.comments = thread.comments.filter((comment) => comment.id !== message.commentId);
          if (message.comment) thread.comments.push(message.comment);
          thread.comments.sort((a, b) => a.sequence - b.sequence);
        }
      }
    } else if (message.kind === "comment_saved" || message.kind === "comment_refused") {
      const request = this.commentRequests.get(message.requestId);
      if (request && request.state !== "saved" && request.state !== "refused") {
        request.state = message.kind === "comment_saved" ? "saved" : "refused";
        request.reason = message.reason; request.sequence = message.sequence;
        this.cancelDeadline(message.requestId);
      }
    }
  }
  comment(operation: CommentOperation): string {
    if (!this.joined || !this.commentsReady) return "join_required";
    if ("text" in operation) {
      operation = { ...operation, text: normalizeText(operation.text) };
      const problem = textProblem(operation.text);
      if (problem) return problem;
    }
    const requestId = crypto.randomUUID();
    const text = JSON.stringify({ kind: "comment", epoch: this.epoch, requestId, operation, restoreGeneration: this.restoreGeneration });
    this.commentRequests.set(requestId, { state: "sent", text, epoch: this.epoch, restoreGeneration: this.restoreGeneration });
    this.deadline(requestId);
    this.send(text);
    this.report({ kind: "comment_request", requestId });
    return requestId;
  }
  retryComment(requestId: string): string {
    if (!this.joined || !this.commentsReady) return "join_required";
    const request = this.commentRequests.get(requestId);
    if (!request || request.state !== "unconfirmed") return "not_retryable";
    if (request.epoch !== this.epoch || request.restoreGeneration !== this.restoreGeneration) return "access_changed";
    request.state = "sent"; delete request.reason;
    this.deadline(requestId); this.send(request.text);
    this.report({ kind: "comment_request", requestId });
    return requestId;
  }
  private blocked() { return !this.joined || this.recovering ? "join_required" : this.role === "viewer" ? "role_too_low" : null; }
  edit(board: BoardV14, group?: string, movedPages?: readonly string[], page?: string, tableHint?: TableOrderHint, arrivalOf?: string): string {
    const blocked = this.blocked(); if (blocked) return blocked;
    return this.write(board, undefined, group, movedPages, page, tableHint, arrivalOf);
  }
  private write(board: BoardV14, direction?: "undo" | "redo", group?: string, movedPages?: readonly string[], page?: string, tableHint?: TableOrderHint, arrivalOf?: string) {
    const previous = this.board;
    const before = capture(this.doc), vector = Y.encodeStateVector(this.doc);
    this.adapter.set(board, movedPages, direction ? this.history.pageOrders : undefined, tableHint);
    this.change = { origin: "own" };
    const after = capture(this.doc);
    if (arrivalOf) this.history.amend(before, after, arrivalOf);
    else this.history.record(before, after, direction, group, page);
    const touched = board.objects.filter((object) => JSON.stringify(object) !==
      JSON.stringify(previous.objects.find((old) => old.id === object.id)))
      .map(({ id, generation }) => ({ id, generation }));
    return this.sendEdit(Y.encodeStateAsUpdate(this.doc, vector), group, touched, arrivalOf);
  }
  private sendEdit(update: Uint8Array, group?: string, touched: Request["touched"] = [], arrivalOf?: string) {
    const requestId = crypto.randomUUID(), encoded = encode(update);
    const text = JSON.stringify({ kind: "edit", epoch: this.epoch, requestId, update: encoded, restoreGeneration: this.restoreGeneration });
    const request: Request = { state: "sent", update: encoded, text, touched, ...(arrivalOf ? { arrivalOf } : {}), ...(group ? { group } : {}) };
    this.requests.set(requestId, request);
    if (sizeOf(text) > 1048576) {
      request.state = "refused"; request.reason = "message_too_large";
      this.drop("refused_edit");
      this.rejoin(); this.report({ kind: "refused", requestId, reason: "message_too_large" });
    } else this.sendRequest(requestId);
    return requestId;
  }
  private deadline(id: string) {
    this.cancelDeadline(id);
    const generation = this.generation;
    this.deadlines.set(id, this.options.clock.after(10000, () => {
      if (generation === this.generation && !this.ended) {
        this.endAttempt({ kind: "close", code: 4000, reason: "answer_deadline" });
      }
    }));
  }
  private send(text: string) {
    try { this.transport!.send(text); return true; }
    catch { this.endAttempt({ kind: "close", code: 1006 }); return false; }
  }
  private sendRequest(id: string) {
    const request = this.requests.get(id)!;
    request.state = "sent"; this.deadline(id);
    this.send(request.text!);
  }
  private inverse(direction: "undo" | "redo") {
    const blocked = this.blocked(); if (blocked) return blocked;
    const board = this.history.take(capture(this.doc), direction);
    return typeof board === "string" ? board : this.write(board, direction, undefined, undefined, this.history.page, this.history.tableHint);
  }
  undo() { return this.inverse("undo"); }
  redo() { return this.inverse("redo"); }
  setPresence(input: PresenceInput): string | null {
    if (!this.joined) return "join_required";
    const checked = checkPresence(input, sizeOf(JSON.stringify({ kind: "presence", ...input })));
    if (typeof checked === "string") { this.report({ kind: "refused", reason: checked }); return checked; }
    this.heldPresence = checked;
    const now = this.options.clock.now();
    this.presenceTimes = this.presenceTimes.filter(at => at > now - 1000);
    const pageChanged = checked.page !== this.lastPresence?.page;
    const delay = Math.max(pageChanged ? 0 : this.lastSent + 100 - now,
      this.presenceTimes.length >= 10 ? this.presenceTimes[0] + 1000 - now : 0);
    this.cancelTrailing?.(); this.cancelTrailing = undefined;
    if (delay <= 0) this.flushPresence();
    else this.cancelTrailing = this.options.clock.after(delay, () => this.flushPresence());
    return null;
  }
  private flushPresence() {
    this.cancelTrailing?.(); this.cancelTrailing = undefined;
    const input = this.heldPresence ?? this.lastPresence;
    if (!this.joined || !input) return;
    const now = this.options.clock.now();
    this.presenceTimes = this.presenceTimes.filter(at => at > now - 1000);
    if (this.presenceTimes.length >= 10) { this.cancelTrailing = this.options.clock.after(this.presenceTimes[0] + 1000 - now, () => this.flushPresence()); return; }
    this.presenceTimes.push(now);
    this.heldPresence = undefined; this.lastPresence = input; this.lastSent = now;
    if (!this.send(JSON.stringify({ kind: "presence", ...input }))) return;
    this.cancelHeartbeat?.();
    this.cancelHeartbeat = this.options.clock.after(15000, () => this.flushPresence());
  }
  unavailable() {
    if (this.ended) return;
    this.endAttempt(undefined,false); this.ended = true;
    this.requests.clear(); this.commentRequests.clear(); this.threads.clear();
    this.history.clear(); this.present.clear(); this.role = undefined; this.self = undefined;
    this.adapter.destroy(); this.adapter = new Adapter();
    this.epoch = 0; this.restoreGeneration = 0; this.revision = 0;
  }
  close() {
    if (this.ended) return;
    this.drop("session_ended"); this.history.clear(); this.endAttempt(undefined,false);
    this.ended = true; this.adapter.destroy();
  }
}
