// SPDX-License-Identifier: Apache-2.0
import { readHostedBoardLink } from "../page-links.ts";

export type TeamLink = { kind: "local" | "bad" } | { kind: "board"; board: string; page?: string; object?: string }
  | { kind: "home"; workspace?: string }
  | { kind: "trash"; workspace: string }
  | { kind: "invite"; invitation: string; board?: string };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const trashPattern = new RegExp(`^#/files/(${uuid})/trash$`);
const homePattern = new RegExp(`^#/files(?:/(${uuid}))?$`);
const invitationPattern = new RegExp(`^#/invite/(${uuid})(?:\\?board=(${uuid}))?$`);

export function parseLink(fragment: string): TeamLink {
  const trash = trashPattern.exec(fragment);
  if (trash) return { kind: "trash", workspace: trash[1] };
  const home = homePattern.exec(fragment);
  if (home) return { kind: "home", workspace: home[1] };
  const board = readHostedBoardLink(fragment);
  if (board) return { kind: "board", ...board };
  const invitation = invitationPattern.exec(fragment);
  if (invitation) return { kind: "invite", invitation: invitation[1], board: invitation[2] };
  return { kind: fragment.startsWith("#/") ? "bad" : "local" };
}
function page(address: string) {
  const url = new URL(address);
  return url.origin + url.pathname;
}
export const boardLink = (address: string, board: string) => page(address) + "#/b/" + board;
export const invitationLink = (address: string, invitation: string, board: string) =>
  page(address) + "#/invite/" + invitation + "?board=" + board;
