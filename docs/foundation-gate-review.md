# Final foundation gate — architectural review, not production rollout

## Scope and root causes

Branch: epic/filmverse-foundation-review. Accepted messaging convergence retained;
historical 011 and convergence migration are unchanged. No main merge, production
migration, live grants, seed users, checkout, Resume/Skills/Crew UI or data deletion.

Auth previously treated a getUser transport failure like an invalid token. It now
preserves only an unexpired SDK session, warns non-destructively, and retries on
online/manual action. Structured invalid-token/session errors fail closed. Token
expiry is not extended. Auth revisions prevent stale validation/hydration from
undoing sign-out or token replacement. SDK SIGNED_IN storage/visibility events
also validate: they can arrive before getSession resolves. Profile failures stay
independent, visible, and never become authentication or duplicate-profile inserts.

Owner RLS alone did not protect privileged profile columns; public projection
still included plan. The pending positive-list grants and PROFILE_FIELDS now
exclude plan, birth date and onboarding_completed. Public columns are exactly:
id, full_name, public_slug, city, country, gender, avatar_url, about,
availability_status, created_at, updated_at. Client writes cannot change plan,
IDs after creation, server timestamps or future columns. Allowed onboarding writes
remain; private reads require a separate intentional owner/server path.

## New migration / authority

20260918215308_foundation_privacy_entitlements.sql:

- Internal user_permissions: authenticated own-row positive-list SELECT only;
  anon and cross-user access denied, browser mutations denied. Existing permission
  rows retained, including founder-like grants. Trusted service_role retains access.
- account_entitlements: pro/resume_publication; subscription/one_time/admin/test
  sources; active/revoked; start/expiry; nullable remaining_uses for PRO and bounded
  nonnegative uses for publication; server timestamps; payment-source reference
  required and unique with source/code. No unstructured metadata needed yet.
- Client reads own effective rows only (active, started, unexpired, non-exhausted).
  Source/reference/internal fields withheld. No client INSERT/UPDATE/DELETE/TRUNCATE.
  Only trusted service/admin infrastructure grants or revokes. No browser admin
  mutation endpoint or email allowlist. NO backfill from profiles.plan.
- Founder permission access is preserved, not automatically converted to PRO.
  Trusted admin may issue an explicit admin/test entitlement after review. No real
  grant was issued in this packet. Payment adapters, audit actor provenance and
  atomic consumption are required before any paid/publication action exists.
- Pulse browser INSERT must have auth.uid() ownership, including a restrictive
  guard. NULL-owner system events require trusted service access.

Existing Settings reads the new own-entitlement path; failure is visible, never
silently interpreted as free access. This is display-only, not paid authorization.
PRO and verification count never authorize professional discussions:
UI + database creation RPC use create_professional_discussion.

## Database verification

53 tests pass via npm test, including PGlite PostgreSQL execution of every SQL
migration in filename order through the newest migration. Auth/storage fixture
schemas stand in for Supabase infrastructure; this is not a full hosted stack.
Convergence reapply is safe, history/read cursors retained, direct pair unique,
group creation atomic. A/B/C/D tests deny outsider read/send/join/rename/manage/
mark-read; members read/send; owner rules and leave/revocation hold.

All eleven required chat helpers/RPCs verified for fixed search_path, auth.uid()
checks where applicable, client EXECUTE boundaries and inaccessible internal
trigger helper. Canonical writes remain chat_rooms/chat_members/chat_messages.
Legacy conversations/messages retained with client writes revoked. Export,
reconciliation/count checks, reviewed migration and rollback rehearsal must precede
future legacy removal. No historical data is silently chosen, rewritten or dropped.

Publication metadata contains exactly the three canonical chat tables and survives
reapply. This DOES NOT prove websocket delivery. Populated pre-011 databases still
need separately reviewed repair/preflight: historical 011 may fail before a later
correction can execute. See messaging-convergence-review.md.

## Browser evidence / limits

Added Playwright suite: 6 scenarios × desktop 1366×768/mobile 390×844. Uses fixture
sessions and intercepted requests, no production credentials or email delivery.
Local standalone Chromium cannot launch (macOS bootstrap_check_in permission
denied); twelve launch failures are infrastructure failures, NOT twelve passes.
Secret-free GitHub Actions workflow prepares an independent Linux browser run.

In-app browser manual checks of isolated browser-harness confirmed: temporary
getUser failure retains authenticated Settings plus warning; online retry clears
warning; logout prompts guest login; invalid token gives guest; profile DB failure
keeps authenticated UI with visible error; recovery fixture opens password form.
No real password was entered/changed. ModalShell 35-field harness: X/Esc/overlay,
focus restoration, background lock and inner scroll passed at both requested
sizes. Close bounds: desktop y41..77 within768; mobile y51..87 within844.
Real vacancy CreateDialog last textarea also retains visible X at both sizes;
no vacancy was submitted. Harnesses are test-only, absent from the production build.

## Checks / remaining risks

npm ci, typecheck, lint, npm test, build and diff --check pass. Lint: zero errors,
six existing warnings. npm audit: 21 vulnerabilities (3 low/5 moderate/13 high);
no unrelated blanket dependency upgrade attempted. No secrets or dist committed.

Live read-only audit still shows old broad profile grants, public permission
visibility and Pulse NULL-owner policy: fixes are NOT deployed. Supabase advisor
reports eight intentional client-callable SECURITY DEFINER functions for review
and disabled leaked-password protection. Links:
[function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Other-table privacy, payment abuse controls and full live acceptance are not
certified here. Existing polling/mock content are not redesigned in this packet.
Ready for architectural REVIEW, not authorization to start Resume/Skills/Crew
Builder: await review and browser/live acceptance. No merge or production apply.
