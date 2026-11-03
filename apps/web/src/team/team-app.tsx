// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type ReactNode } from "react";
import { App } from "../App";
import { auth, type AuthSession } from "./auth";
import { HostedBoard } from "./hosted-board";
import { People } from "./people";
import { PresenceLayer } from "./presence-layer";
import { parseLink, type TeamLink } from "./links";
import { words } from "./notices";
import { SignIn } from "./sign-in";
import { ShareDialog } from "./share-dialog";
import { EndBoardDialog, TeamPage } from "./pages";
import { Home } from "./home";
import { holdName, type HeldNames } from "./home-rules";

export type TeamParts = {
  hosted?: HostedBoard; saveControl?: ReactNode; account?: ReactNode; banner?: ReactNode;
  people?: ReactNode; presenceLayer?: typeof PresenceLayer; backToFiles?: () => void;
  nameSent?: (title: string) => void;
};
export function TeamApp() {
  const [fragment, setFragment] = useState(location.hash);
  const [session, setSession] = useState<AuthSession | null>(null), [ready, setReady] = useState(false);
  const [signIn, setSignIn] = useState(false), [epoch, setEpoch] = useState(0);
  const [forceGate, setForceGate] = useState(false);
  const active = useRef<HostedBoard | null>(null), ownSignOut = useRef(false);
  const names = useRef<HeldNames>(new Map());
  useEffect(() => {
    const change = () => { active.current?.stop(); active.current = null; setForceGate(false); setFragment(location.hash); };
    window.addEventListener("hashchange", change);
    const { data } = auth.onAuthStateChange((event, next) => {
      // Auth holds its lock in this callback. Session work runs after it returns.
      queueMicrotask(() => {
        setSession(next); setReady(true);
        if (event === "SIGNED_OUT") {
          names.current.clear();
          if (!ownSignOut.current) active.current?.signedOut();
        } else active.current?.updateSession(next);
      });
    });
    return () => { window.removeEventListener("hashchange", change); data.subscription.unsubscribe(); active.current?.stop(); };
  }, []);
  async function signOut(local = false) {
    ownSignOut.current = true;
    names.current.clear();
    active.current?.stop(); active.current = null;
    setForceGate(local); setSession(null); setEpoch((value) => value + 1);
    try { await auth.signOut(local ? { scope: "local" } : undefined); }
    finally { ownSignOut.current = false; }
  }
  const link = parseLink(fragment);
  const closeBoard = () => { active.current?.stop(); active.current = null; location.hash = "#/files"; };
  const account = session ? <div className="team-account">{words.signedInAs(session.user.email ?? "")}
    <button onClick={() => { void signOut(); }}>Sign out</button></div> : undefined;
  if (link.kind === "home") {
    if (!ready) return <main className="team-page"><span role="status">Loading boards…</span></main>;
    if (!session) return <SignIn gate home close={() => {}} />;
    return <Home key={fragment + epoch} workspaceId={link.workspace} email={session.user.email ?? ""}
      names={names.current} signOut={() => { void signOut(); }} />;
  }
  if (link.kind !== "local") {
    if (!ready) return <TeamPage outcome={null} close={closeBoard} signIn={() => {}} />;
    return <HostedRoute key={fragment + epoch} forceGate={forceGate} link={link} session={session} active={active} account={account}
      names={names.current} close={closeBoard} signInAgain={() => { void signOut(true); }} restart={() => { setForceGate(false); setEpoch((value) => value + 1); }} />;
  }
  return <><App key={fragment} team={{ account, backToFiles: session ? closeBoard : undefined, saveControl: !session
    ? <button onClick={() => setSignIn(true)}>Sign in</button> : undefined }} />
    {signIn && <SignIn close={() => setSignIn(false)} />}</>;
}
function HostedRoute({ link, session, active, account, close, signInAgain, restart, forceGate, names }: {
  forceGate: boolean; link: TeamLink; session: AuthSession | null; active: React.RefObject<HostedBoard | null>;
  account: ReactNode; close: () => void; signInAgain: () => void; restart: () => void; names: HeldNames;
}) {
  const hosted = useRef<HostedBoard | null>(null), unsubscribe = useRef<(() => void) | undefined>(undefined);
  // Record names actually sent by this tab, not remote titles seen while an edit is pending.
  const sentTitles = useRef(new Set<string>());
  const [, redraw] = useState(0), [share, setShare] = useState(false), [toast, setToast] = useState("");
  useEffect(() => {
    if (!session || hosted.current || forceGate || link.kind === "bad") return;
    // An invitation with no destination still opens the local board.
    const board = new HostedBoard(link, () => { location.hash = ""; });
    hosted.current = board; active.current = board;
    let savedTitle: string | undefined;
    unsubscribe.current = board.subscribe(() => {
      const title = board.snapshot.board?.title;
      if (title !== undefined) {
        if (savedTitle === undefined) savedTitle = title; // The first joined title.
        if (board.status === "Saved") {
          if (title !== savedTitle) holdName(names, board.boardId, title, [savedTitle, ...sentTitles.current]);
          savedTitle = title; sentTitles.current.clear();
        }
      }
      redraw((value) => value + 1);
    });
    board.updateSession(session); board.start();
    redraw((value) => value + 1);
  }, [session?.user.id]);
  useEffect(() => () => { unsubscribe.current?.(); hosted.current?.stop(); }, []);
  const board = hosted.current, snapshot = board?.snapshot;
  useEffect(() => {
    setToast(snapshot?.toast ?? "");
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [snapshot?.toastId]);
  if (forceGate) return <SignIn gate close={restart} />;
  if (link.kind === "bad") return <TeamPage outcome={{ name: "notFound", retry: false }} close={close} signIn={signInAgain} />;
  const outcome = snapshot?.outcome ?? null;
  const ending = outcome && ["expired", "signedOut", "accessRemoved"].includes(outcome.name);
  if ((!session && !snapshot?.board) || outcome?.name === "expired" && !snapshot?.board) {
    return <SignIn gate close={restart} notice={outcome?.name === "expired" ? words.expired : outcome?.name === "signedOut" ? words.signedOut : ""} />;
  }
  const replacesBoard = outcome && ["notFound", "cantJoin", "disabled", "full"].includes(outcome.name);
  if (!board || !snapshot?.board || replacesBoard) return <TeamPage outcome={outcome} close={close} signIn={signInAgain} />;
  const banner = !snapshot.connected ? outcome?.name === "restoring" ? words.restoring : words.reconnecting
    : snapshot.role === "viewer" ? words.viewOnly(snapshot.workspace) : "";
  return <><App team={{ hosted: board, account, backToFiles: session ? close : undefined, people: <People hosted={board} />, presenceLayer: PresenceLayer,
    nameSent: (title) => { sentTitles.current.add(title); },
    saveControl: <button className="primary" onClick={() => setShare(true)}>Share</button>,
    banner: banner ? <div className={"team-banner" + (!snapshot.connected ? " team-amber" : "")} role="status">{banner}</div> : undefined }} />
    {toast && <div className="team-toast" role="status">{toast}</div>}
    {share && !ending && <ShareDialog hosted={board} email={session?.user.email ?? ""} personId={session?.user.id ?? ""} close={() => setShare(false)} />}
    {ending && <EndBoardDialog outcome={outcome} workspace={snapshot.workspace} close={close} signIn={signInAgain} />}
  </>;
}
