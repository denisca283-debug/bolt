# Young Talent / casting subject

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Separate adult auth identity and casting subject. Minor has no account. Approved, expiring guardian authority; independent review RPC; protected discovery permission; discovery is separate from contextual invitation authority. The old context-free DM endpoint is revoked. Pending creators can edit only private drafts; they cannot publish, grant consent or expose media. Contextual invitations require manage_candidates plus reviewed search, a role and a reviewed minor opportunity in the same project. The guardian explicitly accepts project-specific consent before a search/invitation child can become an active candidate. No DM is created automatically. Project-specific consent gates applications. Private review records bind minor opportunities to an exact content hash; editing invalidates approval without bypassing organization ownership. Tests exercise privacy, self-approval, blocked upload and borrowed consent.

## FOUNDATION ONLY

Invitations expire at a server-assigned deadline no later than 30 days after creation. Acceptance and search/invitation candidate activation recheck the original project and opportunity content hash, open role, live reviewed opportunity/responsible adult and current guardian authority. Accepted invitations must remain unexpired; candidate activation also needs live project consent. Expired rows remain history, not deletions or renewed authority.

Jurisdiction-aware factual compliance, secondary guardian rows, private legal facts and sanitized-media metadata. No legal-compliance badge.

## FUTURE DEPENDENCY

Guardian evidence intake, secondary guardian invitation/consent, audited operator review UI, jurisdiction-specific operational process.

## RELEASE BLOCKER

No minor public launch until evidence/age/representative review, responsible-adult evidence/operator review, retention/deletion and GPS/EXIF sanitation exist. Client media upload remains denied. No production migration or permission granted.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
