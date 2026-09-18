# Profile security gate — review before rollout

## Root cause and correction

Owner-row RLS restricts *which row*, not *which column*. Broad INSERT/UPDATE grants
allowed owners to supply `plan`; broad SELECT exposed `date_of_birth`. The new
`20260918211553_profile_column_security.sql` revokes table and pre-existing column
privileges, then grants a positive list. Own-row policies remain in effect.
No rows/columns are deleted and no stored plan/date values are rewritten.

Client SELECT: professional fields, legacy plan and timestamps, excluding birth
date. Client INSERT: own ID and editable professional fields. Client UPDATE:
editable professional fields only. No client DELETE/TRUNCATE. Unknown future
columns are not automatically included. Service-role privileges are unchanged.

`PROFILE_FIELDS` aligns both auth profile hydration and public profile lookup
with the database projection. Other profile callers already use explicit safe
fields. The public Profile TypeScript type no longer promises a private date.
Birth-date editing is not currently implemented; even the owner's browser cannot
read/write it with this gate. Future private personal-data access requires a
separate owner-scoped design, not reopening public SELECT.

Department-discussion UI now calls `can_create_department_chat(auth user id)`.
The existing RPC enforces the same trusted permission independently at creation.
Errors, malformed truthy values, logout and late previous-account replies cannot
enable the UI. PRO is not verification or a trusted discussion permission.

## Evidence

- 34 tests, typecheck, build and diff checks pass; lint: 0 errors, 6 warnings.
- Actual migration SQL is executed by PGlite (PostgreSQL WASM), with Supabase-like
  roles/default grants and `auth.uid()` fixture. Profile/permission/chat foundation
  migrations 001/002/004/006/009/010/011 are replayed before this correction.
- Tests seed explicit old column grants and apply the correction twice.
- Anonymous/private-column SELECT, wildcard SELECT, WHERE and ORDER BY denied.
- Owner plan UPDATE/INSERT/UPSERT, ID/timestamp changes and foreign-row writes denied.
- Normal bootstrap and safe profile save work; birth dates and old plans survive.
- Service-role access preserved; explicit permission grants/revocation tested;
  client self-grant and querying another person's permission rejected.
- Hook tests cover strict true, RPC error, network rejection, logout and stale replies.
- Live read-only metadata confirms the expected 14 profile columns, no public
  views and no functions returning profiles or explicitly mentioning birth date.
  This is not a proof against every dynamically constructed SQL endpoint.

## Rollout order / manual acceptance

1. Review migration and permissions; confirm the live schema/grants have not drifted.
2. Deploy frontend explicit projections first (compatible with old schema).
3. Apply only after database review and a verified backup/recovery procedure.
   This work did NOT apply it to the hosted Supabase database.
4. Test signed-out public profile, login/refresh, onboarding, own profile save,
   and two-account permission behavior against the deployed PostgREST API.
5. Observe profile errors from stale browser bundles using SELECT *. Refresh those
   bundles; do not restore public birth-date access to accommodate old clients.

Prefer rolling forward. Rolling the frontend back to wildcard reads after this
migration will break profile hydration (but must not fake logout). A DB rollback
that restores blanket grants would reopen the vulnerabilities and is not supplied.

## Remaining gates

- Historical `plan='pro'` may have been self-assigned. Do NOT backfill paid
  entitlements from it or claim a payment was verified; build server-owned evidence.
- This change does not reconcile the restored 011 with production chat RPCs,
  legacy write lockout, ordering/backfill, or Realtime publication configuration.
- The test is not a full Supabase stack/PostgREST/Realtime acceptance test or replay
  of every migration. No production accounts were changed or created.
- Broader profile/contact/privacy, actor duplicate identity and other table RLS
  remain separate audits. Existing npm audit: 21 vulnerabilities (unchanged).
- CLI v2.117.0 could not initialize its out-of-workspace user directory. Migration
  was generated successfully with CLI v2.81.3; no user-directory permissions changed.

Reference: [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).
Reviewed changelog: no relevant breaking changes for these PostgreSQL GRANT/REVOKE operations.
