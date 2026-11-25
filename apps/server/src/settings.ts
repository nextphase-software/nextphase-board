// SPDX-License-Identifier: Apache-2.0
import type { JSONWebKeySet } from "jose";
import { checkDenyPrefixes } from "./link-preview/fetcher.ts";
export type Settings = {
  supabaseUrl: string; issuer?: string; serviceKey: string; jwks: JSONWebKeySet;
  linkPreviewOrigins?: string[]; linkPreviewDenyPrefixes?: string[];
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
  if (settings.linkPreviewOrigins !== undefined && (!Array.isArray(settings.linkPreviewOrigins) ||
      settings.linkPreviewOrigins.some(origin => {
        const url = typeof origin === "string" && URL.parse(origin);
        return !url || url.origin !== origin || (url.protocol !== "https:" && !(url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "host.docker.internal"].includes(url.hostname)));
      }))) throw Error("Invalid linkPreviewOrigins");
  if (settings.linkPreviewDenyPrefixes !== undefined) {
    if (!Array.isArray(settings.linkPreviewDenyPrefixes) || settings.linkPreviewDenyPrefixes.some(value => typeof value !== "string")) {
      throw Error("Invalid linkPreviewDenyPrefixes");
    }
    checkDenyPrefixes(settings.linkPreviewDenyPrefixes);
  }
  return settings;
}
