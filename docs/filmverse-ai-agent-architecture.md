# FilmVerse Production Agent

## IMPLEMENTED

One typed conceptual agent, not a swarm. AgentContext, Intent, Constraint, ToolDefinition, ToolResult, ActionProposal, Evidence, Recommendation and RiskLevel are defined in src/lib/agentContracts.ts.
Explicit tool allowlist separates read/propose/write. Unknown tool names, SQL execution, child contact, compliance approval, permission grant, auto-booking and message sending are not dispatchable.
Each call delegates current user/project authorization to a trusted domain gateway; writes require DB approval ID and an atomic approve-bound domain operation. Client booleans are not approvals.
SQL proposal approval binds initiating user/project/hash/expiry and rechecks project authority. Browser cannot create/change proposal arguments or insert memory.
Recommendation contract is matched/unknown/conflicts with source evidence, never fabricated numeric suitability. Deterministic bigint budget arithmetic is separate from LLM prose.

## FOUNDATION ONLY

No LLM provider, hosted executor or live domain gateway is installed. Typed dispatcher tests are contract tests, not a claim that an AI assistant is operating.
Database project memory contains only operational summary/evidence schema, no hidden-chain-of-thought mechanism.
Approval storage is not yet an executable action queue. Messages tool drafts only.
Young Talent search must bind to reviewed permission and existing protected RPC; casting mutation remains subject to actual guardian/consent checks.

## FUTURE DEPENDENCY

Trusted session-bound gateway, provider choice, cost/timeout limits, field-level redaction, schema validation per tool, prompt-injection defenses, factual result freshness, audit visibility, approved-action transaction implementation and retry-safe worker.

## RELEASE BLOCKER

Do not expose a service-role AI endpoint. Never run arbitrary SQL or trust inferred permissions, availability, compliance or prices. No cross-project memory. No automatic child contact, booking, permission grant, compliance approval or workforce commercial commitment.
