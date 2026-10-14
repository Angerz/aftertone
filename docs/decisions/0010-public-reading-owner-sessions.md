# Public reading and single-owner administration

Status: accepted for implementation; public release remains an owner action.

Aftertone is being prepared for anonymous catalogue browsing with one authenticated
owner. Keep the modular monolith and SQLite. No accounts service, public registration,
JWT infrastructure, Redis, or separate frontend/API origin is needed.

An environment-provisioned Argon2id hash verifies the owner. A successful login replaces
all previous sessions and issues 256 bits of random bearer-token entropy. SQLite
stores only its SHA-256 digest, expiry, and a credential fingerprint. Rotation of the
configured hash immediately invalidates sessions. Logout deletes the session. Restart
preserves sessions and the global account throttle. Expiration is absolute, default
12 hours, configurable from 5 minutes to 7 days. There is no sliding renewal.

Production uses a host-only `__Host-` cookie with Secure, HttpOnly, SameSite=Strict,
Path=/ and no Domain attribute. Development uses an unprefixed HTTP cookie for loopback.
The session endpoint discloses a session-bound CSRF token to the same-origin client;
all authenticated mutations require that token and an exact configured Origin.
Login itself requires the trusted Origin. Other projects on `angerz.dev` are not
trusted origins. The password hash is the only required authentication secret;
there is no signing secret because session authority lives in SQLite.

Explicit FastAPI dependencies protect every mutation, metadata lookup, legacy detail,
and track-picker read. A global async dependency sets request-local owner context for
response serialization; visitors receive numeric rating history but no journal notes,
revisit reasons, or revisit flags. Public media and catalogue metadata are intentionally
public. Public note publication would require a separate, explicit product decision.

Single-account login permits ten attempts per five-minute fixed window, stored and
incremented atomically in SQLite. This avoids spoofed-IP bypass and additional services.
An attacker can temporarily deny owner login by exhausting the shared budget. A more
sophisticated identity/network policy is deferred until actual traffic warrants it.

One application worker and one local persistent volume keep SQLite operation simple.
A single container serves the built client, API, and generated media. TLS terminates
at a host reverse proxy. Complete archives are made with application writers stopped,
then copied off-host; restores never replace existing data automatically.
