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
Rule notices are persisted/readable, not a claim of email/push delivery. Participant Q&A now stores asked → published_to_all/private_provider_specific states (answered is reserved for a later review step). Buyer answers require manage_sourcing. Common-scope changes must publish to all, increment the event version and require acknowledgement/reopen. Supplier identity columns are not browser-readable; participant UI and delivery are not shipped.
No public auction showcase or full sourcing workspace UI. Canonical RPCs and adversarial SQL tests are the implemented foundation.

## Corrective commercial contract

New migration 20260919042407_sourcing_commercial_authority_correction.sql leaves prior migrations unchanged. Buyer permissions: view_sourcing/manage_sourcing/invite_sourcing_participants/evaluate_bids/award_sourcing; provider: view_sourcing/prepare_bid/submit_bid. Only personal project owners or active company owners inherit authority; trusted explicit grants require current project/company membership. General employees and manage_organization do not implicitly gain bid submission.

Bid payloads are immutable. The six-argument sourcing_bid_submit adds versioned bounded commercial_terms: validity, availability, delivery/pickup, tax inclusion/amount, security/deposit and insurance terms, prep/service, mandatory fees, summary, compliance/alternative specification and nullable discount reference. Integer item_subtotal_minor + mandatory_additional_costs_minor = comparable_total_minor. Included tax is not counted twice; excluded tax is added. Refundable security is disclosed, not represented as a purchase fee; all nonrefundable mandatory charges belong in mandatory costs. Unknown costs cannot claim comparison_complete. Historical five-argument bids remain readable but incomplete/unawardable; reverse bidding requires explicit complete compliant terms.

Withdrawal appends an immutable record, never deletes a revision. Lifecycle derives active/withdrawn/superseded. Withdrawal and award lock the same event. Award requires current final revision, unexpired offer, disclosed complete costs and available/conditional supply; lowest_compliant_bid excludes alternatives. Alternative specifications describe requested/offered/deviation without automatic equivalence. Professional-resource consent remains sourcing_bid_professionals, not graph membership.

Commercial Offers are canonical commercial_offers, trusted-ingress only: provider, type, scope, eligibility, exact discount structure, currency, validity, geography, terms/status/provenance. Sponsored promotion is not a discount; possible is not confirmed. A bid reference requires confirmed current matching-provider/currency offer AND trusted participant-specific eligibility evidence. This does not automatically calculate savings or verify technical compliance.

Future financial obligations and optional fairness evidence use [digital-assets-blockchain-readiness.md](digital-assets-blockchain-readiness.md). PostgreSQL remains operational authority; no blockchain integration.

## FUTURE DEPENDENCY

Bidder/qualification/award UI, participant notice delivery, private attachments, versioned lot rule amendments, person-specific commercial proposal disclosure/consent, contract/payment adapters, cancellation/negotiation workflows and moderated eligibility.

## RELEASE BLOCKER

Hosted staging role/JWT/PostgREST validation, operations/rate limits, independent fairness review and supplier UX. No auction for casting talent or minors; no binding professional commitment via graph membership. No production migration.

## Verification

Full chronological replay in PGlite plus exact C migrations under socket-only real PostgreSQL 14.17 for concurrent bid, retry, rule-change, deadline, debit and refund tests. PG14 concurrency fixtures intentionally use small prerequisite tables; they are NOT a PG14 full-stack replay (older stack uses security_invoker views supported in PG15+).
