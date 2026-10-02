# Design

How the Easygenerator auth task is built and why. This describes the implemented design. Section 8 lists the automated checks; `AI.md` records the manual verification.

## 1. Decisions and alternatives

| Area | Decision | Alternatives considered | Why |
|---|---|---|---|
| Runtime | Node 24 LTS; exact library versions in the lockfiles | Node 22 | Current LTS; `argon2` ships prebuilt binaries for it |
| Repo shape | Two independent apps (`backend/`, `frontend/`) plus root README, compose, Dockerfile, CI | npm workspaces with a shared contracts package; Nx/Turborepo | No build tooling between apps. Rule drift between the two validators is caught by a shared test-vector table (§3) |
| Frontend | React + Vite + strict TypeScript | Vue | I know React better than Vue |
| Backend | NestJS 11 (Express adapter) + Mongoose 9 | Fastify adapter; native driver, Prisma, TypeORM | Required framework; idiomatic Nest + Mongo with schemas and indexes in one place |
| **Auth model** | **Opaque session token**: 32 random bytes in an httpOnly cookie; only its SHA-256 hash is stored in `sessions` | Stateless JWT (logout cannot revoke); JWT + session lookup (pays for both); access/refresh rotation | I included logout and required revocation. A JWT would still need a database check to meet that requirement. Hashing means a DB leak exposes no usable cookies |
| Session lifetime | Fixed 8 h absolute (`SESSION_TTL_SECONDS`), no sliding renewal | Sliding idle timeout, refresh tokens | Simple and predictable; sign in again after expiry |
| Auth enforcement | Global guard (`APP_GUARD`), deny by default; API handlers opt out with `@Public()` | Per-route `@UseGuards` | A new API handler cannot accidentally ship unprotected |
| CSRF | `Content-Type: application/json` enforced on every mutation (415 otherwise) + `SameSite=Lax` cookie + `Origin` allowlist (403). CORS is never enabled | Synchronizer token / double-submit cookie | A cross-site page cannot send JSON without a CORS preflight, which this API never grants. Three cheap layers instead of a token protocol |
| Cookie | Production: `__Host-session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`. Dev/test: `session`, not Secure. Derived from `NODE_ENV`, not a toggle | A `COOKIE_SECURE` flag | Secure is mandatory when `NODE_ENV=production`; `__Host-` blocks subdomain cookie injection |
| Password hashing | argon2id, m=19456 KiB, t=2, p=1 (OWASP baseline) | bcrypt, scrypt | Memory-hard, current OWASP first choice, no 72-byte truncation |
| Signup flow | Creates the user **and** a session, lands on `/app` | Redirect to sign-in | Signing users in after signup avoids an extra step; a lost response is ambiguous in both designs |
| Validation | Backend: `class-validator` DTOs + global `ValidationPipe`. Frontend: React Hook Form + Zod. Identical email, name and password patterns; name and password length in code points | nestjs-zod + shared package | Nest-idiomatic, works with Swagger; drift checked by identical test vectors |
| HTTP client | Thin `fetch` wrapper returning typed results, `ApiError` and `NetworkError` | Axios, TanStack Query, runtime response parsing | Four endpoints against a same-team API |
| Auth state | React context with four states: `checking`, `authenticated`, `unauthenticated`, `unavailable` | Redux/Zustand; Web Locks cross-tab coordination | Explicit states prevent redirect flashes and stop outages being shown as "signed out" |
| Styling | Tailwind CSS 4, a few hand-built accessible components | shadcn/ui, MUI | Few components; full control of accessibility |
| Rate limiting | `@nestjs/throttler`, in-memory | Redis-backed store | Single instance; the Redis store is the documented scaling step |
| Logging | `nestjs-pino`: JSON, request id, redaction, sanitized errors | Nest built-in Logger | Structured logs |
| Errors | Global exception filter plus an Express body-parser error handler, using the same classification and response shape | Default Nest errors | Predictable client handling; parser statuses preserved before production static serving handles errors |
| API docs | `@nestjs/swagger` at `/api/docs`, disabled in production | None | Covers the API documentation bonus |
| Health | `@nestjs/terminus`: `/api/health/live` (process up) and `/api/health/ready` (Mongo ping) | Single endpoint | Restart on a dead process, not on DB blips |
| Config | `@nestjs/config` + Joi schema; fail fast on boot | Raw `process.env` | Misconfiguration crashes at startup, not mid-request. `ALLOWED_ORIGINS` is required in production for the same reason |
| Indexes | Defined in schemas; `autoIndex` on; startup awaits `Model.init()` so the unique index exists before serving | Versioned migrations with `autoIndex` off | Proportionate for one collection pair |
| Tests | Backend: Jest unit + e2e (supertest + `mongodb-memory-server` pinned to the compose Mongo version). Frontend: Vitest + Testing Library | Docker replica set, multi-browser Playwright with an HTTPS harness | Real Mongo behaviour (unique index, E11000) without Docker in CI |
| CI | GitHub Actions on every push/PR: lint, typecheck, test, build per app; `permissions: contents: read`; no secrets | | Least privilege |
| CD | `publish` job on pushes to `main` only, after CI passes: build the image with `GIT_SHA` baked in and push to GHCR tagged with the commit SHA, using `GITHUB_TOKEN` (`packages: write`) only | `latest` tag; deploy to a PaaS with SHA polling | The published image is exactly the tested commit and reports it at `/api/health/live`. No live deployment is in scope |
| Production serving | One multi-stage Dockerfile; Nest serves `frontend/dist` through `ServeStaticModule`, excluding `/api` | Separate frontend host | Same origin in production, so the cookie and CSRF decisions hold. Unknown `/api/*` paths stay JSON 404s |
| Production DB | Any MongoDB 8 reachable through `MONGODB_URI`; locally the compose `mongo` service | Hosted cluster | The image only needs a connection string |

