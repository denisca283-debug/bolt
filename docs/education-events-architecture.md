# Education and events

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Canonical programs, instructors tied to bilateral school relation, events. Draft/private/member/public rules, organization authority, safe HTTPS registration links; public discovery/detail pages and free publication forms with selected publisher context. School tabs, industry hubs, mobile-compatible forms, error/loading/empty states.

## FOUNDATION ONLY

Schema supports factual category/format/pricing/capacity; no registration payment or attendance transaction claimed. Existing organization verification only; listing fee does not verify.

## FUTURE DEPENDENCY

Recurring occurrences, dedicated organizer cards, category/date facets, moderation tooling, registration integrations and labeled sponsored distribution.

## RELEASE BLOCKER

Public event/program rollout needs moderation, abuse/rate limits and operational review. Instructor UI currently shows school professional network, not course roster. Student project tab currently includes organization's public projects; explicit affiliation filter is future work.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
