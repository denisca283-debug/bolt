# Messaging schema convergence — pending database review

## Scope

`20260918212540_messaging_schema_convergence.sql` is a new post-011 migration.
Existing migrations are unchanged. Live database was inspected read-only, never
mutated. No UI features or polling implementation were changed in this step.

The restored repository 011 lacked the deployed `chat_list` / `chat_unread_total`
functions, table/sequence privilege restrictions, public schema CREATE restriction
and Realtime registration. This correction supplies those missing boundaries:

- RLS-protected SECURITY INVOKER list/search (50 rows) and unread-count RPCs.
- Canonical tables: authenticated SELECT only, writes through existing checked RPCs.
- Old conversations/messages retained and readable by their participants, no new
  client writes. Anonymous grants removed (stricter than deployed grants; guest
  messaging is not supported). Column-level write grants are revoked as well.
- Replaces canonical table policies with the three reviewed membership SELECT
  policies; own membership tombstones stay readable for removal notifications.
- Revokes client CREATE in public, sequence access and permission-table writes.
- Registers the three canonical tables in existing `supabase_realtime` publication.
- Fails atomically on missing publication or inconsistent direct memberships.
- No sequence renumbering, receipt reset, row deletion or room merging.

## Security review and tests

Full chronological replay of repository migrations passes in PGlite PostgreSQL.
The complete suite contains 42 passing tests. Node 23 test-worker startup hung
with PGlite on this host; the runner now executes each test file in a fresh direct
Node process, sequentially, with a 60-second timeout and propagated failure status.
No tests are skipped. Typecheck/build pass; lint retains six warnings, zero errors.
Fixture provides Supabase roles, auth.uid and minimal Storage catalog: this is not
a full hosted Supabase/PostgREST environment. Schema SQL itself is not mocked.
Tests cover A/B/C/D: unique pair reopening, idempotent send, last-message search,
unread/read monotonicity, group atomicity, removal, owner transfer, foreign-room
read/join/send/rename/read-receipt denial, old-system write denial, schema CREATE
denial and preserved historical rows/read sequences. Missing publication and
ambiguous membership abort without data loss. Reapplying correction is safe.

Existing SECURITY DEFINER write RPCs are retained, with auth.uid/membership checks,
fixed search_path and explicit execute grants from 011. Their public-schema lookup
now has schema CREATE revoked from untrusted roles. New read functions do not
bypass RLS. No user_metadata or payment flag is used as authorization.

Live advisors still flag intentionally authenticated
[SECURITY DEFINER APIs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
and the previously reported password-protection configuration. This inspection is
not a post-deployment certification: migration has not been applied remotely.

## Important legacy upgrade limitation

This migration supports clean replay and environments where 011 already completed,
including the inspected live database. The restored historical 011 itself can fail
on a populated 010 database: it adds a direct-pair CHECK before filling pair columns.
A later migration cannot fix an earlier failure. Do not run that upgrade blindly
or edit the already-applied 011. Such environments need a backup plus separately
reviewed pre-011 data repair in a maintenance transaction. Duplicate/ambiguous
rooms must not be auto-deleted. The production ledger is already past this point.

Historical order/backfill differences cannot be safely resolved by renumbering
existing message seq values. This correction deliberately preserves them; inspect
imported histories independently if such an environment is discovered.

## Rollout gates

1. Confirm migration ledger is at 011+, back up and review existing extra policies.
2. Deploy profile explicit-projection frontend before preceding profile-security migration.
3. Apply reviewed pending migrations in order; five-second lock timeout aborts rather
   than waiting indefinitely. Investigate timeout; do not blindly retry under load.
4. Run adversarial API tests in staging with explicit test accounts.
5. Verify websocket delivery/removal with two real browsers. Publication metadata
   checks do NOT prove delivery. Current frontend polling remains a later task.

Reference: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).
No merge or production migration was performed by this task.
