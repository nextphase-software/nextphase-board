// SPDX-License-Identifier: Apache-2.0
import { api, ApiError } from "./api.ts";
import { limitReason, parseTemplate, parseTemplateDetail, parseTemplates, templateBoard, templateNotice, validName, validDescription, type AssetEntry, type Template, type TemplateDetail } from "./templates-rules.ts";
import { boardDownload, mediaOf, openTemplateUpload, runTemplateSave, stageTemplate, templateAdds } from "./media-transfer.ts";
import type { Snapshot } from "../clipboard.ts";
import type { TemplateCommands } from "../activities.ts";
import type { HostedBoard } from "./hosted-board.ts";

type Details = { name: string; description: string };
type Outcome = "done" | "refused" | "failed";
export class Templates {
  status: "loading" | "ready" | "failed" | "refused" = "loading";
  visible = false;
  templates: Template[] = [];
  canSave = false;
  newId = "";
  pending = false;
  progress: number | undefined;
  error = "";
  private listeners = new Set<() => void>();
  private active = true;
  private sequence = 0;
  private transferring?: AbortController;
  constructor(readonly workspace: string, readonly workspaceName: string, readonly board: string,
    readonly toast: (text: string) => void, private request: typeof api = api) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish() { if (this.active) for (const listener of this.listeners) listener(); }
  stop() { this.active = false; this.sequence++; this.transferring?.abort(); this.listeners.clear(); }
  private get path() { return `/workspaces/${this.workspace}/templates`; }
  async open() {
    try {
      const list = await this.request<{ workspaces: { id: string; role: string }[] }>("/workspaces");
      if (!this.active) return;
      this.visible = list.workspaces.some(w => w.id === this.workspace && ["owner", "editor", "viewer"].includes(w.role));
      if (this.visible) await this.refresh();
      else { this.status = "refused"; this.publish(); }
    } catch { if (this.active) { this.status = "failed"; this.publish(); } }
  }
  async refresh() {
    const sequence = ++this.sequence;
    this.status = "loading"; this.publish();
    try {
      const value = parseTemplates(await this.request(this.path));
      if (!this.active || sequence !== this.sequence) return;
      this.templates = value.templates; this.canSave = value.canSave; this.status = "ready";
    } catch (error) {
      if (!this.active || sequence !== this.sequence) return;
      this.status = this.refused(error) ? "refused" : "failed";
      if (this.status === "refused") { this.visible = false; this.templates = []; }
    }
    this.publish();
  }
  private refused(error: unknown) { return error instanceof ApiError && [403, 404].includes(error.status); }
  async read(template: Template): Promise<TemplateDetail | null> {
    try { const value = parseTemplateDetail(await this.request(this.path + "/" + template.id)); return this.active ? value : null; }
    catch (error) {
      if (!this.active) return null;
      if (this.refused(error)) { this.toast(templateNotice("gone", template.name)); await this.refresh(); }
      else this.toast("Couldn't load team templates.");
      return null;
    }
  }
  async add(template: Template, hosted: HostedBoard, commands: TemplateCommands) {
    const runner = templateAdds(hosted);
    if (runner.adding) return;
    const fresh = await this.read(template);
    if (!fresh || !this.active || runner.adding) return;
    const insert = () => commands.insertStored(fresh.name, templateBoard(fresh.objects));
    if (!mediaOf(fresh.objects).length) insert();
    else await runner.add(fresh, commands.closeTemplates, insert);
  }
  async change(action: "save" | "edit" | "replace" | "delete", details: Details, template?: Template, objects?: Snapshot["objects"],
    media: AssetEntry[] = [], hosted?: HostedBoard): Promise<Outcome> {
    if (this.pending) return "failed";
    this.pending = true; this.error = ""; this.publish();
    try {
      if (action === "save" || action === "edit") {
        if (!validName(details.name) || !validDescription(details.description)) throw Error("Invalid details");
      }
      if (action === "save" || action === "replace") templateBoard(objects);
      const body = action === "save" ? { ...details, sourceBoard: this.board, objects }
        : action === "edit" ? details : action === "replace" ? { sourceBoard: this.board, objects } : undefined;
      const path = this.path + (template ? "/" + template.id : "");
      const method = action === "save" ? "POST" : action === "delete" ? "DELETE" : "PATCH";
      let result;
      if (media.length && hosted) {
        const transfer = this.transferring = new AbortController();
        this.progress = 0; this.publish();
        const saved = await runTemplateSave(media, {
          open: (assets, signal) => openTemplateUpload(this.workspace, assets, signal),
          download: boardDownload(hosted.pictures),
          stage: (id, hash, blob, progress, signal) => stageTemplate(this.workspace, id, hash, blob, progress, signal),
          save: upload => this.request(path, method, { ...body, upload }),
        }, value => { this.progress = value; this.publish(); }, transfer.signal);
        if (!saved.ok) {
          if (!this.active) return "failed";
          if ("limit" in saved && saved.limit) { this.toast(limitReason(this.workspaceName)); await this.refresh(); return "refused"; }
          this.error = `Couldn't ${action === "replace" ? "replace" : "save"} the template: ${saved.reason}. Try again.`;
          return "failed";
        }
        result = saved.value;
      } else result = await this.request(path, method, body);
      const saved = action === "delete" ? template! : parseTemplate(result);
      if (!this.active) return "done";
      if (action === "save") this.newId = saved.id;
      this.toast(templateNotice(action === "save" ? "saved" : action === "edit" ? "updated" : action === "replace" ? "replaced" : "deleted",
        saved.name, this.workspaceName, objects?.length));
      await this.refresh();
      return "done";
    } catch (error) {
      if (!this.active) return "failed";
      if (this.refused(error) || action === "save" && error instanceof ApiError && error.status === 409) {
        this.toast(error instanceof ApiError && error.status === 409 ? limitReason(this.workspaceName)
          : templateNotice(action === "save" ? "refused" : "gone", template?.name ?? "", this.workspaceName));
        await this.refresh(); return "refused";
      }
      this.error = `Couldn't ${action === "replace" ? "replace" : action === "delete" ? "delete" : "save"} the template. Try again.`;
      return "failed";
    } finally { this.pending = false; this.progress = undefined; this.transferring = undefined; this.publish(); }
  }
}
