// SPDX-License-Identifier: Apache-2.0
export type TeamLink = { kind: "local" | "bad" } | { kind: "board"; board: string }
  | { kind: "home"; workspace?: string }
  | { kind: "invite"; invitation: string; board?: string };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const boardPattern = new RegExp(`^#/b/(${uuid})$`);
const homePattern = new RegExp(`^#/files(?:/(${uuid}))?$`);
const invitationPattern = new RegExp(`^#/invite/(${uuid})(?:\\?board=(${uuid}))?$`);

export function parseLink(fragment: string): TeamLink {
  const home = homePattern.exec(fragment);
  if (home) return { kind: "home", workspace: home[1] };
  const board = boardPattern.exec(fragment);
  if (board) return { kind: "board", board: board[1] };
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
