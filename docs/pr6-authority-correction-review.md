# PR6 authority correction — local review

PR5 remains frozen at b0e46cf2754b74a23d3e8a8f13c6fe1eda036305. Final micro-correction amends only the never-applied review migration 20260919040959_production_network_authority_correction.sql, as explicitly authorized. Earlier migrations are unchanged. No live database changes.

## Final micro-correction

Current-only relationship uniqueness replaces all-history uniqueness. Terminal episodes remain immutable; requests can create a new pending episode after end/decline/expiry. Public graph still requires a current active relationship and bilateral publication consent.

Foundation freeze correction separates pending acceptance validity from accepted candidate authority. Pending invitations have a server-controlled maximum acceptance window of 30 days. A timely accepted episode does not expire the candidate on day 30; activation and all later updates revalidate casting authority, original project/role/work/hash, open role, reviewed opportunity/responsible adult and current unrevoked guardian consent/authority. Reissue serializes on role/work locks, marks stale pending episodes expired and creates a new episode; old dates remain unchanged. Expired/declined rows are immutable, and explicit decline blocks automatic reissue. No new product feature or deliberate reopen flow.

Do not apply PR6 alone to shared environments. The live database precedes the PR3–PR7 stack; future staging must use the complete pending stack in chronological filename order in one reviewed plan. No migration renames, repair or include-all shortcuts.

## Corrected boundaries

- Creator + pending guardianship may edit a non-discoverable private draft. Approved guardianship remains mandatory for discoverability and project consent. Discovery RLS is unchanged.
- Context-free minor_contact is revoked. New overload creates an auditable invitation, not a chat or candidate. It requires reviewed search, manage_candidates, an open role and reviewed minor opportunity in the same project. Guardian acceptance creates bounded project-specific application consent. Child activation still needs current approved guardianship/consent and an accepted invitation for search/invitation sources.
- Responsible adult must be the personal project owner, active organization owner or active project member, independently reviewed in a trusted service record, and explicitly accept the exact policy version. Revocation/expiry invalidates opportunity review dynamically. Trusted review/evidence/operator UI remains unimplemented.
- Casting authority is project-scoped: view_casting, manage_candidates, manage_auditions, approve_cast, share_casting. Unrelated project/company membership is insufficient. Trusted service writes audited grants; active membership is rechecked. Existing UI is not yet a complete delegated casting workspace.
- Private operational professional relationships honor identity/contact/company authority, without public discovery requirements. Public company display requires person permission AND company choice; personal placement remains the professional's choice. Public projections require public person/discoverable company. Existing relationships default to company display off until explicitly selected.
- Typed referral destinations use a bounded object and trusted SQL route mapping; arbitrary URLs are rejected. Legacy constrained links remain compatible. Private casting/sourcing destinations deliberately fall back to project hub until their deep-link UI exists.

## Verification and limitations

Previous correction baseline: 101 tests and 46 desktop/mobile scenarios. The final micro-correction adds two adversarial lifecycle groups (focused replay 15/15); exact full-suite, browser and CI results are reported on the final heads. Lint: zero errors, seven pre-existing warnings. npm audit reports 21 existing advisories (3 low/5 moderate/13 high); no unrelated dependency upgrade.

Final remote HEAD/CI are reported after verification, not inferred from code. These are isolated fixtures/local databases, not hosted acceptance. Guardian inbox UI, delivery/rate limits, evidence review, delegated casting UX and hosted staging remain release blockers. No production release approval.
