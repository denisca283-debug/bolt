# Digital assets / blockchain readiness

**ARCHITECTURE READY — NOT IMPLEMENTED — LEGAL/PROVIDER DEPENDENCY — SECURITY REVIEW REQUIRED**

This is a future boundary contract, not a payment product, legal determination or implementation approval. `src/lib/settlementContracts.ts` contains types and pure validation only. No provider/network calls, speculative production tables, token, wallet login, custody, contracts, crypto UI, Web3 SDK or blockchain dependency are added.

## Source of truth and separation

FilmVerse PostgreSQL and authorized domain services own identity, sessions, permissions, projects, casting, minors, professional graph, sourcing, approvals and AI. Blockchain is optional independent evidence/settlement infrastructure, NEVER the source of truth for these domains.

PRICE → INVOICE/OBLIGATION → SETTLEMENT → ASSET are distinct. A `DomainObligation` records immutable versioned currency and integer minor units (for example 18000000 RUB minor units). A `SettlementIntent` references that obligation, a rail, a reviewed provider and a server policy decision. `SettlementTransaction` records provider state, exact asset atomic units/decimals and a separate conversion observation with source/time/expiry and exact numerator/denominator. Asset volatility or a failed transaction never rewrites the original price, production budget or obligation.

`SettlementRail` supports bank_transfer, card, digital_ruble, stablecoin, crypto and other_regulated. This list describes possible adapters, not availability or legality. No Stripe-, TON-, EVM- or Solana-specific root dependency exists. A versioned `SettlementProvider` can later implement a reviewed rail. Network namespace/reference belongs to the adapter or asset record, not Project/Need/Casting.

## Jurisdiction and provider policy

`SettlementPolicy` addresses country, region, individual/company type, transaction type, obligation currency, rail/asset, regulatory review and provider availability. Technical availability never implies permission to offer a rail. A trusted service must resolve policy for BOTH counterparties and the full transaction context, with policy version, expiry and auditable authority reference. Browser location, permission flags, wallet selection and provider success messages are not authority. Unknown/conflicting jurisdictions or stale decisions fail closed for settlement, not for the core product. Actual country-specific rules require legal/provider review; none are asserted here.

## Wallet separation and internal units

Future `ExternalWalletLink` models owner user/organization, owner ID, network namespace/reference, address, custody type, verification method and verified/revoked timestamps. Linking requires authenticated account/company authority, explicit challenge/replay protections and revocation/recovery design in a separate security review. A wallet is NOT FilmVerse identity, login, verification, guardianship or project permission. A stolen wallet must not automatically compromise the FilmVerse account. Linking alone never adds a login method.

AI Credits, Referral Credits, Promotion Credits, Tender Credits and PRO entitlement remain internal non-transferable product units. They are not assets, cash, crypto, tradable tokens or verification/ranking weight. No credit-to-token exchange or token-funded verification. Any future transferable FilmVerse token would need independent economics, regulatory, tax, AML/KYC, jurisdiction and security reviews and must never be necessary to use the core platform. No token is issued or designed economically by this task.

## Escrow and milestones

Project, Sourcing Award, Rental Agreement or Professional Contract may later produce an obligation and settlement/escrow intent. Conceptual states: draft → funding_pending → funded → partially_released/released; disputed/refunded/cancelled are explicit domain transitions, not browser toggles. `EscrowIntent` requires an appropriate provider reference and provider evidence before anything is represented as funded/escrowed. FilmVerse does not hold custody or claim escrow without a licensed/otherwise appropriate provider and reviewed contracts.

Booking confirmed, equipment delivered, shoot completed and deliverable accepted can become factual versioned milestones. Domain-authorized approval records actor/time/version/audit reference. A milestone alone is not a chain instruction: approved release requires current policy, agreement, provider and human/domain authority. AI cannot authorize or release funds autonomously, including after generic conversational approval. `settlement.release` is critical/non-executable in the agent contract.

## Rights, revenues and financing

Future canonical rights_split_agreements retain project/content, beneficiary, effective period and agreement version. Allocation uses integer basis points; a valid complete allocation totals exactly 10000, without duplicate beneficiaries. Changing rights creates a new version; historical revenue must use its applicable agreement version. Future revenue_event → deterministic allocation → settlement intents must handle integer rounding/residuals by a reviewed canonical rule. No royalty execution or automatic distribution exists now.

