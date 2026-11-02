// SPDX-License-Identifier: Apache-2.0
import { clampView, type View } from "../view.ts";

export type PresenceInput = {
  cursor: { x: number; y: number } | null;
  selection: string[];
  view: { x: number; y: number; width: number; height: number };
  active: boolean;
};
export type Presence = PresenceInput & {
  connection: string; person: string; label: string;
  role: "owner" | "editor" | "viewer"; colour: string;
};
export type Person = { person: string; first: Presence; connections: Presence[]; own: boolean };
type Size = { w: number; h: number };

export const SHOW_CURSORS_KEY = "nextphase-board/presence/show-cursors/v1";

// Map insertion order is the order connections were first learnt of, not the
// order of their latest messages. Removing the first naturally promotes the next.
export function groupPeople(self: Presence | undefined, others: readonly Presence[]): Person[] {
  const people = new Map<string, Person>();
  for (const connection of self ? [self, ...others] : others) {
    let person = people.get(connection.person);
    if (!person) {
      person = { person: connection.person, first: connection, connections: [], own: connection.person === self?.person };
      people.set(connection.person, person);
    }
    person.connections.push(connection);
  }
  return [...people.values()];
}

export function avatarPeople(people: readonly Person[], width: number) {
  const shown = people.slice(0, width < 768 ? 1 : 3);
  return { shown, overflow: people.length - shown.length };
}

export function pillWords(presence: Pick<Presence, "label" | "role">): string {
  return presence.label + (presence.role === "viewer" ? " · viewer" : "");
}

export function cutSelection(selection: Iterable<string>): string[] {
  return [...selection].slice(0, 250);
}

const coordinate = (value: number) => Math.max(-1e6, Math.min(1e6, value));
export function presenceToSend(
  cursor: PresenceInput["cursor"], selection: Iterable<string>, view: View, size: Size, active: boolean,
): PresenceInput {
  return {
    cursor: cursor ? { x: coordinate(cursor.x), y: coordinate(cursor.y) } : null,
    selection: cutSelection(selection),
    view: {
      x: coordinate(view.x - size.w / view.z / 2),
      y: coordinate(view.y - size.h / view.z / 2),
      width: Math.min(1e6, size.w / view.z),
      height: Math.min(1e6, size.h / view.z),
    },
    active,
  };
}

export function chooseFollow(connections: readonly Presence[], received: ReadonlyMap<string, number>): Presence | undefined {
  const active = connections.filter((connection) => connection.active);
  return (active.length ? active : connections).reduce<Presence | undefined>((latest, connection) =>
    !latest || (received.get(connection.connection) ?? 0) > (received.get(latest.connection) ?? 0)
      ? connection : latest, undefined);
}

export function fitFollow(view: PresenceInput["view"], size: Size): View {
  return clampView({ x: view.x + view.width / 2, y: view.y + view.height / 2,
    z: Math.min(size.w / view.width, size.h / view.height) });
}

export function isPresenceRefusal(event: { reason?: unknown; requestId?: unknown }): boolean {
  return event.requestId === undefined && ["presence_too_large", "presence_fields", "presence_selection_limit", "bad_presence"]
    .includes(String(event.reason));
}