## 2. Behaviour contract

The brief requires signup, signin and the protected greeting, and makes logout optional. This contract includes my additional choices: automatic sign-in after signup, revocation, independent sessions, fixed expiry and explicit outage handling.

1. A visitor signs up with a valid email, name and password and lands on `/app` already signed in.
2. Invalid input shows per-field errors before submission; the backend rejects the same cases independently.
3. An existing email returns 409 "An account with this email already exists" and never changes the existing account. This reveals the account exists; accepted for clarity and listed under next steps.
4. Correct credentials lead to `/app`. A wrong password and an unknown email give the same public 401 "Invalid email or password".
5. `/app` shows exactly "Welcome to the application.", the user's name as escaped text, and a logout button.
6. Reloading `/app` keeps the user signed in, with no redirect flash.
7. Signed out, `/app` redirects to `/signin`. Signed in, `/signin` and `/signup` redirect to `/app`.
8. Logout deletes the server session. Replaying the old cookie afterwards returns 401.
9. Logout ends only the current session; another browser signed into the same account stays signed in.
10. After 8 hours the session stops working and the user must sign in again. Activity does not extend it.
11. A network failure or 503 shows a retryable error and is not treated as "signed out".

## 3. Validation and normalization

The same patterns live in `backend/src/auth/dto/validation-rules.ts` and `frontend/src/features/auth/schemas.ts`. Name and password length is enforced inside `u`-flag regexes so both sides count Unicode code points identically. Email is ASCII, with an explicit maximum checked separately in both libraries. The patterns and test vectors are copied between the apps; there is no shared validation package.

| Field | Normalize | Signup rule | Message |
|---|---|---|---|
| email | trim, lowercase | ASCII dot-atom local part; domain labels of 1–63 letters/digits/hyphens with no edge hyphens; letters-only TLD of 2–63 characters; max 254 overall | "Enter a valid email address" |
| name | trim | `/^[^\p{Cc}\p{Cs}]{3,50}$/u`: 3–50 code points, any script, no control characters or lone surrogates | "Name must be 3–50 characters" |
| password | **none**, never trimmed or case-changed | `/^(?=.*\p{L})(?=.*\d)(?=.*[\p{P}\p{S}])[^\p{Cc}\p{Cs}]{8,128}$/u` | Live checklist in the UI; one combined API message |

