// SPDX-License-Identifier: Apache-2.0
export type Message = Record<string, any>;
export interface Peer {
  messages: Message[];
  closed: number | null;
  send(value: unknown): void;
  next(kind: string): Promise<Message>;
  close(): Promise<void>;
}
export type Context = {
  people: Record<string, { id: string; email: string; token: string }>;
  bad: Record<string, string>; jwks: object; issuer: string; proxyUrl: string; helperUrl: string;
  origin: string; operatorKey: string; stack: { apiUrl: string }; serviceKey: string;
};
export interface Driver {
  runner: "node" | "workerd" | "docker";
  request(path: string, init?: RequestInit): Promise<Response>;
  connect(path: string, origin?: string): Promise<Peer>;
  control(value: Record<string, unknown>): Promise<any>;
  wake(board: string): Promise<void>;
  restoreFile(board: string, envelope: unknown, fenced: boolean): Promise<void>;
  volumeCopy?(board: string): Promise<void>;
  rows(board: string, table: string): Promise<any[]>;
  close(): Promise<void>;
}
