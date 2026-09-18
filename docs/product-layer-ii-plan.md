# Product layer II — implementation ledger

Base: reviewed GitHub 950dca2759ae283d6bb8c2e3d5590ce9ba445d4d.
Branch: epic/identity-organizations-resume; stacked on PR #3, not main.
No production mutations, migration application, seeds or deployment.

## Audit

004 organizations/member IDs retained. Live read-only audit: zero organizations,
zero memberships. Existing member list is public; creator bypasses membership;
auth-user cascade could delete company data. Verification evidence is owner-only
but needs deliberate company badge projection. Existing personal content and
organization ownership are separate; no organization login accounts.

## Sequence and gates

1. Organization identity, immutable role catalogue, permissions, atomic creation,
   last-owner safety, invitations, private roster and public projection.
2. Content ownership, project relationship graph, agency/rental/business foundations.
3. Viewer-aware person privacy, contacts/media/representation, work context.
4. Persisted Resume with atomic idempotent entitlement consumption; skills/tags.
5. Functional company/person screens, context switch, discovery/settings.
6. Full replay/adversarial/browser checks, stacked PR and architecture review.

Every phase: inspect diff, run typecheck/lint/tests/build, then commit. No fake
checkout, bookings, metrics, email sending or unsupported workspace sections.
New tables default deny; public APIs project only intentional public fields.
Private helpers live outside exposed schemas. Sensitive multi-row writes use
transactions and lock the organization (membership) or account (entitlements).