- Letter = any Unicode letter (Arabic counts). Number = ASCII digit. Special = Unicode punctuation or symbol (`\p{P}`, `\p{S}`): `!`, `@`, `،`, `€` and emoji count; a combining mark alone does not.
- Spaces are allowed inside passwords but do not count as special. Control characters and unpaired surrogates are rejected.
- The 128 maximum bounds hashing cost and payload abuse.
- **Sign-in is looser on purpose:** a valid email and a password of 1–128 characters. The creation policy is not re-applied, so a future policy change cannot lock out existing users.

Shared test vectors, run verbatim by both suites (`backend/test/fixtures/validation-vectors.ts`, `frontend/src/features/auth/validation-vectors.ts`):

| Input | Valid signup password? |
|---|---|
| `abc12345!` | yes |
| `كلمة123!x` | yes: Arabic letters count |
| `abc 123!` | yes: space allowed, `!` is the special |
| `abcdefgh` | no: no digit, no special |
| `12345678!` | no: no letter |
| `abcd1234` | no: no special |
| `abc 1234` | no: space is not special |
| `a1!` | no: too short |
| `abcd123́` | no: a combining accent is not special |
| `abcd123!\uD800` | no: unpaired surrogate |
| `abc1234😀` | yes: 8 code points (9 UTF-16 units); the emoji is the special |
| `abc123😀` | no: 7 code points, even though it is 8 UTF-16 units |
| 128 code points | yes |
| 129 code points | no |

Name vectors: `"  Al  "` invalid (2 after trim), `"Ali"` valid, `"علي"` valid, `"Ali\u0000"` invalid, `"Al\uD800"` invalid, 50 code points valid, 51 invalid.

Email vectors: `"  User@Mail.com "` valid and stored as `user@mail.com`; `a@b.co`, `a!b@example.com`, `a%b@example.com` and `first.last+tag@example.co.uk` valid; `user@mail`, `no-at-sign`, `user@@mail.com`, `a..b@example.com`, `.a@example.com`, `a@-example.com`, `a@example.c`, `a@example.123`, an internationalized local part and 255 characters invalid. Both signup and signin use the explicit email pattern, through `@Matches` on the backend and `.regex()` in Zod. This is a supported syntax policy, not a check that the address exists or can receive mail; internationalized addresses are not supported.

## 4. API and error contract

Prefix `/api`. All mutations require `Content-Type: application/json` (logout sends `{}`). Express middleware sets `Cache-Control: no-store` under `/api/auth` and `/api/users` before parsing or other checks, so early failures and 401s carry it too.

Shared request errors: malformed JSON → 400, body over 10 kb → 413, non-JSON mutation → 415, mutation with a disallowed `Origin` → 403, and an exceeded per-IP handler limit → 429. Unexpected failures return a generic 500. The table lists endpoint-specific errors.

| Method & path | Access | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/signup` | `@Public` | `{ email, name, password }` | `201 { user, authenticated: true }` + cookie. Partial failure: `201 { user, authenticated: false }`, no new cookie (§5) | 400, 409 `EMAIL_TAKEN`, 503 |
| `POST /api/auth/signin` | `@Public` | `{ email, password }` | `200 { user }` + cookie | 400, 401 `INVALID_CREDENTIALS`, 503 |
| `POST /api/auth/logout` | `@Public`, idempotent | `{}` | `204`, session deleted, cookie cleared | 503 |
| `GET /api/users/me` | protected | | `200 { user }` | 401 `UNAUTHENTICATED`, 503 |
| `GET /api/health/live` | `@Public` | | `200 { status: "ok", version: GIT_SHA }` | |
| `GET /api/health/ready` | `@Public` | | 200 | 503 |
| `GET /api/docs` | outside production only | | Swagger UI (`/api/docs-json` for the document) | |

User shape, always built by `toUserResponse()`:

```json
{ "id": "string", "email": "string", "name": "string", "createdAt": "ISO-8601" }
```

Error shape, for every error including body-parser failures:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Check the highlighted fields.",
  "details": [{ "field": "password", "messages": ["..."] }],
  "requestId": "..."
}
```

