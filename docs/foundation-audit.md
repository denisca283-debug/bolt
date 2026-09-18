# Phase 0 — foundation audit, 2026-09-18

## Source of truth and preservation

Remote main: 33ad895. Open PR #2: c3ddf46, fix/vercel-auth-deploy.
Working branch epic/filmverse-foundation-review starts at the PR head, preserving its
deployment guard, session-only auth direction, password-recovery routing, publish
menu and migration history. The previous filmverse-staging worktree remains dirty
and untouched; its stronger auth classifier/provider tests are ported deliberately.
PublicationForm/usePublications/publications and unpublished chat work remain there.
No single checkout is newest in every area.

The complete requested epic is preserved in master-epic.md. Work proceeds by phase,
with checks and commits. No automatic merge of database/auth/RLS changes.

## Findings from code and live read-only metadata

| Area | Evidence | Required correction / phase |
| --- | --- | --- |
| Auth | PR getSession can finish after SIGNED_OUT; logout ignores SDK errors; bootstrap promises can reject; repeated signup error reveals account existence | Port tested classifier and race protection, preserve recovery event routing; phase 1 |
| Deployment | PR placeholder invalid client is still constructed; malformed URL can crash before error UI; privileged key not rejected | Validate public credentials and prevent client construction when invalid; phase 1 |
| Migration drift | PR's restored 011 is not the historical SQL. Live has chat_list/chat_unread_total and read-only grants; restored 011 lacks both functions, schema CREATE revocation, legacy write lockout and Realtime registration | Preserve old migration; new convergence migration and replay tests before expanding schema |
| Chat | Current branch MessagesPage uses setInterval(8000), direct table reads; older local branch has richer tested RPC/Realtime implementation | Integrate carefully at phases 34–43 after migration convergence |
| Profiles | profiles_public_read USING(true), including date_of_birth and plan; owner grants require column-level audit before plan can grant paid value | Safe public projection and server-owned entitlement source before resume paywall |
| Profile save | Multiple sequential profile/profession/skill/actor writes; partial failure can leave inconsistent data | Transactional save or explicit recoverable partial state |
| Actors | Real actors with slug route to public profile; missing-slug fallback reaches ActorProfilePage importing mock actors. Identity duplicated between actors/profiles | Safe canonical public actor profile and real ID fallback; phase 12 |
| Search | Actors and professionals load unbounded data, filter in browser; missing error handling can appear as empty list | Server filters/pagination/indexes; phase 13 |
| Publish | PR correctly limits global picker to vacancy/resume, but resume routes to profile | Dedicated persisted resume plus entitlement; phases 3–5 |
| Dialogs | Publish/Create/NewChat use independent fixed overlays; long forms have inconsistent viewport/focus behavior | One ModalShell; phase 2 |
| Marketplace | Real listings/create/detail/delete exist; owner edit and publication lifecycle missing | Preserve dedicated create flow; phase 11 |
| Projects | Flat project rows and public SELECT; no project_members/assignments/roles/private contact model | Normalized project authorization before any project chat |
| Verification | Pending request persistence exists; evidence bucket/reviewer UI absent; text still claims PRO + two verifications enables department chats | Explicit permission, private evidence and reviewer RPC; phase 50 |
| Pulse | Real feed rows but text targets; owner insert permits null user_id | Typed target references and tighter insert; phase 54 |
| Notifications | Page imports mock notifications; chrome includes static badges | Database-backed event notifications; phase 56 |
| Permissions | Live grant tables have no client writes; user_permissions readable publicly | Retain no-self-grant boundary; reduce public grant exposure |
| Storage | Only avatars bucket in migrations: public read, own UID folder insert/update/delete | Never upload verification evidence here; dedicated private bucket required |
| Organizations | Membership policy recursively reads organization_members, ownership scope needs separate adversarial tests | Do not reuse blindly for project access |
| Tests | PR has no test script; prior worktree has useful auth and PostgreSQL tests | Port relevant tests and add regression cases |

Live read-only audit: migration ledger includes 001–011 and work_profession_targeting.
chat_rooms/conversations/messages grant authenticated SELECT only. Canonical RLS
is enabled; RPCs exist in live DB. Advisor reports intentional authenticated
SECURITY DEFINER APIs and disabled leaked-password protection. It does not prove
the fresh migration replay equals production.

## Implementation order and review gates

1. Phase 1: preserve PR #2 and strengthen session races, signup privacy,
   recovery handling, deployment config and regression tests.
2. Phase 2–3: accessible viewport-safe modal shell; migrate actual long dialogs;
   test desktop/mobile close, focus, scroll, overlay and Escape.
3. Before phase 4: reconcile live vs replayed schema in a NEW migration;
   lock server-owned subscription/entitlement fields; private/public projections.
4. Phases 4–13: persisted resume, payment adapter without fake checkout, taxonomies,
   cabinet/favorites/marketplace, actor data/search.
5. Phases 14–33: projects/positions, member+assignment canonical authorization,
   templates, candidate pipeline and private casting.
6. Phases 34–49: canonical personal messaging first, then assignment-derived
   project rooms and announcements, with atomic revocation tests.
7. Phases 50–68: verification/reviewer rights, explicit seed tooling, actionable
   pulse/notifications/applications, production scenarios, performance and CI.

Each completed phase must have typecheck/lint/tests/build/diff review and its own
commit. SQL changes require replay and adversarial RLS tests. Live user journeys
require explicit test accounts; passing mocks is not live acceptance.
