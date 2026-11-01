// SPDX-License-Identifier: Apache-2.0
declare const BOARD_TEAM_SETTINGS: { supabaseUrl: string; anonKey: string; serverUrl: string };
export const settings = BOARD_TEAM_SETTINGS;
export const socketOrigin = settings.serverUrl.replace(/^http/, "ws");
