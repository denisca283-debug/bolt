# Professional Graph / Crew Network

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Bilateral request/confirm/end RPCs; no client confirmation timestamp edits. Person grants permission for company placement and independently chooses placement on their own profile; company independently opts into its own placement. Both choices default to false. Operational relations can be private: contact policy, identity and organization authority replace discoverability as creation/acceptance gates. Public projections additionally require a public person and discoverable company. Multi-company nonexclusive relations, server freshness policy, current visibility/block checks. Rental/company and professional profile projections, requests UI in personal/company context. Ending relation removes public graph and instructor projection.

## FOUNDATION ONLY

Bid person consent integrates later sourcing; relationship is evidence, never verification or availability guarantee.

## FUTURE DEPENDENCY

Named invitation inbox improvements, self-initiated company picker UI, per-profession matching and shared company inbox.

## RELEASE BLOCKER

No wage commissions, ranking advantage or automatic crew commitment. Raw rows visible only to parties; public RPC allowlists display data.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
