# Sourcing / AI — Stage C checkpoint

Base: frozen Stage B `62a57950b9641c126333524994be45ca76d04a44`.
Branch: `epic/sourcing-ai-foundation`. Separate draft, do not merge/apply production SQL.

## IMPLEMENTED

- New migrations: `20260919031153_sourcing_need_foundation.sql` and `20260919031615_ai_wallet_agent_foundation.sql`.
- Canonical Project Need with matching target/route constraints, RLS, persisted manual Project UI.
- Sourcing event/lot/participant/bid/line-item/award/notice/Q&A domains; explicit qualification, sealed isolation, immutable revisions, version acknowledgement, bounded reverse extension and split awards.
- Personal/company AI ledger, current-authority spending, server-priced catalogue, disabled-by-default allowance, transactional/idempotent debit and exact refund.
- Typed single-agent tool gateway, evidence/recommendation/risk/approval contracts; SQL argument-bound approval and project-scoped memory schema.

## Gates and evidence

| Gate | Result |
|---|---|
| npm ci | PASS; lockfile unchanged, 21 inherited advisories |
| npm run typecheck | PASS |
| npm run lint | PASS; 0 errors, 7 inherited Fast Refresh warnings |
| npm run test --if-present | PASS; 107 tests including chronological replay and adversarial RLS |
| npm run build | PASS; large-chunk/shared static+dynamic import warnings remain |
| npm run test:concurrency | PASS; 7 tests (six scenarios + parent), real PostgreSQL 14.17 |
| Playwright desktop/mobile | PASS; 50/50 in final complete single-worker run |
| git diff --check | PASS |

The first C browser pass had 46 passes and four failures. Retained traces showed `net::ERR_NETWORK_CHANGED` while loading local Vite/lucide modules, leaving blank pages. A complete isolated single-worker repeat passed unchanged assertions; no timeouts increased, skips or assertion removals. Failure traces were retained outside the repository.

Full SQL replay runs in PGlite under bundled Node 24. Real concurrency tests create an isolated socket-only local PG cluster, load the exact two C migrations on minimal prerequisites, then stop/delete only that temporary fixture. They do not connect to any saved DB. PG14 concurrency tests are NOT a full old-stack replay; the older stack requires PG15+ view semantics.

Verified races: two equal-price bids cannot both satisfy decrement; same request creates one revision; simultaneous rule change never accepts an unacknowledged new version; lock-waiting bid rechecks server clock after deadline; one credit cannot fund two debits; concurrent refunds cannot mint excess credits.

## Explicit security review

All new tables use RLS with positive client grants. Anonymous sourcing/AI access is denied. Public wrappers are invoker; privileged helpers fix empty search_path and revoke PUBLIC execution. Trusted grants/refunds are private service-only.
Supplier/organization authority is rechecked on requests/replays; removal blocks access immediately. Sealed prices, items and competitor identities are protected in SQL rather than hidden UI. Confidential target budget lacks column privilege, while ceiling is disclosed as a bidding rule.
Lots lock their event before mutable draft changes; bids/rule changes serialize on the event; immutable bid history is never overwritten. Award is a recorded decision, not a commercial contract.
Wallet mutations lock the wallet before computing ledger balance. Browser cannot choose price, grant credits, refund itself, alter usage history, approve another person's proposal, or insert project memory.
AI runtime permissions, privacy, arithmetic, availability and compliance remain domain-owned. Contracts require a trusted initiating-user gateway; no such live executor or provider is claimed here.
Read-only hosted security advisor remained the same older-stack eight callable-definer warnings plus leaked-password protection disabled. No production SQL or settings were changed.

## FOUNDATION ONLY

Sourcing core is callable/tested SQL, not a complete supplier/buyer product UI. Bid-person confirmation storage has no unreviewed browser write path.
AI operation catalogue and allowance are disabled. No LLM worker, topup/payment, referral reward fulfillment, subscription job or approval executor is deployed.
Full Crew Builder is intentionally absent.

## FUTURE DEPENDENCY

See `sourcing-room-architecture.md`, `filmverse-ai-agent-architecture.md`, `filmverse-ai-monetization.md`, `crew-builder-domain-contract.md`.

## RELEASE BLOCKER

Independent architecture/security review, hosted staging integration, full supplier/notice/consent UX, media/evidence safety, reviewed AI gateway and provider execution/compensation, payment adapters, moderation/rate limits and existing dependency remediation.
The 55-point consolidated Russian report is `production-network-final-review.md`.
