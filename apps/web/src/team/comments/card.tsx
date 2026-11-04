// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { HostedBoard } from "../hosted-board";
import { TeamDialog } from "../dialog";
import { CommentIcon } from "./icons";
import { authorColour, deleteBody, detachedWords, lengthWords, normalizeText, refusalWords, requestNote,
  textLength, textProblem, timeWords, words, type CommentOperation, type CommentThread } from "./rules";

export type Draft = { text: string; request?: string; note?: string };
export function CommentField({ hosted, draft, change, operation, saved, cancel, label = "Reply", edit = false, locked = false }: {
  hosted: HostedBoard; draft: Draft; change: (draft: Draft) => void; operation: () => CommentOperation;
  saved: () => void; cancel?: () => void; label?: string; edit?: boolean; locked?: boolean;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const request = draft.request ? hosted.comments.requests?.get(draft.request) : undefined;
  const pending = request?.state === "sent" || request?.state === "unconfirmed";
  const gone = ["thread_deleted", "comment_deleted"].includes(request?.reason ?? "");
  const readOnly = locked || !!pending || gone;
  const length = textLength(normalizeText(draft.text));
  const note = draft.note ? { text: draft.note, tone: "error", role: "alert" as const }
    : requestNote(request, hosted.comments.ready, operation().action);
  useLayoutEffect(() => {
    const node = field.current;
    if (node) { node.style.height = "0px"; node.style.height = Math.min(120, Math.max(24, node.scrollHeight)) + "px"; }
  }, [draft.text]);
  useEffect(() => {
    if (request?.state === "saved") { change({ text: "" }); saved(); }
  }, [request?.state, draft.request]);
  function post() {
    if (readOnly || !hosted.comments.ready || textProblem(normalizeText(draft.text))) return;
    const request = hosted.comment(operation());
    change(hosted.comments.requests?.has(request) ? { text: normalizeText(draft.text), request } : { ...draft, note: refusalWords(request) });
  }
  const input = <textarea ref={field} rows={1} autoFocus aria-label={label} placeholder={label === "Unposted edit" ? undefined : label}
    className={edit ? "comment-edit-field" : ""} value={draft.text} readOnly={readOnly}
    onChange={(event) => change({ text: event.target.value })}
    onKeyDown={(event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); post(); }
    }} />;
  return <>
    {edit ? input : <div className={label === "Add a comment" ? "comment-composer-row" : "comment-reply"}>{input}
      <button className="comment-post" aria-label="Post" disabled={readOnly || !hosted.comments.ready || !!textProblem(normalizeText(draft.text))} onClick={post}>
        <CommentIcon name="send" />
      </button></div>}
    {edit && label !== "Unposted edit" && <div className="comment-edit-actions">
      {cancel && <button onClick={cancel}>Cancel</button>}
      <button className="primary" disabled={readOnly || !hosted.comments.ready || !!textProblem(normalizeText(draft.text))} onClick={post}>Save</button>
    </div>}
    {length > 4000 && <div className="comment-length" role="status">{lengthWords(length)}</div>}
    {note && !locked && <div className={"comment-note " + note.tone} role={note.role}>{note.text}
      {request?.state === "unconfirmed" && hosted.comments.ready && <button onClick={() => {
        const result = hosted.retryComment(draft.request!);
        if (result !== draft.request) change({ text: draft.text, note: words.notRetryable });
      }}>Retry</button>}
    </div>}
  </>;
}
export function CommentMenu({ opener, close, items, style }: {
  opener: HTMLElement; close: () => void; items: { label: string; run: () => void; checked?: boolean }[]; style: CSSProperties;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { menu.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !opener.contains(event.target as Node)) close(); };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, []);
  return <div ref={menu} className="comment-menu" role="menu" style={style} onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); close(); opener.focus(); return; }
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.current!.querySelectorAll("button")], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
  }}>
    {items.map((item) => <button key={item.label} role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={item.checked} onClick={() => { close(); item.run(); }}>
      {item.checked !== undefined && <span className="comment-tick">{item.checked ? "✓" : ""}</span>}{item.label}
    </button>)}
  </div>;
}
export function CommentCard({ hosted, thread, exists, deletedBy, resolvedBy, style, close, action }: {
  hosted: HostedBoard; thread: CommentThread; exists: boolean; deletedBy?: string; resolvedBy?: string;
  style: CSSProperties; close: () => void; action: (operation: CommentOperation, resolved?: boolean) => void;
}) {
  const [reply, setReply] = useState<Draft>({ text: "" });
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [menu, setMenu] = useState<{ id: string; opener: HTMLElement; top: number } | null>(null);
  const [question, setQuestion] = useState<{ commentId?: string; thread: boolean } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const own = thread.person === hosted.comments.person;
  const pending = (draft?: Draft) => draft?.request && ["sent", "unconfirmed"].includes(hosted.comments.requests?.get(draft.request)?.state ?? "");
  const refusedGone = [reply, editing?.draft].some((draft) => draft?.request && hosted.comments.requests?.get(draft.request)?.reason === "thread_deleted");
  const gone = !exists || refusedGone;
  useEffect(() => {
    if (gone && !reply.text && !editing?.draft.text && !pending(reply) && !pending(editing?.draft)) close();
  }, [gone, reply.text, editing?.draft.text]);
  function menuFor(event: React.MouseEvent<HTMLButtonElement>, id: string) {
    const row = event.currentTarget.closest<HTMLElement>(".comment-row"), node = card.current!;
    // Card-relative offsets start inside its 1px border; the row offset stays unchanged.
    setMenu({ id, opener: event.currentTarget, top: row ? row.offsetTop + 36 - node.scrollTop : 39 });
  }
  function keys(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Escape" && !question) {
      event.preventDefault();
      if (menu) { menu.opener.focus(); setMenu(null); } else close();
    }
  }
  const fieldOperation = (): CommentOperation => ({ action: "reply", threadId: thread.id, commentId: crypto.randomUUID(), text: reply.text });
  return <div ref={card} className="comment-card" role={gone ? "alertdialog" : "dialog"} aria-label="Comment thread" style={style}
    onKeyDown={keys} onPointerDown={(event) => event.stopPropagation()}>
    <div className="comment-card-head"><span className="comment-title">Comment</span>
      {own && <button className="comment-icon" aria-label="More for this thread" disabled={!hosted.comments.ready || gone} onClick={(event) => menuFor(event, "thread")}><CommentIcon name="more" /></button>}
      <button className="comment-icon" aria-label={thread.resolved ? "Reopen" : "Resolve"} disabled={!hosted.comments.ready || gone}
        onClick={() => action({ action: thread.resolved ? "reopen" : "resolve", threadId: thread.id }, !thread.resolved)}><CommentIcon name={thread.resolved ? "reopen" : "check"} /></button>
      <button className="comment-icon" aria-label="Close comment thread" onClick={close}><CommentIcon name="close" /></button>
    </div>
    {gone ? <>
      <div className="comment-note error comment-gone" role="alert">{words.gone(deletedBy)}</div>
      {editing?.draft.text && <div className="comment-unposted"><CommentField hosted={hosted} draft={editing.draft} change={() => {}}
        operation={() => ({ action: "edit", threadId: thread.id, commentId: editing.id, text: editing.draft.text })}
        saved={() => {}} label="Unposted edit" edit locked /></div>}
    </> : <>
      {thread.anchor.detached && <div className="comment-detached-line"><CommentIcon name="unlink" />{detachedWords(thread)}</div>}
      {thread.comments.map((comment) => <div className="comment-row" key={comment.id}>
        <span className="comment-avatar" style={{ background: authorColour(comment.person) }}>{comment.label[0]?.toUpperCase()}</span>
        <span className="comment-who"><span className="comment-name">{comment.label}</span><span className="comment-time">{timeWords(comment.createdAt)}{comment.editedAt !== null ? " · edited" : ""}</span></span>
        {comment.person === hosted.comments.person ? <button className="comment-icon" aria-label={`More for comment by ${comment.label}`} disabled={!hosted.comments.ready}
          onClick={(event) => menuFor(event, comment.id)}><CommentIcon name="more" /></button> : <span />}
        <div className="comment-text">{editing?.id === comment.id ? <>
          <CommentField hosted={hosted} draft={editing.draft} change={(draft) => setEditing({ ...editing, draft })} edit label="Edit comment"
            cancel={() => { setEditing(null); card.current?.querySelector<HTMLTextAreaElement>('[aria-label="Reply"]')?.focus(); }}
            operation={() => ({ action: "edit", threadId: thread.id, commentId: comment.id, text: editing.draft.text })} saved={() => setEditing(null)} />
        </> : comment.text}</div>
      </div>)}
      {editing && !thread.comments.some((comment) => comment.id === editing.id) && <div className="comment-note error" role="alert">
        {words.commentDeleted}<CommentField hosted={hosted} draft={editing.draft} change={() => {}} edit locked label="Unposted edit"
          operation={() => ({ action: "edit", threadId: thread.id, commentId: editing.id, text: editing.draft.text })} saved={() => {}} />
      </div>}
      {thread.resolved && <div className="comment-note neutral" role="status">{words.resolvedNote(resolvedBy)}</div>}
    </>}
    <CommentField hosted={hosted} draft={reply} change={setReply} operation={fieldOperation} locked={gone} saved={() => {
      card.current?.querySelector<HTMLTextAreaElement>('[aria-label="Reply"]')?.focus();
    }} />
    {menu && <CommentMenu opener={menu.opener} close={() => setMenu(null)} style={{ top: menu.top, right: 5 }} items={menu.id === "thread"
      ? [{ label: "Delete thread…", run: () => setQuestion({ thread: true }) }]
      : [{ label: "Edit", run: () => { const comment = thread.comments.find((comment) => comment.id === menu.id)!; setEditing({ id: comment.id, draft: { text: comment.text } }); } },
        { label: "Delete comment", run: () => setQuestion({ commentId: menu.id, thread: menu.id === thread.firstComment }) }]} />}
    {question && <TeamDialog title={question.thread ? "Delete this thread?" : "Delete this comment?"} className="comment-question" close={() => {
      setQuestion(null); card.current?.querySelector<HTMLTextAreaElement>('[aria-label="Reply"]')?.focus();
    }}>
      <h1>{question.thread ? "Delete this thread?" : "Delete this comment?"}</h1>
      <p>{question.thread ? deleteBody(thread.comments.length - 1) : "You can't undo this."}</p>
      <button onClick={() => { setQuestion(null); card.current?.querySelector<HTMLTextAreaElement>('[aria-label="Reply"]')?.focus(); }}>Cancel</button>
      <button className="comment-destructive" disabled={!hosted.comments.ready} onClick={() => {
        action(question.commentId ? { action: "delete_comment", threadId: thread.id, commentId: question.commentId } : { action: "delete_thread", threadId: thread.id });
        setQuestion(null);
      }}>{question.thread ? "Delete thread" : "Delete comment"}</button>
    </TeamDialog>}
  </div>;
}
