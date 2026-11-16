// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useId, useRef, useState, type ButtonHTMLAttributes, type RefObject } from "react";
import { createPortal } from "react-dom";
import { activityPreview, type Preview, type TemplateCommands } from "../activities.ts";
import type { Snapshot } from "../clipboard.ts";
import type { HostedBoard } from "./hosted-board.ts";
import { Templates } from "./templates.ts";
import { contentBytes, menuIndex, points, saveLabel, saveReason, templateBoard, templateSnapshot, validDescription, validName, type Template } from "./templates-rules.ts";

type DialogState = { action: "save" | "edit" | "replace" | "delete"; template?: Template;
  source?: { pageName?: string; title: string; selected: boolean; snapshot: Snapshot | null } };
function PreviewImage({ preview }: { preview?: Preview }) {
  return <svg viewBox={preview?.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    {preview?.rectangles.map(({ id, ...rect }) => <rect key={id} {...rect} />)}
    {preview?.lines.map(({ id, ...line }) => <line key={id} {...line} />)}
  </svg>;
}
function Tip({ text, control }: { text: string; control: HTMLElement }) {
  const node = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = control.getBoundingClientRect(), tip = node.current!.getBoundingClientRect();
    node.current!.style.left = Math.max(8, Math.min(innerWidth - tip.width - 8, box.left + (box.width - tip.width) / 2)) + "px";
    node.current!.style.top = box.bottom + 8 + "px";
  }, [text, control]);
  return createPortal(<div ref={node} className="team-template-tip" aria-hidden="true">{text}</div>, document.body);
}
function TipButton({ tip, nodeRef, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tip: string; nodeRef?: RefObject<HTMLButtonElement | null> }) {
  const own = useRef<HTMLButtonElement>(null), ref = nodeRef ?? own, id = useId();
  const [hover, setHover] = useState(false), [focus, setFocus] = useState(false);
  return <><button {...props} ref={ref} aria-describedby={tip ? id : undefined}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
    {tip && <span className="sr-only" id={id}>{tip}</span>}
    {tip && (hover || focus) && ref.current && <Tip text={tip} control={ref.current} />}</>;
}
export function TemplatesSection({ hosted, commands, disabled }: { hosted: HostedBoard; commands: TemplateCommands; disabled: boolean }) {
  const controllerRef = useRef<Templates | null>(null);
  if (!controllerRef.current) controllerRef.current = new Templates(hosted.snapshot.workspaceId, hosted.snapshot.workspace, hosted.boardId, text => hosted.toast(text));
  const controller = controllerRef.current, [, redraw] = useState(0);
  const save = useRef<HTMLButtonElement>(null), group = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ template: Template; opener: HTMLButtonElement } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  useEffect(() => {
    const off = controller.subscribe(() => redraw(n => n + 1));
    void controller.open();
    return () => { off(); controller.stop(); };
  }, [controller]);
  const returnFocus = (template?: Template) => {
    const more = template && [...group.current?.querySelectorAll<HTMLButtonElement>(".team-template-more") ?? []].find(b => b.dataset.template === template.id);
    const target = template ? more : save.current;
    (target?.isConnected ? target : document.querySelector<HTMLButtonElement>(".templates-panel header button"))?.focus();
  };
  const closeDialog = (deleted = false) => {
    const template = dialog?.template;
    setDialog(null);
    requestAnimationFrame(() => returnFocus(deleted ? undefined : template));
  };
  if (!controller.visible) return null;
  const board = hosted.snapshot.board, multiple = (board?.pages.length ?? 0) > 1;
  const objectCount = board ? board.objects.filter(o => o.page === hosted.page).length : commands.objectCount;
  const source = () => !commands.selected && board ? templateSnapshot(board, new Set(), [], hosted.page) : commands.snapshot();
  const reason = saveReason(commands.commandReason, controller.canSave, controller.templates.length,
    controller.workspaceName, objectCount);
  const tip = reason || (!commands.selected ? `Nothing is selected, so all ${objectCount} objects on this ${multiple ? 'page' : 'board'} are saved` : "");
  const choose = (action: "edit" | "replace" | "delete") => {
    const template = menu!.template;
    if (action === "replace" && !commands.selected) return;
    setMenu(null); controller.error = "";
    setDialog({ action, template, ...(action === "replace" ? { source: source() } : {}) });
  };
  return <div className="team-templates" ref={group}>
    <div className="team-template-head"><h3>{controller.workspaceName}</h3>
      <span className="team-template-count">{controller.templates.length} of 25</span>
      <TipButton nodeRef={save} className="team-template-save" tip={tip} aria-disabled={!!reason}
        onClick={() => { if (!reason) { controller.error = ""; setDialog({ action: "save", source: source() }); } }}>
        {saveLabel(commands.selected, multiple)}
      </TipButton>
    </div>
    {controller.status === "loading" ? <p className="team-template-status">Loading team templates…</p>
      : controller.status === "failed" ? <><p className="team-template-status">Couldn't load team templates.</p>
        <button className="team-template-save" onClick={() => { void controller.refresh(); }}>Try again</button></>
      : controller.templates.length === 0 ? <p className="team-template-status">No team templates yet. Select objects on this board, then choose Save selection as template.</p>
      : <div className="template-cards">{controller.templates.map(template => {
        const by = `By ${template.creatorLabel} · from ${template.sourceTitle}`;
        return <article className={"template-card" + (controller.newId === template.id ? " team-template-new" : "")} key={template.id}>
          <div className="template-preview"><PreviewImage preview={activityPreview(templateBoard(template.objects).objects)} />
            <button className="add-template primary" aria-label={"Add template: " + template.name} disabled={disabled}
              onClick={() => { void controller.read(template).then(fresh => { if (fresh) commands.insertStored(fresh.name, templateBoard(fresh.objects)); }); }}>Add template</button>
            {template.canManage && <button className="team-template-more" data-template={template.id}
              aria-label={"More options: " + template.name} aria-haspopup="menu" aria-expanded={menu?.template.id === template.id}
              onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setMenu({ template, opener: event.currentTarget }); } }}
              onClick={event => setMenu(menu?.template.id === template.id ? null : { template, opener: event.currentTarget })}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                <circle cx="3.5" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="12.5" cy="8" r="1.4" />
              </svg>
            </button>}
          </div><h4>{template.name}</h4><p>{template.description}</p><small className="team-template-by" title={by}>{by}</small>
        </article>;
      })}</div>}
    {menu && <TemplateMenu opener={menu.opener} selected={commands.selected} choose={choose}
      close={focus => { setMenu(null); if (focus) returnFocus(menu.template); }} />}
    {dialog && <TemplateDialog key={dialog.action + (dialog.template?.id ?? "")} state={dialog} controller={controller} close={closeDialog} />}
  </div>;
}
function TemplateMenu({ opener, selected, choose, close }: { opener: HTMLButtonElement; selected: boolean;
  choose: (action: "edit" | "replace" | "delete") => void; close: (focus: boolean) => void }) {
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = menu.current!, box = opener.getBoundingClientRect(), size = node.getBoundingClientRect();
    node.style.left = Math.max(8, Math.min(innerWidth - size.width - 8, box.right - size.width)) + "px";
    node.style.top = Math.max(8, box.bottom + 4 + size.height > innerHeight - 8 ? box.top - size.height - 4 : box.bottom + 4) + "px";
    node.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => { if (!node.contains(event.target as Node) && !opener.contains(event.target as Node)) close(false); };
    const resize = () => close(true);
    window.addEventListener("pointerdown", outside); window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize, true);
    return () => { window.removeEventListener("pointerdown", outside); window.removeEventListener("resize", resize); window.removeEventListener("scroll", resize, true); };
  }, []);
  return createPortal(<div ref={menu} className="team-template-menu" role="menu" onKeyDown={event => {
    event.stopPropagation();
    if (["Escape", "Tab"].includes(event.key)) { event.preventDefault(); close(true); return; }
    const items = [...menu.current!.querySelectorAll<HTMLButtonElement>("button")];
    const next = menuIndex(event.key, items.indexOf(document.activeElement as HTMLButtonElement));
    if (next !== null) { event.preventDefault(); items[next].focus(); }
  }}>
    <button role="menuitem" tabIndex={-1} onClick={() => choose("edit")}>Edit details…</button>
    <TipButton role="menuitem" tabIndex={-1} aria-disabled={!selected} tip={selected ? "" : "Select objects to use as the new content"}
      onClick={() => { if (selected) choose("replace"); }}>Replace with selection</TipButton>
    <hr role="separator" /><button role="menuitem" tabIndex={-1} className="error" onClick={() => choose("delete")}>Delete…</button>
  </div>, document.body);
}
function TemplateDialog({ state, controller, close }: { state: DialogState; controller: Templates; close: (deleted?: boolean) => void }) {
  const node = useRef<HTMLDialogElement>(null), id = useId();
  const [name, setName] = useState(state.template?.name ?? ""), [description, setDescription] = useState(state.template?.description ?? "");
  const [touched, setTouched] = useState(false);
  const form = state.action === "save" || state.action === "edit", objects = state.source?.snapshot?.objects;
  let preview: Preview | undefined, contentError = "";
  if (objects) {
    try { preview = activityPreview(templateBoard(objects).objects); }
    catch { contentError = contentBytes(objects) > 262144 ? "This is too large for a template. Select fewer objects." : "Couldn't save the template. Try again."; }
  } else if (state.action === "save" || state.action === "replace") contentError = "Couldn't save the template. Try again.";
  const pending = controller.pending;
  const valid = (!form || validName(name) && validDescription(description)) && !contentError;
  useEffect(() => {
    const dialog = node.current!; dialog.showModal();
    (dialog.querySelector<HTMLElement>(form ? "input" : "button"))?.focus();
    return () => { dialog.close(); };
  }, []);
  const submit = async () => {
    setTouched(true);
    if (!valid || pending) return;
    const outcome = await controller.change(state.action, { name, description }, state.template, objects);
    if (outcome !== "failed") close(state.action === "delete" && outcome === "done");
  };
  const title = state.action === "save" ? "Save as template" : state.action === "edit" ? "Edit template details"
    : `${state.action === "replace" ? "Replace" : "Delete"} “${state.template!.name}”?`;
  const action = state.action === "save" ? "Save template" : state.action === "edit" ? "Save changes" : state.action === "replace" ? "Replace content" : "Delete template";
  return <dialog ref={node} className="board-question team-template-dialog" aria-labelledby={id + "-title"}
    onCancel={event => { event.preventDefault(); if (!pending) close(); }}
    onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); if (!pending) close(); } }}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h2 id={id + "-title"}>{title}</h2>
      {form ? <><p className="team-template-sub">{state.action === "save"
        ? `Saved to ${controller.workspaceName}. Its owners, editors and viewers can see it; anyone who can edit a board there can add it.`
        : "Changes the name and description only. Boards that already used it keep their copies."}</p>
        <label htmlFor={id + "-name"}>Name</label>
        <input id={id + "-name"} value={name} readOnly={pending} aria-invalid={touched && !name.trim()}
          onChange={event => setName([...event.target.value].slice(0, 120).join(""))} onBlur={() => setTouched(true)} />
        <p className="team-template-hint">{points(name)} / 120</p>
        {touched && !name.trim() && <p className="team-template-error" role="alert">Enter a name.</p>}
        <label htmlFor={id + "-description"}>Description <span>(optional)</span></label>
        <textarea id={id + "-description"} value={description} readOnly={pending}
          onChange={event => setDescription([...event.target.value].slice(0, 300).join(""))} />
        <p className="team-template-hint">{points(description)} / 300</p>
        {state.action === "save" && <><div className="template-preview"><PreviewImage preview={preview} /></div>
          <p className="team-template-what">{state.source?.selected ? `${objects?.length ?? 0} selected objects from ${state.source.title}`
            : `All ${objects?.length ?? 0} objects on ${state.source?.pageName ? `“${state.source.pageName}” of ` : ""}${state.source?.title}`}</p></>}
      </> : <p>{state.action === "replace"
        ? `Its content becomes the ${objects?.length ?? 0} selected objects. Its name, description and creator stay. Boards that already used it keep their copies.`
        : `${controller.workspaceName} will no longer see it in Templates. Boards that already used it keep their copies. This can’t be undone.`}</p>}
      {(contentError || controller.error) && <p className="team-template-error" role="alert">{contentError || controller.error}</p>}
      <div className="board-question-actions"><button type="button" disabled={pending} onClick={() => close()}>Cancel</button>
        <button type="submit" className={state.action === "delete" ? "error" : "primary"} disabled={pending || !valid}>{action}</button></div>
    </form>
  </dialog>;
}