`details` appears only for DTO validation errors. Codes: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `UNAUTHENTICATED`, `FORBIDDEN_ORIGIN`, `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `NOT_FOUND`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`.

Classification rules:

- On protected routes, 401 means only "no valid session". Sign-in answers 401 `INVALID_CREDENTIALS`.
- Database connectivity failures and any session lookup failure return 503 rather than 401. The exception is a session insert failing after account creation: signup reports partial success (§5). Other unexpected errors return a generic 500; detail goes to the logs only, sanitized.
- 429 carries a standard `Retry-After` header (a small `ThrottlerGuard` subclass sets it; the stock guard names it `Retry-After-<throttler>` for named throttlers).
- Malformed JSON is a 400 `VALIDATION_ERROR` without `details`; an oversized body is a 413.

### Request pipeline

1. A middleware assigns a UUID request id (echoed as `X-Request-Id`). Express no-store middleware for auth and user paths, then Helmet, run before parsing.
2. JSON body parser with a 10 kb limit; Nest's default parser is disabled. An Express error handler registered immediately after the parser formats its errors before production static serving can turn them into 404s.
3. Module middleware on every route: JSON-only check on mutations (415), then the `Origin` allowlist (403). These also run for unmatched routes, so they apply before a 404.
4. Throttler guard, then the global session guard (skipped by `@Public()`), then `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` with an `exceptionFactory` producing our shape, then the controller and the mapper.
5. The global exception filter formats the remaining errors. It shares classification and response formatting with the parser error handler. The early-failure cases run in both normal and production configurations.

### Other rules

- Throttling: each API handler has its own default 100 req/min bucket per IP; signup and signin each also have a separate 10 req/min bucket. Limits come from env (`THROTTLE_GLOBAL_LIMIT`, `THROTTLE_AUTH_LIMIT`) so the e2e app can raise them. Tests use the real limits to assert 429 + `Retry-After`, including a flood on `/users/me` being rejected before authentication runs. Static files, Swagger and unmatched routes do not pass through these guards.
- Mongo connection: `serverSelectionTimeoutMS: 5000` and `bufferCommands: false`, so a dead database fails fast with 503 instead of hanging. Safe because startup awaits the connection before listening.
- `trust proxy` is a hop count from `TRUST_PROXY_HOPS` (default 0), never `true`.
- pino redacts `req.headers.cookie`, `req.headers.authorization` and `res.headers["set-cookie"]`. Bodies are never logged. Terminus' own logger is disabled because it prints raw error messages.
- Unknown errors are logged through an allowlist: error class name, driver error code (for example `11000`), our error code, request id and stack frames with the message line removed. Raw messages are never logged, because Mongo's duplicate-key message, for example, includes the email.
- `app.enableShutdownHooks()`.
- Production: `ServeStaticModule` serves `frontend/dist` with `exclude: ['/api/{*path}']` (Express 5 path syntax). SPA routes fall back to `index.html`; `/api`, `/api/x` and `/api/users/nope` stay JSON 404s. Outside production no static root is registered, so Vite serves the SPA.
- Swagger is mounted only when `NODE_ENV !== 'production'`.

## 5. Sessions

**Signin / signup success**

1. Generate the token: `crypto.randomBytes(32).toString('base64url')` (43 characters).
2. Store `{ tokenHash: sha256(token), userId, createdAt, expiresAt: now + TTL }`.
3. Only after the new session is saved: if the request carried a well-formed old session cookie, delete that old session. A failure here is logged and ignored; the old session expires on its own. A new token on every sign-in also prevents session fixation. Signup applies the same best-effort retirement step.
4. Set the cookie with `maxAge` = TTL.

