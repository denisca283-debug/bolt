# FilmVerse epic — first review packet

## Continuation: profile security gate (prepared, NOT applied to live DB)

New migration `20260918211553_profile_column_security.sql` removes client writes
to legacy `plan`, ID updates and server timestamps, and removes all client reads
of `date_of_birth`. Existing values are retained for trusted server access.
Frontend profile reads now use an explicit allowed projection. Discussion creation
uses the existing trusted-permission RPC instead of PRO plus verification count.
See [rollout and review](profile-security-review.md) before deployment.

Validation: 34 tests pass, including PGlite PostgreSQL grant/RLS adversarial tests
and permission-hook account-switch races. Typecheck/build pass; lint has zero
errors and the same six warnings. Production risks below remain live until the
reviewed migration is applied. No merge or production data mutation performed.

Next: resolve historical 011 replay/live drift, then implement phases 4–5
(persisted resume and server-owned entitlement records). This gate is not a claim
that those phases, the whole migration chain, or production acceptance are done.

## Original foundation packet

This is a partial delivery, not completion of phases 0–68. No merge or live database
mutation was performed in this packet. The previous working directory is intact.

1. **Branch:** epic/filmverse-foundation-review, based on PR #2 c3ddf46.
2. **Phase commits:** 5c62994 audit/plan; 21a0d34 auth/config; a4296d0 ModalShell;
   b43dcac global vacancy scope; 07da0d4 build-time privileged-key rejection.
3. **Files:** auth provider/classifier/modal, Supabase config validator/client,
   Vite config, AppShell, ModalShell, CreateDialog, NewChatDialog, PublishMenu,
   package/lockfile, six test files, modal browser harness, audit/master epic/docs.
4. **Migrations:** none created; existing 011 preserved. Its replay/live drift is
   documented in foundation-audit.md and must be corrected with a NEW migration.
5. **Tables:** no changes.
6. **RLS:** read-only live review. Critical findings: own profile INSERT/UPDATE
   permits plan; anon SELECT permits full birth date; broad public content reads.
   No permissions were changed on production.
7. **RPC:** no changes. Live chat_list/chat_unread_total exist but PR-restored 011
   does not reproduce them; additional security grants/publication setup differ.
8. **Routes/screens:** existing routes retained. Auth/create/new-chat/global
   publish dialogs use ModalShell. No new product routes yet.
9. **Auth:** session-only identity, race-safe hydration, signup privacy including
   duplicate errors, distinct profile states, visible logout/profile errors,
   recovery event routing preserved. SDK boundaries tested; real emailed-link and
   two-account browser acceptance remain outstanding.
10. **Vercel:** valid public variables accepted; missing variables render explicit
    deployment failure; supplied invalid/server keys fail before bundling.
    Actual Vercel environment configuration not modified or certified.
11. **Actor profile:** existing public profile remains; enriched safe actor
    representation not implemented.
12. **Actor search:** existing browser filtering/unbounded reads remain.
13. **Resume:** still routes to profile; persisted publication and entitlement flow
    not implemented. Phase 3 is only the global menu scope, not phase 4.
14. **Crew Builder:** not implemented.
15. **Casting Room:** not implemented.
16. **Messaging:** current PR branch polling implementation remains. Older local
    RPC/Realtime implementation is preserved for deliberate integration.
17. **Project chats:** not implemented; require project membership/assignments.
18. **Marketplace:** existing dedicated create/list/detail/delete flow retained;
    dialog viewport fixed. Owner lifecycle/edit/attributes pending.
19. **Personal Cabinet:** not implemented.
20. **Favorites:** not implemented.
21. **Pulse:** current real rows retained; typed actionable targets pending.
22. **Verification:** current pending request flow retained; secure evidence/review
    and approved public projection pending. Existing PRO-related copy needs correction.
23. **Test users/data:** no accounts created or live content seeded.
24. **Tests:** 26 automated tests pass; typecheck/lint/build/diff checks pass.
    Lint has six warnings, zero errors. Browser harness tested at 1366×768 and
    390×844; header close stays visible at last field and restores trigger focus.
    Deliberate build with a dummy sb_secret key correctly fails before bundling.
    npm ci succeeds with isolated cache. No Playwright E2E suite exists yet.
25. **Mocks:** HomePage, NotificationsPage and ActorProfilePage import mock data;
    real-actor slug routing exists but fallback must be removed.
26. **TODOs:** phases 4–68, SQL convergence, full live phase-1 acceptance, new
    dialogs must adopt ModalShell as they are introduced.
27. **Payments:** no provider/prices invented; server-owned entitlement model and
    real payment adapter still required.
28. **Security risks:** migration replay drift, client-writable plan, public birth
    dates, unreviewed project privacy/contacts, no abuse controls. Supabase advisor
    warns leaked-password protection disabled. npm reports 21 dependency
    vulnerabilities (3 low, 5 moderate, 13 high); no blanket force-upgrade applied.
29. **Performance risks:** unbounded actors/professionals, 8-second message polling,
    broad SELECTs. These findings block a claim of production readiness.
30. **Next:** architectural review of this foundation packet and the recorded SQL
    drift; implement convergence migration with replay/RLS tests, then persisted
    resume with server-owned entitlements. Continue the phase plan, without merging
    high-risk auth/database changes automatically.

Security advisor references:
[privileged callable functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
