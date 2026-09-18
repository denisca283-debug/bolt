# PR #5 — Stage A correction

Review base: f6e955082e54ebff2692bd1a5ecbeb8309a6e197. Corrected HEAD is recorded in PR #5.
This addendum supersedes the verified-only-support and support-only-blocking statements in models-students-review.md.

## IMPLEMENTED

- New corrective migration only: 20260919022836_production_network_pr5_correction.sql. Reviewed migration history unchanged.
- Self-declared personal and authorized organization-owned student projects can request basic support. Trusted server policy: basic 1/day and 3 open, verified 5/day and 20 open; configurable, not subscription pricing.
- Company program chooses all_student_projects / verified_only. Eligibility RPC checks real project authority/status/verification and company visibility. It does not claim an invitation was delivered.
- Compensation categories unchanged. Usage rights and deliverables optional; mentorship has required topic/duration, irrelevant rights field hidden. Bounded details with allowed keys; existing common canonical columns retained.
- Canonical user_blocks prevents fresh direct sends (including existing rooms), new direct creation, group/project/person invitation and organization email invitation. Contact projections honor bilateral blocks. Prior conversations/messages are not deleted. Public data can still be seen anonymously: blocking is not retroactive erasure of public information.
- Block/unblock control writes canonical records from the shared MessageButton.
- CreateDialog explicitly accepts initialWorkTarget, default actor; project association no longer chooses Model. Optional model requirements: categories, height range, travel, digitals, portfolio, with database validation.
- Reviewer projection: user ID, safe name/slug, institution/program/specialization/graduation/submitted_at plus private evidence path for authorized reviewer. No email/DOB/phone/address.
- Decision endpoint requires reason and records reviewed_by/reviewed_at/decision_reason/valid_until. Old reasonless client endpoint disabled. Self-review still forbidden.
- Student project creation uses captured selected organization context; database requires actual company project authority.

## FOUNDATION ONLY

Company program eligibility is checked through a scoped RPC; no company inbox/delivery workflow.
The details object is bounded/type-aware storage, not a universal production planning engine.

## FUTURE DEPENDENCY

Hosted PostgREST/Storage validation, abuse controls and audit retention operations remain required.
Guardian/Young Talent, graph, education/events and referrals belong in the next stacked branch.

## Safe staging reviewer grant procedure

Do NOT run this against production as part of this packet.

1. Confirm disposable staging project ID/URL, backup and migrations. Create separate reviewer and applicant via staging Auth Admin API (never browser auth.users).
2. Record an approved operator ticket, reviewer UUID, purpose and revocation date. A trusted operator checks that this UUID belongs to the intended staging reviewer.
3. In a trusted staging SQL session, insert only the named permission:
   `INSERT INTO public.user_permissions(user_id,permission_id) SELECT '<reviewer-uuid>'::uuid,id FROM public.permissions WHERE name='review_student_verification' ON CONFLICT DO NOTHING;`
4. Verify through the reviewer session; test an unrelated account and self-review denial. Role/PRO/user_metadata must not grant this permission.
5. After review, trusted operator revokes this exact user's permission, verifies denial in the same session and records completion. Permission grants presently have no automatic expiry: scheduled revocation is an operational responsibility.
6. No real student identity documents in test fixtures. Retention/deletion policy required before real evidence intake.

## RELEASE BLOCKER

No merge or production migration. Child data may not be enabled merely because this adult/student correction passes.
Typecheck, lint (0 errors / 7 existing warnings), 88 Node tests with full chronological migration replay/adversarial RLS and build passed. All 38 desktop/mobile Playwright cases passed. The immutable corrected head is recorded in PR #5.

Read-only deployed advisors remain unchanged: [8 exposed definer warnings](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). They do not validate this unapplied migration. No production settings changed.
