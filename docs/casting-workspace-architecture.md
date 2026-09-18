# Casting workspace

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Project → role → candidate (canonical casting_subject_id) → audition foundation. Existing applications retain user/submitted_by guardian distinction. Private reviewer notes and shared comments have separate tables/RLS. Project UI persists roles, application candidates, pipeline status and notes; identity is immutable. Selected adult-only bearer shares use random 256-bit token, hash at rest, seven-day maximum, revocation, current public-identity recheck and minimal name/role projection.

## FOUNDATION ONLY

Auditions, private media versions, project ensembles; no arbitrary global score. Share RPC exists; share viewer UI not shipped.

## FUTURE DEPENDENCY

Candidate full cards, audition scheduling/guardian request delivery, media pipeline, ensemble UI and richer review views.

## RELEASE BLOCKER

No production casting-media ingress. Minor candidates cannot be externally shared. Project owner/manage_projects is current casting authority; finer manage_casting delegation needs explicit reviewed policy.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