Regulated film financing/digital participation is a separate future module: issuer, offering, investor eligibility, jurisdiction, rights, risk disclosures, KYC/AML, ownership/participation and distribution. Current crowdfunding must not become token issuance implicitly. No investment-return promise, eligibility inference or automated legal approval exists. `RegulatedFinancingBoundary` only names required references; it grants no authorization.

## Provenance and absolute privacy boundary

Private source documents remain versioned in FilmVerse authorized storage under domain/RLS controls. A new document version produces a new cryptographic hash. Internal provenance records can map entity type/ID/version, hash algorithm/content hash and storage reference to later network/transaction/time receipts. These internal mappings are NOT the public-chain payload.

Public proof is narrowly restricted to version, algorithm and cryptographic commitment hash. Never place minor identity, DOB, guardian evidence, passport/verification documents, phone/email, private contracts, sealed bid amount, supplier identity, private rates, medical/compliance records or home/school address directly on a public chain. Do not encode these as metadata, filenames, event labels or reversible values. Public-chain permanence also requires privacy review of hashes: hashing low-entropy personal/commercial data without protection is not anonymization.

No anchoring implementation is provided. Future commitments need canonical serialization, domain separation, versioned algorithms and a cryptographically random secret salt of at least 256 bits for guessable sealed data. Store salt/opening material privately; disclose only to authorized verifiers under reviewed policy. Never publish private opening material merely to demonstrate fairness. The strict TypeScript wire-shape validator cannot establish that arbitrary hash contents are privacy-safe; server/domain review remains mandatory.

## Optional sourcing fairness evidence

A future `SourcingCommitment` can bind event/version hash, bid commitment or round Merkle root, deadline and commit timestamp. Public proof must not expose supplier identity, price, terms or attachments. Later authorized reveal/proof may demonstrate that a bid/version existed and was not silently replaced after commitment. Network timestamps/confirmation levels and deadlines must have reviewed semantics; a chain timestamp is not automatically a legal deadline or trusted production clock.

PostgreSQL remains the operational engine for sealed visibility, RLS, qualification, immutable bid revisions, locks/concurrency, anti-sniping and award. Anchoring is asynchronous optional evidence, never auction storage or the authority to award. A failed anchor does not delete bids or silently alter round rules; show evidence status accurately.

## Adapter security, callbacks and failure isolation

Future escrow/splits/royalties/commitment contracts require versioned adapters, allowlisted audited contract versions, scoped credentials and emergency disable flags. Core code must never execute arbitrary browser-supplied contract addresses or calldata. No adapter is installed by this task.

Callbacks must be provider-authenticated, replay-protected, idempotent by provider/event reference, transactionally applied to the correct intent and audited. Recheck authorization where relevant and model reversals/reorgs rather than overwriting history. Never trust browser claims of transaction success, wallet balance, chain confirmation or exchange rate. A submitted transaction is not settled funds.

Chain/RPC/wallet outage, extreme gas, disabled asset, unavailable provider or jurisdiction restriction must only disable/defer that rail. Casting, projects, Crew Builder, sourcing and AI continue. Traditional permitted rails may remain available according to policy; no automatic substitution without explicit approved terms.

## Future scenario and release gate

A Russian production retains its RUB-denominated project and obligation while an authorized foreign counterparty participates. Subject to independent legal and provider validation, the settlement layer could use a bank rail, digital-ruble-compatible provider or permitted digital asset/stablecoin adapter. Projects/Casting/Crew Builder/Sourcing/AI contracts do not change. This is architectural capability, not a claim any cross-border route is currently lawful or available.

Before implementation: domain obligation/contract review, jurisdiction matrix, provider diligence, threat modeling, privacy impact review, adapter/contract audits, callback/reversal tests, backup/reconciliation, incident/emergency-disable playbooks and independent architectural approval. Core functionality must pass with every digital-asset rail disabled.

Tests are local pure functions: exact obligation units, integer allocation totals and proof payload exclusion. They make no external calls and do not prove settlement, legal compliance or blockchain security.
