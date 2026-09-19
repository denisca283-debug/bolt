# PR6 + PR7 architectural correction review

PR5 remains frozen at `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. No merges, deployments, live Supabase mutations or production SQL. Only the two never-applied corrective migrations below are amended in the final micro-correction, as explicitly authorized; every earlier migration remains unchanged.

## Stack

- Corrected PR6: `1e28755554974db1d2c8af9e7fb73514d46e97ac`, `epic/production-network-foundation`.
- PR7: `epic/sourcing-ai-foundation`, rebased on that exact corrected PR6 head. Old PR7 history is preserved in backup/pr7-before-architecture-correction-20260919; final remote SHA is reported with the PR, rather than embedding its own commit hash here.
- New PR6 migration: `20260919040959_production_network_authority_correction.sql`.
- New PR7 migration: `20260919042407_sourcing_commercial_authority_correction.sql`.

Migration execution order is chronological, not commit order: original PR7 migrations 031153/031615 precede the PR6 correction 040959 and PR7 correction 042407. Do NOT apply PR6 separately to any shared environment. Live Supabase precedes PR3–PR7; future staging must apply the complete pending stack in chronological filename order in ONE reviewed plan. No migration renaming or casual repair/include-all shortcuts.

## Final foundation micro-correction

- A: current-only partial uniqueness permits new relationship episodes after end/decline/expiry. Historical terminal rows cannot be updated/deleted; public graph remains current-active and bilateral.
- B (freeze correction): the server-set maximum 30 days is only the pending acceptance window. Accepted candidate authority has no dependency on that deadline; current casting authority, guardian, project consent and matching open/reviewed role/work/project context are revalidated for activation and all updates. Reissue locks context, closes stale pending episodes and creates a new episode; expired/declined history is immutable and explicit decline blocks automatic re-invitation.
- C: database CHECK enforces promotion = sponsored_promotion without monetary/percentage discount; other types allow only possible/confirmed. Tests include trusted service writes.
- D: commercial_offer_discover returns explicit safe columns under session RLS, excluding unpublished/expired/future/private-provider offers. Raw provenance is removed from generic grants; authorized provider management uses a separate provenance RPC, and trusted workers retain access. Eligibility evidence stays private. offers.search maps only to the safe domain result.

Exact files amended in this micro-correction (10):

- PR6: docs/pr6-authority-correction-review.md; docs/professional-graph-architecture.md; docs/young-talent-architecture.md; supabase/migrations/20260919040959_production_network_authority_correction.sql; tests/production-network.test.mjs.
- PR7: docs/filmverse-ai-agent-architecture.md; docs/sourcing-room-architecture.md; docs/pr7-architecture-correction-review.md; supabase/migrations/20260919042407_sourcing_commercial_authority_correction.sql; tests/sourcing-ai.test.mjs.

Previous PR7 head b3dd22326167f9d613fc1a2ebc26f0168177bd0f is preserved at backup/pr7-before-final-micro-correction-20260919. Final remote HEADs and exact verification results are reported in the handoff; no deployment is authorized.

## Final two freeze blockers

Only pending/accepted invitation lifecycle and raw provenance authority are corrected. The latter now requires org_can(provider_organization_id, 'manage_organization') from the existing trusted role model; view_sourcing alone and unrelated company membership cannot read provenance. Current active organization management may read only its own provider records. Safe discovery and private eligibility are unchanged. Previous PR7 c7a10cdfd10e70338c9e9e19ad613f8717a0ce3e is preserved at backup/pr7-before-freeze-blockers-20260919.

Exact files for this final two-fix pass (8): PR6 — docs/pr6-authority-correction-review.md, docs/young-talent-architecture.md, supabase/migrations/20260919040959_production_network_authority_correction.sql, tests/production-network.test.mjs. PR7 — docs/pr7-architecture-correction-review.md, docs/sourcing-room-architecture.md, supabase/migrations/20260919042407_sourcing_commercial_authority_correction.sql, tests/sourcing-ai.test.mjs.

All gates are rerun on the final stack. One previous assertion intentionally changes from denying an accepted, still-consented candidate after its pending deadline to asserting successful activation; new tests independently deny expired pending acceptance and revoked/expired consent, guardian/context failures and declined reissue. No assertions are relaxed to accommodate failures. No accepted graph, referral, sourcing/bid, AI or settlement architecture changes.

## Part A

See [PR6 authority correction](pr6-authority-correction-review.md). Pending creator can edit only the private draft; approved guardian authority/discovery/consent remains separate. Search permission alone cannot open a guardian DM. Contextual invitation requires manage_candidates plus a role/reviewed minor opportunity in the same project; child activation requires guardian acceptance and live consent. Responsible adult needs factual project association, independent reviewed policy and explicit acceptance. Casting permissions are granular, not inherited from general collaboration or historical company creator identity.

Graph confirmation can operate privately. Professional permits company placement; company independently chooses that placement; professional chooses their own placement. Public projections still require public visibility. Typed referral destinations use a bounded payload/trusted internal mapping; old constrained links remain supported. Private casting/sourcing deep links remain hub fallbacks.

## Part B

Buyer authority separates view_sourcing, manage_sourcing, invite_sourcing_participants, evaluate_bids and award_sourcing. Provider authority separates view_sourcing, prepare_bid and submit_bid; active membership plus explicit grants, or current owner authority, is required. Browser cannot write grants or manufacture Commercial Offers/eligibility.

Bid payloads preserve immutable revisions. Canonical totals distinguish item subtotal, mandatory extra costs and complete comparable total. Bounded versioned terms disclose validity, availability, delivery/pickup, included/excluded/unknown tax, deposit/security, insurance, prep/service, mandatory fees, summary, compliance/alternative specification and discount reference. Incomplete historical bids remain readable but cannot win. Deposit/insurance descriptions do not silently hide fees: all mandatory nonrefundable costs must participate in totals. This is supplier-declared commercial evidence, not platform verification of availability/equivalence.

Withdrawal is an append-only record with actor/time/reason. Lifecycle derives active/withdrawn/superseded; award checks current final offer, validity, qualification, complete costs, professional consent and current referenced discount eligibility. Reverse competition and lowest-compliant comparisons exclude alternatives/incomplete offers. Manual best value can explicitly select an alternative without claiming equivalence. Bid/withdraw/award transactions serialize on event locks.

Commercial Offers is a canonical trusted-ingress domain, not an AI-only stub. Types include student/package/volume/partner/project-specific/other and promotion; possible/confirmed/sponsored are distinct. Discount application references require trusted participant-specific eligibility. No automatic savings calculation, provider feed, discount administration UI or verified offer intake is shipped. Exact future offers.search RLS mapping is documented in the AI architecture.

Q&A supports participant questions, private buyer/provider visibility and equal publication. Common-scope changes cannot use private publication; they increment event version and block bidding until acknowledgement/reopen. Supplier identity fields are not exposed by public question projections. Semantic moderation of falsely classified questions remains an operational review obligation; software does not infer scope changes from prose.

AI low/medium/high/critical contract now hard-denies critical execution before gateway invocation, even with approval. Context includes nullable scopes, locale/currency/request ID and server authorization reference. User identity/permission flags are stripped from requests and freshly resolved by a trusted gateway. Tools have stable code/name/version, risk/permission/minor policy, versioned input/output schema references, approval/audit policies and description. No live gateway or schema-validator registry implementation is claimed. Explicit editable constraints and factual evidence provenance/freshness are expanded; no scraping or RLS bypass.

## Part C

See [digital assets readiness](digital-assets-blockchain-readiness.md) and `src/lib/settlementContracts.ts`. Exact currency obligations are independent of rail/asset; policy is jurisdiction/provider controlled. Wallet links confer no identity or permissions. Internal credits remain non-transferable product units. Escrow/milestones, exact-basis-point rights allocations, private-document provenance, salted optional sourcing commitments and regulated-financing boundaries are conceptual only. Public proof wire format excludes private fields. No network, token, wallet login, SDK, custody, smart contract or production financial table was added.

## Explicit security review

- New public relations have RLS, revoked default privileges and positive SELECT grants. Sensitive eligibility is private/service-only.
- Definers use fixed empty search_path and qualified object references; public wrappers are invoker functions. Helpers without direct client purpose are not executable by browser roles.
- Session identity is resolved through auth.uid()/trusted server context; no client role flags or user metadata authority.
- Membership/grants are checked on current state, including provider revocation. Company historical creator is not permanent authority.
- Bid revision payloads, withdrawals and awards cannot be client-updated/deleted. Same-event row lock protects submission, withdrawal, material rule changes and award.
- Sealed bid visibility and hidden competitor identity are retained. Private Q&A author/participant columns are not granted to browsers.
- Legacy migration bytes and user work are preserved. No production advisors are used as proof of unapplied schema security.

## Verification

Previous correction baseline: **122 tests**, socket-only PostgreSQL concurrency **8/8**, desktop/mobile Playwright **50/50**. Final micro-correction adds four adversarial test groups. All gates are re-run on the final stack; final totals and remote CI status are recorded in the handoff. CI also runs the real PostgreSQL suite.

PGlite full replay is not a hosted Supabase acceptance test. Real PG concurrency replays the exact sourcing/AI/corrective migrations against explicit prerequisite fixtures; it is not full-stack PostgreSQL 14 replay. Existing earlier views require PostgreSQL 15+. Browser fixtures make no claims about production data or email delivery.

## Exact correction files

PR6 (10):

- `docs/casting-workspace-architecture.md`
- `docs/growth-referral-architecture.md`
- `docs/professional-graph-architecture.md`
- `docs/young-talent-architecture.md`
- `docs/pr6-authority-correction-review.md`
- `src/pages/RelationshipsPage.tsx`
- `src/pages/YoungTalentPage.tsx`
- `supabase/migrations/20260919040959_production_network_authority_correction.sql`
- `tests/browser/production-network.spec.mjs`
- `tests/production-network.test.mjs`

PR7 correction:

- `.github/workflows/foundation.yml`
- `docs/crew-builder-domain-contract.md`
- `docs/digital-assets-blockchain-readiness.md`
- `docs/filmverse-ai-agent-architecture.md`
- `docs/filmverse-ai-monetization.md`
- `docs/sourcing-room-architecture.md`
- `docs/production-network-final-review.md`
- `docs/pr7-architecture-correction-review.md`
- `src/lib/agentContracts.ts`
- `src/lib/settlementContracts.ts`
- `supabase/migrations/20260919042407_sourcing_commercial_authority_correction.sql`
- `tests/agent-contracts.test.mjs`
- `tests/settlement-contracts.test.mjs`
- `tests/sourcing-ai.test.mjs`
- `tests/sourcing-concurrency.mjs`

## Remaining release blockers

Independent architectural/security review; hosted staging Auth/JWT/PostgREST/RLS/Storage/Realtime and historical-data migration/restore rehearsal; guardian evidence/operator review/inbox delivery/media sanitation; granular delegation administration and full casting/supplier/buyer UX; actual commercial-offer verification and Q&A moderation/rate limits; production AI gateway/schema validation/redaction/approval execution; providers, jurisdiction/legal review and settlement security. All AI operations remain disabled by default.

Existing dependency advisories remain 21 (3 low/5 moderate/13 high), lint has seven pre-existing warnings and build retains chunk/static-dynamic import warnings. No force dependency upgrades or unrelated refactoring. STOP for review — no merge or production migration authorization.
