// SPDX-License-Identifier: Apache-2.0
import { checkPresence, type Presence, type PresenceInput } from "nextphase-board-sync/session.ts";
import type { RoomEnvironment } from "./interfaces.ts";
import { bytes, RoomError, send, type Attachment, type Connection } from "./protocol.ts";

export const colours = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#4f46e5"];
export const placeholder = (): PresenceInput => ({ cursor: null, selection: [],
  view: { x: 0, y: 0, width: 1, height: 1 }, active: false });
export function currentAttachment(value: Attachment) {
  return typeof value.label === "string" && Number.isSafeInteger(value.ordinal) &&
    Object.hasOwn(value, "presence") && typeof value.presenceAt === "number" && Array.isArray(value.presenceTimes);
}
export function endPresence(connection: Connection, peers: Connection[]) {
  const value = connection.attachment();
  if (!value.presence) return;
  connection.attach({ ...value, presence: null });
  for (const peer of peers) if (peer.attachment().connectionId !== value.connectionId) {
    send(peer, { kind: "left", connection: value.connectionId });
  }
}

export class Presences {
  env: RoomEnvironment;
  board: string;
  private holds = new Map<string, { until: number; ordinal: number }>();
  constructor(env: RoomEnvironment, board: string) { this.env = env; this.board = board; }
  prune() {
    for (const [id, hold] of this.holds) if (hold.until <= this.env.now()) this.holds.delete(id);
  }
  deadlines() { this.prune(); return [...this.holds.values()].map((hold) => hold.until); }
  async reserve(person: Omit<Attachment, "connectionId" | "epoch" | "role">, role: Attachment["role"], epoch: number): Promise<Attachment> {
    this.prune();
    const peers = this.env.connections();
    if (peers.length + this.holds.size >= 50) throw new RoomError(429, "room_full");
    const ordinal = Math.max(-1, ...peers.map((peer) => peer.attachment().ordinal ?? -1),
      ...[...this.holds.values()].map((hold) => hold.ordinal)) + 1;
    const connectionId = this.env.randomId();
    this.holds.set(connectionId, { until: this.env.now() + 5000, ordinal });
    const key = (await this.env.hash(bytes(`presence:${this.board}:${person.id}`))).slice(0, 32);
    const presence: Presence = { ...placeholder(), connection: connectionId, person: key,
      label: person.label!, role, colour: colours[ordinal % colours.length] };
    return { id: person.id, expiresAt: person.expiresAt, label: person.label, role, epoch, connectionId,
      ordinal, presence, presenceAt: this.env.now(), presenceTimes: [] };
  }
  open(connection: Connection): boolean {
    this.prune();
    const value = connection.attachment();
    const held = this.holds.delete(value.connectionId);
    const others = this.env.connections().filter((peer) => peer.attachment().connectionId !== value.connectionId);
    if (!held && others.length + this.holds.size >= 50) {
      connection.attach({ ...value, presence: null });
      connection.close(1013); return false;
    }
    connection.attach({ ...value, presenceAt: this.env.now() });
    return true;
  }
  list(except: string) {
    return this.env.connections().filter((peer) => peer.attachment().connectionId !== except)
      .map((peer) => peer.attachment().presence).filter((value): value is Presence => !!value);
  }
  relay(connection: Connection) {
    const presence = connection.attachment().presence;
    if (!presence) return;
    for (const peer of this.env.connections()) if (peer.attachment().connectionId !== presence.connection) {
      send(peer, { kind: "present", ...presence });
    }
  }
  receive(connection: Connection, message: unknown, size: number) {
    const value = connection.attachment(), now = this.env.now();
    const times = (value.presenceTimes ?? []).filter((at) => at > now - 1000);
    if (times.length >= 10) return;
    times.push(now);
    connection.attach({ ...value, presenceTimes: times });
    const result = checkPresence(message, size, true);
    if (typeof result === "string") { send(connection, { kind: "refused", reason: result }); return; }
    // Stamps survive expiry as attachment fields; the key can be derived again
    // from the retained board/person IDs without keeping the email.
    return this.accept(connection, result, now);
  }
  private async accept(connection: Connection, input: PresenceInput, now: number) {
    const value = connection.attachment();
    const person = value.presence?.person ?? (await this.env.hash(bytes(`presence:${this.board}:${value.id}`))).slice(0, 32);
    connection.attach({ ...value, presenceAt: now, presence: { ...input, person,
      connection: value.connectionId, label: value.label!, role: value.role, colour: colours[value.ordinal! % 8] } });
    this.relay(connection);
  }
  expire() {
    this.prune();
    for (const peer of this.env.connections()) if (peer.attachment().presence &&
      peer.attachment().presenceAt! + 30000 <= this.env.now()) endPresence(peer, this.env.connections());
  }
}
