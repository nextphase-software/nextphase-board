// SPDX-License-Identifier: Apache-2.0
export type Role = "owner" | "editor" | "viewer" | "guest";
export type Member = { personId: string; email: string; role: Role | null; removal: "done" | "pending" };
export type Grant = Member & { boardId: string; role: "editor" | "viewer" | null };
export type Invitation = { id: string; boardId: string | null; email: string; role: Role;
  expiresAt: string; acceptedAt?: string | null; cancelledAt?: string | null; accountCreated?: boolean };
export const roleWords = (role: Role) => ({ owner: "owner", editor: "can edit", viewer: "can view", guest: "guest" })[role];

export function roleSource(workspace: Role | null, grant: "editor" | "viewer" | null) {
  const inherited = workspace === "guest" ? null : workspace;
  const rank = { owner: 3, editor: 2, viewer: 1 };
  const role = inherited && (!grant || rank[inherited] >= rank[grant]) ? inherited : grant;
  const source = inherited && grant ? "both" : inherited ? "workspace" : grant ? "this board" : "none";
  return { role, source };
}
export const pendingInvitation = (invitation: Invitation, now = Date.now()) =>
  !invitation.acceptedAt && !invitation.cancelledAt && Date.parse(invitation.expiresAt) > now;
export const expiresInDays = (expiresAt: string, now = Date.now()) =>
  Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 86400000));
