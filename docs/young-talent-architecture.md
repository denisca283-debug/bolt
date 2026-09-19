# Young Talent / casting subject

Stage B draft; stacked on corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`. Unapplied production migrations.

## IMPLEMENTED

Separate adult auth identity and casting subject. Minor has no account. Approved, expiring guardian authority; independent review RPC; protected discovery permission; discovery is separate from contextual invitation authority. The old context-free DM endpoint is revoked. Pending creators can edit only private drafts; they cannot publish, grant consent or expose media. Contextual invitations require manage_candidates plus reviewed search, a role and a reviewed minor opportunity in the same project. The guardian explicitly accepts project-specific consent before a search/invitation child can become an active candidate. No DM is created automatically. Project-specific consent gates applications. Private review records bind minor opportunities to an exact content hash; editing invalidates approval without bypassing organization ownership. Tests exercise privacy, self-approval, blocked upload and borrowed consent.

## FOUNDATION ONLY

Pending invitations have a server-assigned acceptance deadline no later than 30 days after creation. Acceptance rechecks that deadline, original project/opportunity hash, open role, reviewed opportunity/responsible adult and current guardian authority. After timely acceptance, the original deadline is not candidate expiry. All minor candidate sources (application, invitation, search) use shared current-context and project-consent checks for activation and active updates: current casting authority, approved unexpired guardian, unrevoked/unexpired consent, matching open role/work/project and reviewed opportunity/responsible adult. Application candidates bind the submitting guardian, immutable application/work identity and server-stamped original project/work hash; withdrawal or changed context cannot be bypassed by a new opportunity review. Old rows lacking this evidence are retained but fail closed for active progression; no historical authority is fabricated.

Authority loss blocks review, shortlist, audition, hold, approved, backup, tag changes and reopening. Existing history remains readable under current view_casting authority without granting minor discovery, media or private identity access. A status-only transition to the existing rejected state is allowed under manage_candidates (and approve_cast when leaving approved), with every other field unchanged and without renewing consent. The submitting guardian can still withdraw their application. No new lifecycle status or reopen workflow. Reissue locks role/work context, closes stale pending episodes as expired, and creates a new episode without overwriting old dates. Only one pending/accepted episode exists per subject/role/work. Expired/declined rows are immutable; explicit decline blocks automatic re-invitation for that context.

Jurisdiction-aware factual compliance, secondary guardian rows, private legal facts and sanitized-media metadata. No legal-compliance badge.

## FUTURE DEPENDENCY

Guardian evidence intake, secondary guardian invitation/consent, audited operator review UI, jurisdiction-specific operational process.

## RELEASE BLOCKER

No minor public launch until evidence/age/representative review, responsible-adult evidence/operator review, retention/deletion and GPS/EXIF sanitation exist. Client media upload remains denied. No production migration or permission granted.

## Verification

See `production-network-review.md` for gate results and evidence limitations. All browser tests are isolated fixtures; SQL tests replay migrations locally. Neither proves a hosted deployment or production data migration.
