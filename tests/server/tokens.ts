// SPDX-License-Identifier: Apache-2.0
import { importJWK, SignJWT, type JWK } from "jose";
export async function token(key: JWK, issuer: string, person: { id: string; email: string }, options: Record<string, any> = {}) {
  const seconds = Math.floor((options.now ?? Date.now()) / 1000);
  const algorithm = options.algorithm ?? "ES256";
  const signingKey = algorithm === "HS256" ? new TextEncoder().encode(options.secret) : await importJWK({ ...key, key_ops: ["sign"] }, "ES256");
  return new SignJWT({ email: person.email, ...options.claims })
    .setProtectedHeader({ alg: algorithm, kid: options.kid ?? key.kid })
    .setSubject(person.id).setIssuer(options.issuer ?? issuer).setAudience(options.audience ?? "authenticated")
    .setIssuedAt(seconds).setExpirationTime(options.exp ?? seconds + 3600).sign(signingKey);
}
export async function badTokens(key: JWK, issuer: string, person: { id: string; email: string }, secret: string) {
  const good = await token(key, issuer, person);
  const parts = good.split(".");
  const signature = Buffer.from(parts[2], "base64url"); signature[0] ^= 1;
  const tampered = parts.slice(0, 2).join(".") + "." + signature.toString("base64url");
  return {
    malformed: "not-a-jws", tampered, hs256: await token(key, issuer, person, { algorithm: "HS256", secret }),
    expired: await token(key, issuer, person, { exp: Math.floor(Date.now() / 1000) - 60 }),
    audience: await token(key, issuer, person, { audience: "somewhere-else" }),
    issuer: await token(key, issuer, person, { issuer: "https://wrong.example.test/auth/v1" }),
    unknown: await token(key, issuer, person, { kid: "unknown-test-key" }),
  };
}