If step 2 fails during **signin**, the response is 503 and the existing cookie and session are untouched, so a failed replacement never destroys a working login.

**Partial signup failure:** signup is two writes (user, then session) with no transaction. If the user insert succeeds but the session insert fails, the account exists, so the API says so: `201 { user, authenticated: false }`, no new cookie, error logged. The UI navigates to `/signin` with "Account created. Please sign in." and the email prefilled. A retry of signup gets 409, which is correct. Covered by a failure-injection test on both sides.

**Every protected request (global guard)**

1. No cookie, or a cookie that is not a 43-character base64url string → 401 without touching the database.
2. Hash the token → `findOne({ tokenHash, expiresAt: { $gt: now } })`, then load the user (lean, public fields only).
3. No session or no user → 401. Any lookup error → 503.
4. Attach `{ userId, sessionId, user }` to the request; `@CurrentUser()` reads it.

**Logout:** well-formed cookie token → `deleteOne` by hash → clear the cookie → 204. Idempotent: no cookie or an unknown token still returns 204. If the delete fails the response is 503 and the cookie is **not** cleared; the UI says "Logout not confirmed" and keeps protected content hidden until a retry succeeds. It never pretends to have logged out.

**Why SHA-256 for tokens and argon2 for passwords:** the token has 256 bits of randomness, so brute force is infeasible and a fast hash is enough. Passwords are low-entropy and need a slow, memory-hard hash.

**Expiry:** the query checks `expiresAt` itself, so a session dies on time. The TTL index only cleans up old records; Mongo's TTL monitor runs about once a minute and can lag. Reading a session never extends it.

**Timing:** for an unknown email, signin verifies the submitted password against a precomputed dummy argon2 hash. This narrows the timing difference between "no such user" and "wrong password"; it does not make whole requests identical.

## 6. Data model

`users`

| Field | Notes |
|---|---|
| `_id` | exposed as `id` |
| `email` | **unique index**, stored normalized |
| `name` | |
| `passwordHash` | `select: false`; loaded only by the sign-in query |
| `createdAt`, `updatedAt` | Mongoose `timestamps` |

`sessions`

| Field | Notes |
|---|---|
| `tokenHash` | **unique index** |
| `userId` | indexed (enables "log out everywhere" later) |
| `expiresAt` | **TTL index** with `expireAfterSeconds: 0` |
| `createdAt` | |

Email uniqueness is enforced by the unique index, not by a "find then insert" check, which races under concurrent requests. Only a duplicate-key error (`11000`) whose `keyPattern` includes `email` maps to 409; any other database error is a 503 or 500. Both services await `Model.init()` on module init so the indexes exist before the first request.

## 7. Frontend

Routes: `/` → `/app`; `/signin` and `/signup` behind `PublicOnlyRoute`; `/app` behind `ProtectedRoute`; `*` → 404.

Auth state: `checking → authenticated { user } | unauthenticated | unavailable`.

