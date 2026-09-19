# FilmVerse Production Agent

## IMPLEMENTED

One typed conceptual agent, not a swarm. AgentContext, Intent, Constraint, ToolDefinition, ToolResult, ActionProposal, Evidence, Recommendation and RiskLevel are defined in src/lib/agentContracts.ts.
Explicit tool allowlist separates read/propose/write. Unknown tool names, SQL execution, child contact, auto-booking and message sending are not dispatchable. Critical catalog entries (verification, guardian authority, legal approval, permission grant, billing authority, destructive production delete and settlement release) are explicitly NON-EXECUTABLE even with an approval ID.
Each call delegates current user/project authorization to a trusted domain gateway; writes require DB approval ID and an atomic approve-bound domain operation. Client booleans are not approvals.
SQL proposal approval binds initiating user/project/hash/expiry and rechecks project authority. Browser cannot create/change proposal arguments or insert memory.
Recommendation contract is matched/unknown/conflicts with source evidence, never fabricated numeric suitability. Deterministic bigint budget arithmetic is separate from LLM prose.

## FOUNDATION ONLY

No LLM provider, hosted executor or live domain gateway is installed. Typed dispatcher tests are contract tests, not a claim that an AI assistant is operating.
Database project memory contains only operational summary/evidence schema, no hidden-chain-of-thought mechanism.
Approval storage is not yet an executable action queue. Messages tool drafts only.
Young Talent search must bind to reviewed permission and existing protected RPC; casting mutation remains subject to actual guardian/consent checks.

## Corrected root contracts

Risk: low/medium/high/critical. Context requests carry nullable organization/project/casting-role IDs, locale, currency and requestId. resolveContext on the trusted gateway obtains session identity and a server authorization reference/time; supplied userId/permission/approved fields are stripped. authorize still rechecks domain authority per operation. Nullable project allows future nonproject tools; project/casting/sourcing/budget tools currently require a resolved project. No live gateway exists.

Each immutable tool definition has stable code/name, version, kind, risk, permission, minor policy, versioned input/output schema references, approval requirement, audit policy and description. Schema references identify future domain-owned validators; they are not a claim that all live payload validators are implemented. Gateway implementation must validate both input and output against those versions before deployment. No external schema dependency is introduced.

Constraints support equals/not_equals/in/not_in/at_least/at_most/between/contains/date_window with explicit editable values and bounded runtime validation. Evidence supports filmverse/provider_quote/partner_catalog/trusted_external_adapter with sourceReference, observedAt and current/stale/unknown freshness. External adapters are future trusted integrations, not scraping and never a privacy/RLS bypass.

### Future offers.search mapping

Trusted session-bound gateway → commercial_offers SELECT under initiating-user RLS, with status=published, valid_from<=server time<valid_until, provider/category/geography filters and bounded pagination. Return factual type/claim_status/discount structure/currency/terms and provenance/freshness. Never turn sponsored_promotion or possible into confirmed savings. Project-specific applicability uses trusted commercial_offer_eligibility through its reviewed domain operation, never browser/service-role broad queries. There is a canonical domain now, but no hosted tool executor or live AI integration.

Future settlement/rights/provenance boundaries: [digital-assets-blockchain-readiness.md](digital-assets-blockchain-readiness.md). Wallet ownership never supplies context authority; AI cannot release funds.

## FUTURE DEPENDENCY

Trusted session-bound gateway, provider choice, cost/timeout limits, field-level redaction, schema validation per tool, prompt-injection defenses, factual result freshness, audit visibility, approved-action transaction implementation and retry-safe worker.

## RELEASE BLOCKER

Do not expose a service-role AI endpoint. Never run arbitrary SQL or trust inferred permissions, availability, compliance or prices. No cross-project memory. No automatic child contact, booking, permission grant, compliance approval or workforce commercial commitment.
