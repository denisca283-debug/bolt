# PR6 + PR7 architectural correction review

PR5 remains frozen at `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. No merges, live Supabase mutations or production SQL. All previous migrations remain unchanged.

## Stack

- Corrected PR6: `87bfb30070a23ef828b157370bccdfcf9060d386`, `epic/production-network-foundation`.
- PR7: `epic/sourcing-ai-foundation`, rebased on that exact corrected PR6 head. Old PR7 history is preserved in backup/pr7-before-architecture-correction-20260919; final remote SHA is reported with the PR, rather than embedding its own commit hash here.
- New PR6 migration: `20260919040959_production_network_authority_correction.sql`.
- New PR7 migration: `20260919042407_sourcing_commercial_authority_correction.sql`.

Migration execution order is chronological, not commit order: original PR7 migrations 031153/031615 precede the new PR6 correction 040959 and PR7 correction 042407. Full chronological replay is verified. If PR6 is later deployed separately first, the earlier pending PR7 migration timestamps require an explicitly reviewed staging/deployment plan; do not silently reorder files, rewrite history or run production push flags automatically.

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

Local npm ci/typecheck/lint/test/build passed: **122 tests**, including full chronological replay/adversarial RLS and pure architecture contracts. Focused suites passed again after final eligibility hardening. Real socket-only PostgreSQL concurrency suite: **8 tests**, including withdrawal/award race. Full desktop/mobile Playwright: **50/50 passed**. Final remote CI status is recorded in the handoff. CI now also runs the real PostgreSQL suite.

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
