// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { boardLink, invitationLink } from "./links";
import { roleSource, roleWords, pendingInvitation, expiresInDays,
  type Member, type Grant, type Invitation, type Role } from "./roles";
import { words, shareError } from "./notices";
import { TeamDialog } from "./dialog";
import type { HostedBoard } from "./hosted-board";

type Lists = { members: Member[]; grants: Grant[]; invitations: Invitation[] };
function RoleMenu({ shown, current, workspace, busy, change }: {
  shown: Role; current: Role; workspace: boolean; busy: boolean; change: (role: Role | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const control = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  return <div className="team-role" ref={control} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus(); }
  }}>
    <button ref={button} disabled={busy} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen(!open)}>{roleWords(shown)} ⌄</button>
    {open && <div role="menu" aria-label="Change access">
      {(["editor", "viewer", ...(workspace ? ["guest"] : [])] as Role[]).map((role) =>
        <button key={role} role="menuitemradio" aria-checked={current === role} disabled={busy}
          onClick={() => { setOpen(false); change(role); }}>{current === role ? "✓ " : ""}{roleWords(role)}</button>)}
      <hr /><button className="team-remove" role="menuitem" disabled={busy}
        onClick={() => { setOpen(false); change(null); }}>Remove</button>
    </div>}
  </div>;
}
function Person({ email, own, detail, children }: {
  email: string; own: boolean; detail?: string; children: React.ReactNode;
}) {
  return <div className="team-person">
    <span className="team-avatar" aria-hidden="true">{email[0]?.toUpperCase()}</span>
    <span><strong>{email.slice(0, email.lastIndexOf("@"))}{own ? " (you)" : ""}</strong>
      <small>{email}{detail ? " · " + detail : ""}</small></span>{children}
  </div>;
}
export function ShareDialog({ hosted, email, personId, close }: {
  hosted: HostedBoard; email: string; personId: string; close: () => void;
}) {
  const { workspace, workspaceId, role } = hosted.snapshot;
  const owner = role === "owner";
  const [workspaceView, setWorkspaceView] = useState(false);
  const [lists, setLists] = useState<Lists>({ members: [], grants: [], invitations: [] });
  const [inviteEmail, setInviteEmail] = useState(""), [inviteRole, setInviteRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [fallback, setFallback] = useState(""), [copied, setCopied] = useState("");
  const alive = useRef(true), running = useRef(false), readSequence = useRef(0);
  const prefix = `/workspaces/${workspaceId}`;
  function showError(error: unknown) {
    if (!alive.current) return;
    const failure = error instanceof ApiError ? error : new ApiError(0, "no_answer");
    setError(shareError(failure, workspace));
    if (failure.status === 401) hosted.expire();
  }
  async function readLists() {
    const sequence = ++readSequence.current;
    try {
      const [members, grants, invitations] = await Promise.all([
        api<{ members: Member[] }>(prefix + "/members"),
        api<{ grants: Grant[] }>(prefix + "/grants"),
        api<{ invitations: Invitation[] }>(prefix + "/invitations"),
      ]);
      if (alive.current && sequence === readSequence.current) setLists({ ...members, ...grants, ...invitations });
    } catch (error) { showError(error); }
  }
  useEffect(() => {
    alive.current = true;
    if (owner) void readLists();
    return () => { alive.current = false; };
  }, []);
  const pending = [...lists.members, ...lists.grants].some((row) => row.removal === "pending");
  useEffect(() => {
    if (!owner || !pending) return;
    const timer = setInterval(() => { void readLists(); }, 2500);
    return () => clearInterval(timer);
  }, [owner, pending]);
  async function copy(link: string, invitation?: Invitation) {
    try {
      await navigator.clipboard.writeText(link);
      if (!alive.current) return;
      setFallback(""); setCopied(invitation?.id ?? "");
      hosted.toast(invitation ? words.invitationCopied(invitation.email) : words.boardCopied);
    } catch {
      if (alive.current) { setError(words.copyFailed); setFallback(link); }
    }
  }
  async function mutate(run: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { await run(); }
    catch (error) { showError(error); }
    finally {
      // An unanswered mutation may already have committed. Read once, never
      // repeat the mutation; preserve the previous rows if that read fails.
      running.current = false;
      if (alive.current) setBusy(false);
      await readLists();
    }
  }
  function invite() {
    const value = inviteEmail.trim();
    if (!value) return;
    void mutate(async () => {
      const path = workspaceView ? prefix : `/boards/${hosted.boardId}`;
      const invitation = await api<Invitation>(path + "/invitations", "POST", { email: value, role: inviteRole });
      if (!alive.current) return;
      setInviteEmail(""); setInviteRole("editor");
      await copy(invitationLink(location.href, invitation.id, hosted.boardId), invitation);
      if (invitation.accountCreated === false) setError(words.accountFailed(value));
    });
  }
  function change(personId: string, role: Role | null) {
    void mutate(async () => {
      const path = workspaceView ? `${prefix}/members/${personId}` : `/boards/${hosted.boardId}/grants/${personId}`;
      const reply = await api<{ removal: string }>(path, role === null ? "DELETE" : "PUT", role === null ? undefined : { role });
      if (alive.current) hosted.toast(reply.removal === "pending" ? words.pending : words.updated);
    });
  }
  function row(member: Member, grant?: Grant) {
    const current = grant ?? member;
    const effective = grant ? roleSource(member.role, grant.role).role : member.role;
    const detail = current.role === null ? words.removing : grant ? words.grantSource(member.role, workspace)
      : member.role === "guest" ? words.guest : undefined;
    return <Person key={current.personId} email={current.email} own={current.personId === personId} detail={detail}>
      {current.role && (effective === "owner" ? <span>owner</span> : <RoleMenu shown={effective ?? current.role}
        current={current.role} workspace={workspaceView} busy={busy} change={(role) => change(current.personId, role)} />)}
    </Person>;
  }
  const invitations = lists.invitations.filter((invitation) => pendingInvitation(invitation) &&
    (workspaceView ? invitation.boardId === null : invitation.boardId === hosted.boardId));
  const inviteLabel = workspaceView ? words.workspaceInvite(workspace) : words.boardInvite;
  const title = workspaceView ? words.workspaceTitle(workspace) : words.shareTitle;
  return <TeamDialog title={title} className="team-share" close={close}
    escape={() => { if (!workspaceView) return false; setWorkspaceView(false); setInviteEmail(""); return true; }}>
    <header>
      {workspaceView && <button aria-label="Back to board access" onClick={() => { setWorkspaceView(false); setInviteEmail(""); }}>‹</button>}
      <h1>{title}</h1>
      {!workspaceView && <button aria-label="Copy link" onClick={() => { void copy(boardLink(location.href, hosted.boardId)); }}>↗ Copy link</button>}
      <button aria-label="Close sharing" onClick={close}>×</button>
    </header>
    {owner ? <>
      {workspaceView && <p>{words.workspaceHelper(workspace)}</p>}
      <form className="team-invite" onSubmit={(event) => { event.preventDefault(); invite(); }}>
        <span><input type="email" aria-label={inviteLabel} placeholder={inviteLabel} value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)} disabled={busy} />
          {inviteEmail && <select aria-label="Invitation role" value={inviteRole} disabled={busy}
            onChange={(event) => setInviteRole(event.target.value as Role)}>
            <option value="editor">can edit</option><option value="viewer">can view</option>
          </select>}</span>
        <button className="primary" disabled={busy || !inviteEmail.trim()}>Invite</button>
      </form>
      <h2>{workspaceView ? "Members" : "Who has access"}</h2>
      {workspaceView ? lists.members.map((member) => row(member)) : <>
        <button className="team-workspace" onClick={() => { setWorkspaceView(true); setInviteEmail(""); }}>
          <span aria-hidden="true">▦</span><span>{words.workspaceTitle(workspace)}<small>{words.workspaceRow}</small></span><span>can access ›</span>
        </button>
        {lists.members.filter((member) => member.role === "owner").map((member) => row(member))}
        {lists.grants.filter((grant) => grant.boardId === hosted.boardId).map((grant) => row(
          lists.members.find((member) => member.personId === grant.personId) ?? { ...grant, role: "guest" }, grant))}
      </>}
      {invitations.length > 0 && <><h2>Invited</h2>{invitations.map((invitation) => <div className="team-person" key={invitation.id}>
        <span aria-hidden="true">✉</span><span>{invitation.email}<small>{words.invited(workspaceView ? "workspace" : "board",
          roleWords(invitation.role), expiresInDays(invitation.expiresAt))}</small></span>
        <button onClick={() => { void copy(invitationLink(location.href, invitation.id, hosted.boardId), invitation); }}>
          {copied === invitation.id ? "✓ Link copied" : "Copy link"}</button>
        <button disabled={busy} onClick={() => { void mutate(async () => { await api(`/invitations/${invitation.id}`, "DELETE"); }); }}>Cancel</button>
      </div>)}</>}
      {!workspaceView && <><hr /><p>{words.shareFooter(workspace)}</p></>}
    </> : <>
      <Person email={email} own={true}><span>{roleWords(role ?? "viewer")}</span></Person>
      <hr /><p>{words.ownerOnly(workspace)}</p>
    </>}
    {error && <p role="alert">{error}</p>}
    {fallback && <input aria-label="Link to copy" readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} />}
  </TeamDialog>;
}
