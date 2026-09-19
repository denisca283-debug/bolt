# Production Network — Stage B checkpoint

Base: corrected PR5 `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`.
Branch: `epic/production-network-foundation`. Draft, not merged.
No production database mutation, seed or deployment.

## IMPLEMENTED

Four new chronological migrations cover canonical casting subjects, protected minors/guardians/consents, normalized casting, bilateral Professional Graph, education/events, and referral ledgers. Existing account/application identity and tables are retained. No historical migration changed.

UI: six root navigation domains; People/Industry hubs; protected Young Talent search and guardian contact; project casting role/application/pipeline/notes controls; company/profile graph and confirmation inbox; school tabs, event/program publication/detail/discovery; contextual referral landing and aggregate Partner Center.

## Gates

- npm ci: PASS. Lockfile unchanged; 21 known dependency advisories (3 low, 5 moderate, 13 high).
- npm run typecheck: PASS.
- npm run lint: PASS (0 errors, 7 pre-existing Fast Refresh warnings).
- npm run test --if-present: PASS — 96 tests including new seven adversarial network scenarios plus their parent replay test.
- Full chronological SQL replay: PASS in PGlite PostgreSQL; tests run under bundled Node 24 to avoid host Node 23 startup hang.
- npm run build: PASS. Existing large main chunk warning remains; IndustryListings shared static/dynamic import warning is non-fatal.
- Playwright: 46 PASS across desktop/mobile. HTTP fixtures only, all external production requests blocked. Not a hosted Supabase/PostgREST/Storage integration proof.
- git diff --check: PASS.

## Explicit security review

Auth session remains sole login authority. RLS on every new table, no raw minor legal data or creator identity granted to browser, no anonymous child directory. PRO grants none of the reviewed permissions. Guardian review excludes self; current expiry/consent and content-hash opportunity approval guard writes. Unsafe media upload is denied. Reviewer records are separate so review does not bypass organization write authority.

Casting application source is checked against the same subject/project. Private notes are reviewer-only, comments project-casting scoped. Bearer export has explicit candidate scope, expiry, revocation and no minor/contact/notes payload; currently only names/roles of public adult identities.

Graph timestamps and active state are RPC-owned; one party cannot forge both approvals. Public opt-in is person-owned; privacy, blocks and ended links are rechecked. Instructor public reads require a still-active consenting relation.

Education/event ownership is immutable through column grants. Draft/private scope remains server-enforced. Browser cannot change moderation status.

Referral activation RPC is service-only, not a client endpoint. Unique account attribution and reward uniqueness prevent campaign replay. Raw ledger identities are not exposed to partners. Cancellation appends an idempotent negative entry. Minor recruitment, raw signup/click and relation confirmation cannot qualify; school attribution never verifies a student.

Read-only hosted advisor check is unchanged: eight callable public-definer warnings on the deployed older stack and leaked-password protection disabled. Local changes are unapplied, so this is drift evidence, not approval of new migrations.

## FOUNDATION ONLY / FUTURE DEPENDENCY

See the six domain architecture documents for boundaries. No audition upload/delivery, guardian evidence UI, automated trusted referral activation/fulfillment, recurring education registration, public SSR SEO or full Crew Builder. Do not infer these from empty tables.

## RELEASE BLOCKER

Staging restore rehearsal and hosted RLS/Storage checks; permission review; child safeguarding/evidence/retention and media sanitation; moderation/rate limits; referral worker review; dependency remediation; real SEO routes. Domain schema and local gates may advance to Stage C, but these are NOT production launch gates.
