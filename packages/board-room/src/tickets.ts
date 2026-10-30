// SPDX-License-Identifier: Apache-2.0
import type { RoomEnvironment } from "./interfaces.ts";
import { bytes, RoomError, type Person } from "./protocol.ts";
export async function issueTicket(env: RoomEnvironment, person: Person) {
  const ticket = env.randomTicket();
  const expiresAt = env.now() + 30000;
  env.storage.exec("DELETE FROM tickets WHERE expires_at <= ?", env.now());
  env.storage.exec("INSERT INTO tickets VALUES (?, ?, ?, ?)", await env.hash(bytes(ticket)), person.id, person.expiresAt, expiresAt);
  return { ticket, expiresAt };
}
export async function consumeTicket(env: RoomEnvironment, ticket: string): Promise<Person> {
  const digest = await env.hash(bytes(ticket));
  const row = env.storage.all("SELECT * FROM tickets WHERE digest = ?", digest)[0];
  env.storage.exec("DELETE FROM tickets WHERE digest = ? OR expires_at <= ?", digest, env.now());
  if (!row || Number(row.expires_at) <= env.now() || Number(row.token_expires_at) <= env.now()) {
    throw new RoomError(401, "ticket_invalid");
  }
  return { id: String(row.person_id), email: "", expiresAt: Number(row.token_expires_at) };
}
