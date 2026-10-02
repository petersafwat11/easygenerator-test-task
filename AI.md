# How I used AI on this project

## 1. AI-assisted work

I used AI assistants for requirements analysis, planning, critique, implementation and review. They wrote most of the backend, frontend, tests, Docker and CI configuration, and documentation. I set the scope and acceptance criteria, chose the main design decisions, reviewed the changes between phases, and directed verification. The assistants also diagnosed problems and corrected their own work; the examples below give them that credit.

The backend work included DTO validation, password hashing, sessions, HTTP policy, logging and error handling. The frontend work included the forms, API client, auth state and route guards. Tests were generated from the behaviour contract, then reviewed for whether they could actually catch regressions.

## 2. Approaches that worked

Before implementation, I worked through the brief with an assistant and wrote a plan with decisions, rejected alternatives, API contracts, validation vectors and phase gates. That made the build easy to supervise: the assistant was working to a spec, not inventing one.

These were the useful prompt patterns, paraphrased rather than copied from the conversations:

- Generate options with trade-offs for each decision, then argue against the option I choose. This helped me check the cost of sessions, transactions and extra infrastructure before committing to them.
- Review the plan against specific failure cases: copied cookies after logout, concurrent signups, database outages, cookie misconfiguration, and the SPA fallback swallowing API errors. I adopted the gaps the review found and kept larger changes out of scope.
- Implement one phase against its written gate, run the checks, and record deviations and uncertainties. The assistant worked autonomously through the build phases; I reviewed the diffs and log between phases.
- Prove a regression test can fail by removing the code it protects. This caught a stale-response test that had been passing for the wrong reason.

## 3. Decisions I made or adapted

The brief makes logout optional. I included it and required server-side revocation: replaying the old cookie must fail. That led to opaque sessions stored as token hashes rather than a stateless JWT. Each valid protected request pays for a session lookup and a user lookup.

Signing the user in immediately after signup was also my choice. I kept the two database writes without a transaction, and required an explicit partial-success response if the account exists but its session could not be saved. The UI then sends the user to sign in.

From the plan review, I adopted JSON-only mutations, an Origin allowlist, deny-by-default API handlers, a separate unavailable state for outages, excluding API paths from the SPA fallback, and deriving cookie security from `NODE_ENV`. I kept Redis, refresh-token rotation, replica-set transactions and a shared contracts workspace out of this submission because the app did not need them at this size. The alternatives and costs are in [the design document](docs/design.md); the README lists when to revisit them.

I defined the password rules where the brief was silent: Unicode letters, ASCII digits, Unicode punctuation or symbols, and length in code points. Email now uses one explicit ASCII pattern on both sides; internationalized addresses are outside the supported policy. The rules are copied between the two apps, with identical vectors in both suites to check agreement.

## 4. Corrections and rework

- **Origin configuration:** the assistant flagged that production could boot without its allowlist. A follow-up review found that Joi also skipped parsing the development default, leaving a string where the middleware expected a list. The fix parses the default explicitly, validates each origin, requires the setting in production, and tests the schema.
- **A test that could not fail:** the assistant removed the stale-response guard and found the test still passed because its substring match accepted both `authenticated` and `unauthenticated`. It changed the assertion to an exact match and checked it with the guard removed and restored. I made that check a standing rule for regression tests.
- **Scaffolding and test tooling:** the scaffold default used a different module and test setup from the plan. The assistant re-scaffolded with NestJS 11 to keep the planned Jest and ESLint setup. It also diagnosed the database driver's dynamic import in Jest and adjusted the test command.
- **Validation drift:** the final review found email addresses accepted by the backend but rejected by the frontend. Both sides now use the explicit pattern, with additional vectors for the cases that differed. This also makes the ASCII email limitation explicit.
- **Production-only HTTP errors:** tests in the normal configuration missed the static-file module turning parser failures into 404s in production. An Express error handler now answers malformed JSON and oversized bodies before that module can change their status. The no-store middleware also moved before parsing, so early auth errors carry it. A shared case list runs in both configurations.
- **Development outage behaviour:** a StrictMode remount queued a second session check behind the first and delayed the retry screen. The assistant diagnosed it, aborted the bootstrap request on unmount, and re-measured the result.

## 5. Verification and remaining limits

I had the automated checks and manual runs executed and reviewed their results. The automated suites cover validation, concurrent signup, partial signup, session replacement, revocation, expiry, outages, redaction, routing and frontend races. They use the same app factory as production, including tests with production static serving enabled.

The manual runs covered the acceptance criteria in a browser, a second client for independent sessions, a short session lifetime checked before and after expiry, API and database outages, and the production cookie and routing behaviour. A clean-clone run was completed during the earlier review. The final pre-push checks were run in the existing checkout. Tracked files and Git history were also checked for private files and secrets.

I have not done a screen-reader pass, a password-hashing load test, or a manual failure-injection run for account creation without a session; that last path is covered by backend and frontend tests. Email verification and shared rate limits remain production next steps. These checks give evidence for the documented behaviour, rather than a claim that every deployment condition has been tested.

Tools used: chat assistants for planning and critique, an agentic coding assistant for implementation and review, and the framework scaffolding commands.
