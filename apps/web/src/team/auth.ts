// SPDX-License-Identifier: Apache-2.0
import { AuthClient } from "@supabase/auth-js";
import { settings } from "./config";

export const auth = new AuthClient({
  url: settings.supabaseUrl + "/auth/v1",
  headers: { apikey: settings.anonKey },
  storageKey: "nextphase-board/auth/v1",
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
});
export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.getSession>>["data"]["session"]>;
