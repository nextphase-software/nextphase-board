// SPDX-License-Identifier: Apache-2.0
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK, type JSONWebKeySet } from "jose";
import { RoomError, type Person } from "nextphase-board-room/protocol.ts";
export type AuthSettings = { supabaseUrl: string; issuer?: string; jwks: JSONWebKeySet };
export class Auth {
  private settings: AuthSettings;
  private now: () => number;
  private fetcher: typeof fetch;
  private cached: JWK[] = [];
  private cachedUntil = 0;
  private lastRead = -Infinity;
  private unavailable = false;
  private pendingRead?: Promise<void>;
  constructor(settings: AuthSettings, now = Date.now, fetcher = fetch) {
    this.settings = settings;
    this.now = now;
    this.fetcher = fetcher;
  }
  async verify(token: string): Promise<Person> {
    let header;
    try { header = decodeProtectedHeader(token); }
    catch { throw new RoomError(401, "token_malformed"); }
    if (header.alg !== "ES256") throw new RoomError(401, "token_algorithm");
    if (typeof header.kid !== "string" || !header.kid) throw new RoomError(401, "token_malformed");
    const known = () => [...this.settings.jwks.keys, ...(this.cachedUntil > this.now() ? this.cached : [])]
      .find((key) => key.kid === header.kid && key.kty === "EC" && key.crv === "P-256");
    let key = known();
    if (!key) {
      if (!this.pendingRead && this.now() - this.lastRead >= 30000) {
        this.lastRead = this.now();
        this.pendingRead = this.readKeys().finally(() => { this.pendingRead = undefined; });
      }
      await this.pendingRead;
      key = known();
      if (!key) throw new RoomError(this.unavailable ? 503 : 401, this.unavailable ? "signing_keys_unavailable" : "token_signature");
    }
    try {
      const { payload } = await jwtVerify(token, await importJWK(key, "ES256"), {
        algorithms: ["ES256"], issuer: this.settings.issuer ?? this.settings.supabaseUrl + "/auth/v1",
        audience: "authenticated", currentDate: new Date(this.now()), clockTolerance: 0,
        requiredClaims: ["sub", "email", "exp", "iat"],
      });
      if (typeof payload.sub !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) ||
        typeof payload.email !== "string" || !payload.email || typeof payload.iat !== "number" || payload.iat > this.now() / 1000 ||
        typeof payload.exp !== "number") throw new RoomError(401, "token_malformed");
      return { id: payload.sub, email: payload.email, expiresAt: payload.exp * 1000 };
    } catch (error) {
      if (error instanceof RoomError) throw error;
      const code = (error as { code?: string; claim?: string }).code;
      const claim = (error as { claim?: string }).claim;
      const reason = code === "ERR_JWT_EXPIRED" ? "token_expired" :
        claim === "iss" ? "token_issuer" : claim === "aud" ? "token_audience" :
        code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ? "token_signature" : "token_malformed";
      throw new RoomError(401, reason);
    }
  }
  private async readKeys() {
    try {
      const response = await this.fetcher(this.settings.supabaseUrl + "/auth/v1/.well-known/jwks.json", { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw Error();
      const value = await response.json() as JSONWebKeySet;
      if (!Array.isArray(value.keys)) throw Error();
      this.cached = value.keys;
      this.cachedUntil = this.now() + 600000;
      this.unavailable = false;
    } catch { this.unavailable = true; }
  }
  bearer(header?: string): Promise<Person> {
    if (!header) return Promise.reject(new RoomError(401, "token_missing"));
    const match = /^Bearer (\S+)$/i.exec(header);
    if (!match) return Promise.reject(new RoomError(401, "token_malformed"));
    return this.verify(match[1]);
  }
}
