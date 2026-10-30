# 0003 — Identity contract

CONTRACT VERSION: 0003 identity v1 (2026-10-30)

Status: Draft for 0003-W1 v1. It defines who a request or a room connection belongs to. The
[access contract](0003-access-v1.md) says what that person may do.

## The person

A person is a Supabase Auth user. The server knows a person only by the `sub` claim (a UUID)
of a verified access token, together with the token's `email` and `exp` claims. Nothing else
identifies a person: a name, user metadata, an ID or a role sent in a request body or a room
message is never trusted, and user metadata never grants access.

A person becomes known to Board when they get one row in `nextphase_board.people` (see the
access contract), keyed by the same UUID, through the service-only SQL function
`remember_person(person, email)`, which inserts the row or updates its email. The server calls it
when the setup script creates the owner, when the invite route creates or finds the invited
email's Auth account (with that account's ID and email), and when a person accepts an
invitation (with the verified token's `sub` and `email`). Those routes need Supabase anyway; no
other route writes `people`, so a Supabase outage changes nothing here.

## Token checks

Every request carries `Authorization: Bearer <access token>`, except the room's WebSocket
upgrade, which carries a join ticket instead ([API contract](0003-api-v1.md)). A token is
accepted only when all of these hold:

1. It is a JWS whose header names `alg` `ES256` and a `kid`. Any other algorithm, `HS256`
   included, is refused without being verified. The server never holds a shared JWT secret.
2. The signature verifies against a public key of the configured Supabase project with that
   `kid` (see "Public keys").
3. `iss` equals the configured issuer and `aud` is `authenticated`. The issuer is its own
   setting (by default `<Supabase URL>/auth/v1`), because the server may reach Supabase through
   another address than the one in its tokens (a proxy, or `host.docker.internal` from a
   container).
4. `exp` is in the future and `iat` is not in the future, each with a clock allowance of at
   most 5 seconds.
5. `sub` is a UUID and `email` is present.

A refused token gives HTTP 401 with `{ "error": { "reason": "<reason>" } }`, where the reason
is `token_missing`, `token_malformed`, `token_algorithm`, `token_signature`, `token_issuer`,
`token_audience` or `token_expired`. A refused token never reveals whether a board exists:
the token is checked before any board lookup.

The server accepts the token lifetime configured on the Supabase project; it does not set its
own.

## Public keys

The deployment's settings carry the project's published public keys as a JSON Web Key Set
(the pinned set). The server also reads the project's key endpoint
(`<Supabase URL>/auth/v1/.well-known/jwks.json`):

- Keys read from the endpoint are kept for 10 minutes.
- A token whose `kid` is in the pinned set or in the kept keys is verified with that key. A
  failed or slow read of the endpoint never refuses a token whose key is already known.
- A token with an unknown `kid` makes the server read the endpoint again, at most once every
  30 seconds. If the key is still unknown, the token is refused with 401 `token_signature`.
  If the endpoint cannot be reached, the request gets 503 with reason
  `signing_keys_unavailable`.

The pinned set means a server that has just started can verify tokens while Supabase Auth is
unreachable. When the project rotates its keys, the new public key is added to the pinned set
before the old one is retired, as Supabase's signing-key rotation allows.

## Renewal on an open room connection

A room connection belongs to the person whose ticket opened it, and it lasts no longer than
the token that ticket was issued for. Before that token expires the client sends
`{ "kind": "renew", "token": "<new access token>" }` on the connection:

- The new token passes every check above and has the same `sub`: the connection now lasts
  until the new token's `exp`, and the room replies `{ "kind": "renewed", "expiresAt": <ms> }`.
- The token fails a check, or its `sub` differs: the room closes the connection with 4401.
- A renewal that arrives after the old token has expired cannot reopen it: the connection is
  already closed with 4401.

The room closes a connection with 4401 at its expiry if no valid renewal has arrived. The
expiry survives hibernation and restarts (it is stored with the connection, not only in
memory).

## Not in this version

Disabling an account, signing out everywhere and their effect on open connections belong to
the removal milestone. Sign-in screens belong to the web client.

## Public references

Retrieved 2026-10-30: [Supabase JSON Web Tokens](https://supabase.com/docs/guides/auth/jwts)
(claims, the JWKS endpoint, asymmetric signing keys) and
[Supabase self-hosted auth keys](https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys)
(asymmetric keys on a self-hosted project).
