// SPDX-License-Identifier: Apache-2.0
import type { RoomEnvironment } from "./interfaces.ts";
import { bytes, RoomError, type Person } from "./protocol.ts";
export function labelOf(email: string): string {
  const at = email.lastIndexOf("@");
  const label = at < 0 ? email : email.slice(0, at);
  if (!label || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(label) || bytes(label).length > 256) throw new RoomError(400, "invalid_label");
  return label;
}
export async function issueTicket(env: RoomEnvironment, person: Person) {
  const label = labelOf(person.email);
  const ticket = env.randomTicket();
  const expiresAt = env.now() + 30000;
  env.storage.exec("DELETE FROM tickets WHERE expires_at <= ?", env.now());
  env.storage.exec("INSERT INTO tickets VALUES (?, ?, ?, ?, ?)", await env.hash(bytes(ticket)), person.id, person.expiresAt, expiresAt, label);
  return { ticket, expiresAt };
}
export async function consumeTicket(env: RoomEnvironment, ticket: string): Promise<Omit<Person, "email"> & { label: string }> {
  const digest = await env.hash(bytes(ticket));
  const row = env.storage.all("SELECT * FROM tickets WHERE digest = ?", digest)[0];
  env.storage.exec("DELETE FROM tickets WHERE digest = ? OR expires_at <= ?", digest, env.now());
  if (!row || Number(row.expires_at) <= env.now() || Number(row.token_expires_at) <= env.now()) {
    throw new RoomError(401, "ticket_invalid");
  }
  return { id: String(row.person_id), label: String(row.label), expiresAt: Number(row.token_expires_at) };
}
