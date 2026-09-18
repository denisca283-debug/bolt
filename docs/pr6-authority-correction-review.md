# PR6 authority correction — local review

PR5 remains frozen at b0e46cf2754b74a23d3e8a8f13c6fe1eda036305. This change only appends migration 20260919040959_production_network_authority_correction.sql; no previously reviewed migration is edited. No live database changes.

## Corrected boundaries

- Creator + pending guardianship may edit a non-discoverable private draft. Approved guardianship remains mandatory for discoverability and project consent. Discovery RLS is unchanged.
- Context-free minor_contact is revoked. New overload creates an auditable invitation, not a chat or candidate. It requires reviewed search, manage_candidates, an open role and reviewed minor opportunity in the same project. Guardian acceptance creates bounded project-specific application consent. Child activation still needs current approved guardianship/consent and an accepted invitation for search/invitation sources.
- Responsible adult must be the personal project owner, active organization owner or active project member, independently reviewed in a trusted service record, and explicitly accept the exact policy version. Revocation/expiry invalidates opportunity review dynamically. Trusted review/evidence/operator UI remains unimplemented.
- Casting authority is project-scoped: view_casting, manage_candidates, manage_auditions, approve_cast, share_casting. Unrelated project/company membership is insufficient. Trusted service writes audited grants; active membership is rechecked. Existing UI is not yet a complete delegated casting workspace.
- Private operational professional relationships honor identity/contact/company authority, without public discovery requirements. Public company display requires person permission AND company choice; personal placement remains the professional's choice. Public projections require public person/discoverable company. Existing relationships default to company display off until explicitly selected.
- Typed referral destinations use a bounded object and trusted SQL route mapping; arbitrary URLs are rejected. Legacy constrained links remain compatible. Private casting/sourcing destinations deliberately fall back to project hub until their deep-link UI exists.

## Verification and limitations

Final focused replay: 13/13; complete suite: 101 tests passed. Playwright desktop/mobile: 46/46. npm ci, typecheck, lint, test and build passed. Final route mapping adjustment is also checked by focused replay. Lint: zero errors, seven pre-existing warnings. npm audit reports 21 existing advisories (3 low/5 moderate/13 high); no unrelated dependency upgrade.

Final remote HEAD/CI are reported after verification, not inferred from code. These are isolated fixtures/local databases, not hosted acceptance. Guardian inbox UI, delivery/rate limits, evidence review, delegated casting UX and hosted staging remain release blockers. No production release approval.