- On mount, `GET /api/users/me`: 200 → authenticated, 401 → unauthenticated, network error or any other status → unavailable (retry screen, no redirect). The bootstrap request is aborted on unmount so a StrictMode remount does not queue a duplicate behind it.
- Guards render a neutral loader while `checking` and never redirect early. Both guards show the retry screen when `unavailable`, because the forms cannot work without the API either.
- Stale-response guard: a generation counter increments on every check, sign-in, sign-up and logout; a `/me` response that started under an older generation is ignored, so a late bootstrap cannot overwrite a fresh sign-in.
- Mutations are never retried automatically.
- The API client sends `Content-Type: application/json` on every body, uses same-origin credentials, and distinguishes `ApiError` (an HTTP error with the backend's shape) from `NetworkError` (no HTTP answer).

Forms and accessibility:

- React Hook Form with `zodResolver`, `mode: 'onTouched'`. Server `details` are mapped onto known fields only; a 409 lands on the email field; other errors go in an `Alert` with `role="alert"`. On a 5xx the message blames the service, not the credentials.
- Submit is disabled with a spinner while pending. Input is kept on recoverable errors.
- Every input has a `<label>`, `aria-invalid` and `aria-describedby`; the password requirements checklist is linked as the field's description and updates live. Focus moves to the first invalid field. The show/hide toggle is a labelled button with `aria-pressed`.
- `autocomplete`: `email`, `name`, `new-password` (signup), `current-password` (signin).
- Works keyboard-only and down to 360 px wide. No `dangerouslySetInnerHTML`; the name is rendered as text.

## 8. Test strategy

Backend e2e (`backend/test/*.e2e-spec.ts`) run the same `createApp()` as production against a real in-memory MongoDB 8.0.32:

- HTTP policy: a shared case list checks 415, 413, malformed JSON 400 and foreign `Origin` 403 in both normal and production configurations, including `no-store` on early auth and user-path failures. Also checks JSON 404, Helmet headers, the error shape with request id and `/health/live` reporting `GIT_SHA`.
- Log redaction: a marker inside a thrown error's message, the cookie, the `Authorization` header and a request body never reach the logs; a raw duplicate-key error logs `code: 11000` but never the email.
- Signup: cookie attributes, argon2id parameters, only the token hash stored, normalization, every shared vector, unknown fields, wrong types, operator objects, 409 leaving the account byte-identical, five concurrent signups → exactly one 201, partial failure → `authenticated: false` with no cookie.
- Sessions: signin success, wrong password ≡ unknown email, every signup-valid password signs in, looser sign-in rule, session replacement, failed replacement keeps the old login, `/me` 401 cases (none, malformed without a DB call, unknown, expired by direct DB update, user deleted), no extension on use, logout + replay 401, two sessions independent, idempotent logout, logout 503 keeps the cookie, `no-store` on auth and `/me` responses including errors.
- Throttling with the real limits: 11th signin → 429 with `Retry-After`; signup likewise; logout unaffected; 101st `/users/me` → 429 before the session guard.
- API docs: UI and document outside production, 404 in production.
- Production serving: SPA fallback, assets, `/api*` JSON 404s, `__Host-session; Secure` cookie works on `/me`.
- Database outage: `mongod` stopped under a running app → `/me`, signin and logout are 503 (logout keeps the cookie), readiness 503, liveness 200. The tests assert statuses and cookie handling; the 5 s server-selection timeout is configuration, and is why these requests answer instead of hanging.

Backend unit: `PasswordService` (parameters, salting, exactness, dummy path), `UsersService` (only E11000 on `email` → 409), `SessionGuard` (cookie format checked before the DB, 503 on lookup failure), cookie settings per environment and cookie parsing, environment validation (defaults, conversions, `ALLOWED_ORIGINS` required and well-formed in production).

Frontend (Vitest + Testing Library):

- Validation: the Zod schemas against the shared vectors, including normalization, the ASCII email policy and code-point length for names and passwords.
- Sign-up form: field errors with focus and ARIA wiring, the live checklist, the show/hide toggle, the normalized request body, a 409 landing on the email field, server `details` mapped to known fields only, and `authenticated: false` leading to `/signin` with the notice.
- Sign-in form: success, the generic 401 message, the pending state, the 503 wording, and autocomplete attributes.
- Routing: loader without redirect while checking, redirect on 401, retry screen on 503, 500 and network failure, retry working, public-only redirect, and the 404 page.
- Session races: a slow `/me` resolving after a sign-in or after a logout is ignored; failed mutations are not retried.
- App page and logout: the exact greeting with an XSS-looking name rendered as text, the logout request shape, and a failed logout that hides content until a retry succeeds.

Coverage percentage is not a target; the behaviours above are.

## 9. Production next steps

The items deliberately left unbuilt, each with the trigger that would make it worth building, are listed in the README under "Production next steps".
