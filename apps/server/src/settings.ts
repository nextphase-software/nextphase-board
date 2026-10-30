// SPDX-License-Identifier: Apache-2.0
import type { JSONWebKeySet } from "jose";
export type Settings = {
  supabaseUrl: string; issuer?: string; serviceKey: string; jwks: JSONWebKeySet;
  allowedOrigin: string; operatorKey?: string; dataDir: string; port?: number;
};
export function checkSettings(value: unknown): Settings {
  const settings = value as Settings;
  if (!settings || typeof settings.supabaseUrl !== "string" || typeof settings.serviceKey !== "string" ||
    !settings.serviceKey || typeof settings.dataDir !== "string" || !settings.dataDir ||
    typeof settings.allowedOrigin !== "string" || !Array.isArray(settings.jwks?.keys)) throw Error("Invalid server settings");
  for (const address of [settings.supabaseUrl, settings.allowedOrigin, ...(settings.issuer ? [settings.issuer] : [])]) {
    const url = new URL(address);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "host.docker.internal"].includes(url.hostname))) {
      throw Error("HTTPS is required outside local tests");
    }
  }
  return settings;
}
