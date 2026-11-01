// SPDX-License-Identifier: Apache-2.0
import { auth } from "./auth";
import { settings } from "./config";

export class ApiError extends Error {
  status: number;
  reason: string;
  needed?: string;
  constructor(status: number, reason: string, needed?: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
    this.needed = needed;
  }
}
export async function api<T>(path: string, method = "GET", body?: object): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { data } = await auth.getSession();
    const reply = await fetch(settings.serverUrl + path, {
      method, signal: controller.signal,
      headers: { Authorization: "Bearer " + (data.session?.access_token ?? ""),
        ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!reply.ok) {
      const value = await reply.json();
      throw new ApiError(reply.status, value.error?.reason ?? "unknown", value.error?.needed);
    }
    return reply.status === 204 ? undefined as T : await reply.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "no_answer");
  } finally { clearTimeout(timeout); }
}
