# FilmVerse

## Product

FilmVerse is a professional platform for the film and production industry.

Initial market:
Russia + CIS.

Long-term:
international.

Core business loop:

professional profile
→ discover work
→ apply
→ employer reviews applicant
→ shortlist / waitlist / reject / approve
→ communication
→ join project/team.

One person = one account.

A user may have multiple professions.

Actors are an important entry market, but FilmVerse must support the whole production industry.

## Technology

Keep the existing stack unless explicitly approved:

- React
- TypeScript
- Vite
- Tailwind
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- RLS

Do not migrate frameworks or backend without explicit approval.

## Authentication

Supabase Auth session is the source of truth.

Authenticated user != complete profile.

A profile/database error must never automatically mean logged out.

Never fake authenticated state.

## Security

Never bypass RLS.

Never expose private user information publicly.

Never allow client-side privilege escalation.

Users cannot approve their own verification.

Users cannot grant themselves permissions.

Payment/PRO does not equal verification.

Treat auth, RLS, migrations, permissions, verification and user data as high-risk areas.

## Public product

Browsing public FilmVerse should work without registration where appropriate.

Authentication is required for actions such as:

- apply
- message
- save
- invite
- create project
- publish work
- edit own profile

## Engineering discipline

One task = one coherent bug or user flow.

Always inspect before editing.

Find the root cause before fixing.

Prefer minimal correct patches.

Do not modify unrelated files.

Do not add "while you're here" features.

Never claim something works unless verified.

Do not work directly on main.

Use a branch and Pull Request.

Before completing a code task, run all available:

- typecheck
- lint
- tests
- build

Review the git diff before finishing.

## Code review rules

Flag:

- authentication/session regressions
- insecure RLS
- exposure of private profile data
- client-side verification or permission escalation
- duplicated database sources of truth
- mock functionality presented as real functionality
- UI actions that claim success without database persistence
- destructive database migrations
- unrelated scope expansion

## Priority

Working software > generated code.

One finished user flow > ten unfinished screens.

Core hiring workflow > secondary social features.
