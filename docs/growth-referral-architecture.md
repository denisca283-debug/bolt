# Growth / referral engine

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Partner/campaign/code/attribution/event/reward-rule/append-only ledger tables. Safe random codes, legacy constrained destinations and new typed destination_type/entity_id/bounded payload with server-owned route mapping; referral landing preserves intended route through signup. First attribution per account; self/org-member referral rejection; service-only qualification; duplicate-event idempotency and cancellation reversal. Personal/organization dashboard aggregates counts and links without referred-user identities. Minor recruitment and graph confirmation are not reward event types.

## FOUNDATION ONLY

Individual/school/casting/rental/production/agency partner variants. Two-sided configurable noncash reward values. Approved ledger credits are NOT fulfilled AI/PRO balances. No automatic signup/click payout.

Typed casting_role/sourcing_event destinations currently resolve only to the project hub because private deep-link workspaces are not shipped. No browser-supplied URL is accepted; existing links retain their original allowed routes.

## FUTURE DEPENDENCY

Trusted activation worker with proof of qualifying domain action, pending partner approval/admin campaign workflow, lawful analytics, reward fulfillment integration.

## RELEASE BLOCKER

No cash payout, payment provider or KYC/tax implementation. Cash_future rule cannot qualify. Private service ingress requires reviewed server integration; never expose service key. No child bounty or student verification via referral.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
