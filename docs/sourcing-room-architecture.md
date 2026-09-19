# Sourcing Room

## IMPLEMENTED

Canonical sourcing_events, lots, participants, immutable bids/items, awards, notices and shared published Q&A. Project Needs link to the same manual/AI domain.
Types distinguish equipment, standardized service and individual crew; crew requires sealed_person_proposal. Casting subjects cannot become sourcing needs; Actor/Model/Young Talent remain Casting.
Supplier qualification/acceptance and live organizational authority are checked in SQL. Participant identity is hidden from competitors. Private target budget has no SELECT/filter grants; the ceiling is an explicitly disclosed rule.
Bids lock the event, calculate integer totals from bounded line items, bind idempotency key to actor and payload, record immutable revisions, and use clock_timestamp AFTER waiting for locks.
Sealed buyer cannot read offers/items before deadline. No competitor bid visibility; optional rank/best price only for predeclared reverse modes.
Reverse decrement, bounded automatic extension and replay-safe extension are implemented.
Manual best value is default; lowest-compliant and manual multifactor require a recorded rationale. Split awards by lot, no cross-event lot/bid injection, no pre-close award or outdated revision selection. Awards are append-only decisions, not contracts.
Material description/deadline/ceiling changes increment version, publish a common notice and close bidding for fresh participant acknowledgement before reopening. Opened lots cannot be silently rewritten.

## FOUNDATION ONLY

Bid-professional proposed/confirmation_pending/confirmed/declined schema is service-managed. No supplier can forge confirmed consent; award rejects pending commitments.
Rule notices are persisted/readable, not a claim of email/push delivery. Shared Q&A is buyer-published; private supplier question inbox is not shipped.
No public auction showcase or full sourcing workspace UI. Canonical RPCs and adversarial SQL tests are the implemented foundation.

## FUTURE DEPENDENCY

Bidder/qualification/award UI, participant notice delivery, private attachments, versioned lot rule amendments, person-specific commercial proposal disclosure/consent, contract/payment adapters, cancellation/negotiation workflows and moderated eligibility.

## RELEASE BLOCKER

Hosted staging role/JWT/PostgREST validation, operations/rate limits, independent fairness review and supplier UX. No auction for casting talent or minors; no binding professional commitment via graph membership. No production migration.

## Verification

Full chronological replay in PGlite plus exact C migrations under socket-only real PostgreSQL 14.17 for concurrent bid, retry, rule-change, deadline, debit and refund tests. PG14 concurrency fixtures intentionally use small prerequisite tables; they are NOT a PG14 full-stack replay (older stack uses security_invoker views supported in PG15+).
