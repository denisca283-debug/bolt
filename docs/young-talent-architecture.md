# Young Talent / casting subject

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Separate adult auth identity and casting subject. Minor has no account. Approved, expiring guardian authority; independent review RPC; protected discovery permission; contact resolves to canonical guardian DM. Project-specific consent gates applications. Private review records bind minor opportunities to an exact content hash; editing invalidates approval without bypassing organization ownership. Tests exercise privacy, self-approval, blocked upload and borrowed consent.

## FOUNDATION ONLY

Jurisdiction-aware factual compliance, secondary guardian rows, private legal facts and sanitized-media metadata. No legal-compliance badge.

## FUTURE DEPENDENCY

Guardian evidence intake, secondary guardian invitation/consent, audited operator review UI, jurisdiction-specific operational process.

## RELEASE BLOCKER

No minor public launch until evidence/age/representative review, responsible-adult acceptance, retention/deletion and GPS/EXIF sanitation exist. Client media upload remains denied. No production migration or permission granted.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
