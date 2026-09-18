# FilmVerse — Models + Student Ecosystem: architectural review

Stage A correction: see [pr5-correction-review.md](pr5-correction-review.md) for superseding support, blocking and reviewer rules.

Status: draft stacked review; NOT a production rollout. No merge, production SQL, seed or manual production deployment.

## Stage 1 — PR #4 correction

1. **Frozen head:** `7cfbacf334cf29463c62b90de335b7c4009677ad`, branch `epic/identity-organizations-resume`, [PR #4](https://github.com/denisca283-debug/bolt/pull/4). Stage 2 starts from this exact commit.
2. **Contact/media privileges:** explicit SELECT grants plus audience RLS; representations use owner-only raw rows and privacy-filtered RPC for other viewers. Public, members, work-context, private and unrelated viewers tested.
3. **Resume independence:** private base profile can deliberately publish public Resume. RPC returns only publication fields and explicit professional display name, not private profile/contact/DOB.
4. **Hiring/link-only:** database-backed personal/organization hiring authority; link-only excluded from discovery, random bearer stored only as SHA-256, rotate/revoke supported. UUID alone cannot open it.
5. **Skills:** actor/professional/both preserves IDs; language proficiency schema foundation, not a complete language editor.
6. **Invitations:** safe company identity/role/expiry projection for intended confirmed-email recipient or authorized manager; no raw private-company access.
7. **Roles:** owner/admin transitions mirrored in UI; no self-promotion, admin privileged-role grant or last-owner removal.
8. **Unlisted:** direct routes readable under RLS; excluded from directories. Resume uses its explicit bearer mechanism.
9. **Gates:** npm ci, typecheck, lint (0 errors / 7 warnings), 75 Node tests including migration replay/RLS, build, 26 desktop/mobile Playwright cases. Both GitHub Actions workflows succeeded at frozen head. Full correction details: [product-layer-ii-review.md](product-layer-ii-review.md).

## Stage 2 — implementation and boundaries

10. **Branch/head:** `epic/models-students`, stacked on frozen PR #4. The enclosing commit/PR is the exact review head (Git hashes cannot be embedded in their own commit). Never target main directly.
11. **Model schema:** `model_profiles` one-to-one professional extension of existing profile; `model_measurements` separate visibility; `model_credits` structured work. Atomic `model_save`; no new auth identity or copied name/city.
12. **Categories:** multiple fashion, editorial, commercial, lifestyle, beauty, runway, ecommerce, fit, parts, promotional, character, other.
13. **Measurements:** metric numeric height/chest/waist/hips/inseam, EU shoes, bounded clothing/hair/eye fields; all optional. UI saves and displays allowed values. Imperial conversion future.
14. **Digitals/portfolio:** existing media/storage architecture extended with model_digitals, model_portfolio, model_walk and angle metadata. Private by default; signed access follows existing media RLS. Main portrait reuses identity avatar. Comp Card is a possible composed safe projection, not a fake download/PDF.
15. **Representation:** existing company/representation model, optional company picker, role, territory, active dates; visibility-aware contact redaction. Self-declared agency relationship is NOT verified representation.
16. **Model search:** server RPC, stable 24-row pages; city/category/height/hair/eyes/availability/travel/digitals/portfolio/visible active representation/identity verification. Hidden measurements cannot be inferred by filters. No attractiveness ranking. Independent-only filter and more measurement ranges remain future.
17. **Model privacy:** public/members/work_context/private measurements, private contacts default; no DOB/account fields in model projection. General model biography/credits follow person visibility.
18. **Opportunities:** canonical target_kinds actors/models/crew, explicit model compensation/expenses/usage/deliverables/date/city constraints. Canonical work_applications persists application/withdrawal without actor-only fields. Project-linked vacancy requires project authority and UI inherits project visibility, without Pulse side effect.
19. **Education:** private-by-default education_affiliations, current_student/recent_graduate/alumni, school link or custom name, program/specialization/years, opt-in generic badge. Revision changes invalidate previous evidence.
20. **Verified Student:** separate private student_verifications facts, explicit review_student_verification permission, no self-review even with that permission. User cannot write approval/expiry. Reviewer queue and decision UI implemented.
21. **Methods:** manual enrollment proof flow implemented; school/email/partner methods are reserved schema values only, not working automated integrations. Private evidence bucket, 10 MB and PDF/JPEG/PNG server limits, short signed review URL. User cannot claim a trusted method.
22. **Expiration:** verified_at/valid_until, max one year and no later than graduation-year end, runtime current-student/revision validation; expired status in owner view. No permanent alumni badge.
23. **School linkage:** validates education organization and permitted visibility; no automatic school workspace membership, permissions or school-admin verification rights.
24. **Student projects:** canonical projects extended with student/thesis/affiliation/shoot dates; create privately, publish deliberately, edit basic project details. Not a duplicate project product.
25. **Verified project:** dynamic active verification of linked affiliation, not a client flag. Generic badge asserts affiliation only, never safety/quality. Self-declared project available without verification.
26. **Directory:** /student-projects server pages (24), city, visible school, format, dates, verified affiliation, open need/department/compensation and public actor/model casting filters. Private/closed/hidden needs excluded from public discovery predicates.
27. **Support requests:** canonical structured project_support_requests with need, department/profession/company/inventory reference, quantity/location/dates/compensation/expenses/rights/deliverables/credit/mentorship details. Verified authorized project CTA, private default, persisted close/report actions; no broadcast delivery claim.
28. **People opt-in:** student_support_preferences default OFF, categories/cities/terms, editable save, explicit opt-out; discovery respects visible person and bilateral blocks.
29. **Company program:** organization_student_support managed only by manage_organization authority, categories/geography/terms/contact method; enabled public-company programs discoverable. No new messaging system.
30. **Support label:** amber “Поддерживает студентов” signifies voluntary program only, distinct from verification; does not guarantee free service or endorsement.
31. **Compensation:** paid / expenses / unpaid educational / TFP / in-kind / discount / other explicit labels. Credit is not pay. Persisted terms shown in request/work detail. Participants retain legal responsibility.
32. **Benefit separation:** student_program_policy is trusted-server configurable (initial support cap 5/day, 20 open), separate from verification and PRO. Serial author locking on creation. No pricing, coupons or paid badge. Other student posting allocations are future.
33. **Privacy/security:** all 11 new public tables enable RLS; positive mutation column grants, private definers with empty fixed search_path, explicit EXECUTE. Own extension/affiliation only, no arbitrary project/organization impersonation. Evidence immutable after submission, unreferenced upload cleanup allowed for owner. No new education/evidence/support Pulse writes.

## Evidence and remaining work

34. **Model tests:** chronological PGlite replay validates model-only, actor+model, atomic rollback, measurements audience and filtering, media metadata, agency/credits, model terms and student model application.
35. **Student tests:** private/custom/school affiliations, no membership grant, manual evidence, unrelated access denial, self-review denial even with authority, expiry/revision/PRO distinction, self-declared/verified projects, foreign project denial, requests/limits/closure, opt-in/out/company privacy/blocking, explicit RLS/EXECUTE/path/bucket checks.
36. **Browser tests:** desktop/mobile fixture tests exercise model save/reload, server filter payloads, media category choices, education/private project creation, structured unpaid support, actual application API persistence and support search. Together with retained regressions: 36 cases. Browser API interception is deliberate; NOT proof of a deployed Supabase backend, actual email, file transfer or multiple real sessions.
37. **Mocks:** no fabricated model/student/support production records or success paths added. Test fixtures live only under tests. Existing unrelated product mock/legacy surfaces remain as documented in prior review; they are not claimed complete.
38. **Risks/limitations:** see release gates below. This is an architectural review candidate, not a claim of production readiness.
39. **Actor/Model Search 2.0:** canonical targets, categories, privacy-safe server model search ready as foundation; richer ranges/independent filter, actor search migration, load testing/index query plans and unified saved searches future.
40. **Personal Cabinet:** real model/education/support editors in existing settings/routes. Unified dashboard, document-retention controls, richer credit editing and full affiliation lifecycle UI still needed.
41. **Projects 2.0:** canonical project links, student badges/dates and requests available. No project_members architecture, genuine team counts, complete staffing/recruitment workflow, shared inbox or project-wide chats claimed.
42. **Crew Builder:** structured department/profession/quantity/need/date/terms and mentorship fields are inputs. Guided planning, templates, factual team/cast completion counts and matching workflow remain future; no fake score/button.

## New migration files (not applied to production)

- `20260919004045_models_students_core.sql`: model extension, media/representation, education and private verification.
- `20260919004336_student_projects_support.sql`: project linkage, support policy/requests/preferences/programs/blocks/reports/discovery.

Only these new unapplied migrations are authored in Stage 2. No pre-existing migration SQL edited. Storage bucket mock columns in replay tests were extended to model real bucket limit configuration.

## Changed code inventory

New: ModelsPage, StudentsPage, StudentEducation, StudentSupport, WorkApplication, CompanyReferencePicker, modelTaxonomy, models-students SQL test and this report.

Integration: App, Sidebar/nav-config, SettingsPage, ProfilePage, CompaniesPage, OrganizationsPage, ProjectPage, WorkPage, CreateDialog, ProfileContacts, ProfileMedia, types/index; browser and three replay fixtures. Existing auth/messaging implementations are not rewritten.

## Release gates / explicit limitations

- Do not merge or apply production migrations. First run against a disposable Supabase staging project, validate PostgREST grants, actual Storage uploads/signed URLs/deletion, Auth sessions and two-user workflows.
- Local replay uses real PostgreSQL semantics through PGlite, not hosted service infrastructure or concurrent multi-connection proof. No claim of production mutation/test seed.
- Student evidence requires operational retention, deletion requests, malware/content validation and a cleanup job for abandoned uploads. MIME/size limits are not antivirus. Submitted documents cannot be overwritten by normal users.
- Reviewer permission assignment remains trusted administration. Automated school domains, partner codes and school confirmation integrations are NOT implemented.
- Reports persist; moderator processing UI/operational review and broader abuse controls are future. Blocks currently cover student support, not global messaging. No mass company delivery exists.
- Program limits cover support requests, not every upload/account/search endpoint. Production gateway abuse limits and performance review remain required.
- Existing dependency audit: 21 advisories (3 low, 5 moderate, 13 high); no dependency upgrades attempted. Lint retains 7 warnings. Main bundle remains above 500 kB; new model/student routes lazy-load.
- Live read-only Supabase advisor findings are unchanged (8 exposed definer warnings and disabled leaked-password protection); they describe deployed schema, not this unapplied stack.
- No minors/guardian flow, LMS, booking/escrow, sponsorship/payments, full Crew Builder, Casting Room or company inbox.
- Supabase/Postgres skills informed explicit grants, private definers, fixed paths and RLS. React/browser skills informed lazy routes, parallel independent reads and fixture-based mobile verification; agent-browser was unavailable, so Playwright was used.

## Final local gate result

npm ci passed. Typecheck and lint passed (0 errors, 7 existing warnings). All 86 Node tests passed, including full chronological replay and adversarial RLS. Final complete rerun used bundled Node 24. All 36 browser scenarios passed; 4 affected desktop/mobile scenarios passed again after the follow-up.

One additional Node 23 rerun timed out during PGlite startup in the unchanged messaging test. This failed run was not treated as a pass. The full Node 24 rerun passed; no tests skipped or timeout suppressed.

Wait for architectural review. No merge.
