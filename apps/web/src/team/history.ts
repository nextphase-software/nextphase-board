// SPDX-License-Identifier: Apache-2.0
import type { BoardV10 } from 'nextphase-board-rules/document.ts';
import { api, ApiError } from './api';
import { versionHeading, type Version, type Head, type SaveVersion, type RestoreVersion } from './history-rules';
import type { HostedBoard } from './hosted-board';
export const historyNavigation: { open?: string; source?: string; returnBoard?: string } = {};
export type HistoryDialog = 'save' | 'name' | 'confirm' | 'stale' | 'restoring' | 'pending' | 'failed' | 'role';
export class BoardHistory {
  open = false;
  previewing = false;
  document?: BoardV10;
  versions: Version[] = [];
  selected?: Version;
  naming?: Version;
  head?: Head;
  state: 'loading' | 'ready' | 'failed' | 'preview-loading' | 'preview-failed' | 'expired' = 'loading';
  dialog: HistoryDialog | null = null;
  name = ''; description = ''; writeFailed = false; writing = false;
  restored = ''; actor: string | null = null; rejoining = false; kept = false; denied = false;
  reviewedAt?: number;
  panEpoch = 0; paintEpoch = 0;
  private selectionEpoch = 0;
  private life = 0;
  private opener?: HTMLElement;
  private returnOpener?: () => void;
  private dialogOpener?: HTMLElement;
  private saveRequest?: Readonly<SaveVersion>;
  private restoreRequest?: Readonly<RestoreVersion>;
  private restoreId = '';
  private host: HostedBoard;
  constructor(host: HostedBoard) { this.host = host; }
  get locked() { return ['restoring','pending'].includes(this.dialog ?? ''); }
  get canManage() { return this.host.snapshot.role === 'owner' || this.host.snapshot.role === 'editor'; }
  get selectedId() { return this.selected?.id; }
  private path(id = '') { return `/boards/${this.host.boardId}/versions${id ? '/' + id : ''}`; }
  private emit(paint = false) { if (paint) this.paintEpoch++; this.host.historyChanged(); }
  private focus(selector: string) { requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus()); }
  show(opener?: HTMLElement, returnOpener?: () => void) {
    this.opener = opener; this.returnOpener = returnOpener; this.open = true; this.emit(); void this.refresh();
  }
  close() {
    if (this.locked) return;
    this.current(); this.open = false; this.selectionEpoch++; this.emit();
    if (historyNavigation.source) {
      historyNavigation.returnBoard = this.host.boardId;
      location.hash = historyNavigation.source; delete historyNavigation.source;
    } else if (this.returnOpener) this.returnOpener();
    else { this.opener?.focus(); }
  }
  current() {
    const was = this.previewing;
    this.previewing = false; this.document = undefined; this.selectionEpoch++; this.state = 'ready';
    if (was) { this.panEpoch++; this.host.panReturning = !this.host.snapshot.connected; }
    this.emit(true);
    if (this.selected) this.focus(`[data-version="${this.selected.id}"] .history-open`);
  }
  async failure(error: unknown) {
    if (error instanceof ApiError && error.status === 403) { this.dialog = 'role'; return; }
    if (error instanceof ApiError && error.status === 404) {
      try { await api(`/boards/${this.host.boardId}`); }
      catch (probe) { if (probe instanceof ApiError && probe.status === 404) { this.host.historyDenied(); return; } }
    }
  }
  async refresh() {
    const life = this.life;
    this.state = 'loading'; this.versions = []; this.emit();
    try {
      const result = await api<{ versions: Version[]; head: Head }>(this.path());
      if (life !== this.life || this.denied) return;
      this.versions = result.versions; this.head = result.head; this.state = 'ready'; this.emit();
    } catch (error) {
      if (life !== this.life) return;
      await this.failure(error); if (life !== this.life) return;
      this.state = 'failed'; this.emit();
    }
  }
  async select(version: Version) {
    const read = ++this.selectionEpoch, life = this.life;
    this.previewing = true; this.panEpoch++; this.host.stopFollowing(); this.document = undefined;
    this.selected = version; this.state = 'preview-loading'; this.emit(true);
    try {
      const result = await api<{ version: Version; document: BoardV10 }>(this.path(version.id));
      if (read !== this.selectionEpoch || life !== this.life || !this.previewing) return;
      this.document = result.document; this.selected = result.version; this.state = 'ready'; this.emit(true);
    } catch (error) {
      if (read !== this.selectionEpoch || life !== this.life) return;
      await this.failure(error); if (read !== this.selectionEpoch || life !== this.life) return;
      this.state = error instanceof ApiError && error.status === 404 ? 'expired' : 'preview-failed';
      if (this.state === 'expired') { this.versions = this.versions.filter(v => v.id !== version.id); this.selected = undefined; }
      this.emit(true);
    }
  }
  begin(kind: 'save' | 'name', opener: HTMLElement, version?: Version) {
    this.dialogOpener = opener; this.dialog = kind; this.naming = kind === 'name' ? version ?? this.selected : undefined;
    this.name = kind === 'name' ? this.naming?.name ?? '' : '';
    this.description = kind === 'name' ? this.naming?.description ?? '' : '';
    this.saveRequest = undefined; this.writeFailed = false; this.emit();
  }
  cancel() { if (this.locked || this.writing) return; this.dialog = null; this.emit(); this.dialogOpener?.focus(); }
  fields(name: string, description: string) { if (this.writing || this.writeFailed) return; this.name = name; this.description = description; this.emit(); }
  async write() {
    if (this.writing) return;
    const kind = this.dialog, life = this.life, selected = this.naming?.id ?? this.selected?.id;
    const body = this.saveRequest ??= Object.freeze({ requestId: crypto.randomUUID(), name: this.name, description: this.description });
    this.writing = true; this.emit();
    try {
      const value = await api<{ version: Version }>(kind === 'save' ? this.path() : this.path(selected), kind === 'save' ? 'POST' : 'PATCH', kind === 'save' ? body : { name: body.name, description: body.description });
      if (life !== this.life) return;
      if (selected === this.selected?.id && kind === 'name') this.selected = value.version;
      this.dialog = null; this.dialogOpener?.focus(); await this.refresh();
    } catch (error) { if (life === this.life) { await this.failure(error); this.writeFailed = true; } }
    finally { if (life === this.life) { this.writing = false; this.emit(); } }
  }
  async confirm(opener: HTMLElement) {
    const life = this.life, selected = this.selected?.id;
    this.dialogOpener = opener;
    try {
      const list = await api<{ versions: Version[]; head: Head }>(this.path());
      if (life !== this.life || selected !== this.selected?.id) return;
      this.head = list.head; this.restoreId = selected!;
      this.restoreRequest = Object.freeze({ requestId: crypto.randomUUID(), expectedRevision: list.head.revision, expectedGeneration: list.head.generation });
      this.dialog = 'confirm'; this.emit();
    } catch (error) { if (life === this.life) { await this.failure(error); this.state = 'preview-failed'; this.emit(); } }
  }
  review() { this.dialog = null; this.reviewedAt = Date.now(); this.current(); }
  async restore() {
    if (!this.restoreRequest || this.writing) return;
    const life = this.life, heading = this.selected ? versionHeading(this.selected) : '';
    this.dialog = 'restoring'; this.writing = true; this.emit();
    try {
      await api(this.path(this.restoreId) + '/restore', 'POST', this.restoreRequest);
      if (life !== this.life) return;
      this.dialog = null; this.restored = heading; this.current(); await this.refresh();
    } catch (error) {
      if (life !== this.life) return;
      if (error instanceof ApiError && error.reason === 'head_changed') this.dialog = 'stale';
      else if (error instanceof ApiError && error.reason === 'restore_failed') this.dialog = 'failed';
      else if (error instanceof ApiError && error.status === 404) { this.dialog = null; await this.failure(error); this.state = 'expired'; this.selected = undefined; this.document = undefined; }
      else if (error instanceof ApiError && error.status === 403) this.dialog = 'role';
      else this.dialog = 'pending';
    } finally { if (life === this.life) { this.writing = false; this.emit(); } }
  }
  restoring(actor: string | null) { this.actor = actor; this.rejoining = true; this.kept = true; this.host.stopFollowing(); this.emit(); }
  rejoined(changed: boolean) {
    if (changed || this.rejoining) { this.rejoining = false; this.kept = true; if (this.previewing) this.current(); }
  }
  clear() {
    this.life++; this.selectionEpoch++; this.open = false; this.previewing = false; this.document = undefined;
    this.versions = []; this.selected = undefined; this.naming = undefined; this.head = undefined; this.dialog = null;
    this.name = ''; this.description = ''; this.actor = null; this.kept = false; this.restored = '';
    this.saveRequest = undefined; this.restoreRequest = undefined;
  }
}
