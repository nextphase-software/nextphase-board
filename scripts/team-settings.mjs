// SPDX-License-Identifier: Apache-2.0
export function teamSettings(environment) {
  if (environment.BOARD_TEAM_FEATURES !== "on") return null;
  function required(name) {
    const value = environment[name];
    if (!value?.trim()) throw Error(`${name} is required`);
    return value;
  }
  function origin(name) {
    const value = required(name);
    try {
      const url = new URL(value);
      if (!/^https?:\/\/[^/?#\s]+\/?$/.test(value) ||
          !["http:", "https:"].includes(url.protocol) || url.pathname !== "/" ||
          url.search || url.hash || url.username || url.password || /[?#]/.test(value)) throw Error();
      return url.origin;
    } catch { throw Error(`${name} must be an http: or https: origin`); }
  }
  return {
    supabaseUrl: origin("BOARD_SUPABASE_URL"),
    anonKey: required("BOARD_SUPABASE_ANON_KEY"),
    serverUrl: origin("BOARD_SERVER_URL"),
  };
}
