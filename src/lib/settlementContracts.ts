/** ARCHITECTURE READY — NOT IMPLEMENTED. No payment, wallet, custody or network adapter. */
export type SettlementRail = 'bank_transfer' | 'card' | 'digital_ruble' | 'stablecoin' | 'crypto' | 'other_regulated';
export type DomainObligation = Readonly<{
 id: string; version: number; amountMinor: bigint; currency: string;
 source: Readonly<{ type: 'project' | 'sourcing_award' | 'rental_agreement' | 'professional_contract'; id: string; version: number }>;
}>;
export type SettlementPolicy = Readonly<{
 version: number; country: string; region: string | null;
 partyType: 'individual' | 'organization'; transactionType: string;
 obligationCurrency: string; rail: SettlementRail; assetReference: string | null;
 regulatoryStatus: 'unreviewed' | 'permitted' | 'restricted' | 'prohibited';
 providerReference: string | null; enabled: boolean;
}>;
/** A reference to a server decision, not a boolean supplied by a browser. */
export type SettlementPolicyDecision = Readonly<{ id: string; policyVersion: number; resolvedAt: string; expiresAt: string; authorityReference: string; allowed: boolean }>;
export type SettlementIntent = Readonly<{
 id: string; obligation: DomainObligation; rail: SettlementRail; providerReference: string;
 policyDecisionReference: string; idempotencyKey: string;
}>;
export type SettlementAssetAmount = Readonly<{ assetReference: string; atomicUnits: bigint; decimals: number; networkNamespace: string | null; networkReference: string | null }>;
export type ConversionObservation = Readonly<{ sourceReference: string; observedAt: string; expiresAt: string; numerator: bigint; denominator: bigint }>;
export type SettlementTransaction = Readonly<{
 id: string; intentId: string; providerTransactionReference: string;
 state: 'pending' | 'confirmed' | 'failed' | 'reversed'; settledAsset: SettlementAssetAmount;
 conversion: ConversionObservation | null; providerEventReference: string; verifiedAt: string | null;
}>;
export type ExternalWalletLink = Readonly<{
 id: string; ownerType: 'user' | 'organization'; ownerId: string;
 networkNamespace: string; networkReference: string; address: string;
 custodyType: 'self_custody' | 'provider_custody'; verificationMethod: string;
 verifiedAt: string | null; revokedAt: string | null;
}>;
// Wallet ownership is deliberately absent from identity, login and permission contracts.
export type InternalProductUnit = 'ai_credit' | 'referral_credit' | 'promotion_credit' | 'tender_credit' | 'pro_entitlement';
export type InternalProductBalance = Readonly<{ ownerId: string; unit: InternalProductUnit; quantity: bigint; transferable: false; redeemableForCrypto: false }>;
export type EscrowState = 'draft' | 'funding_pending' | 'funded' | 'partially_released' | 'released' | 'refunded' | 'disputed' | 'cancelled';
export type EscrowIntent = Readonly<{ id: string; obligationId: string; state: EscrowState; appropriateProviderReference: string | null; providerEvidenceReference: string | null }>;
export type DomainMilestoneApproval = Readonly<{ milestoneId: string; version: number; approvedBy: string; approvedAt: string; auditReference: string }>;
export type RightsSplitAgreement = Readonly<{
 projectOrContentReference: string; version: number; effectiveFrom: string; effectiveUntil: string | null;
 allocations: readonly Readonly<{ beneficiaryId: string; shareBasisPoints: number }>[];
}>;
/** Private mapping lives only in authorized FilmVerse storage; never serialized onto a chain. */
export type PrivateProvenanceRecord = Readonly<{ entityType: string; entityId: string; entityVersion: number; algorithm: 'SHA-256'; contentHash: string; storageReference: string }>;
export type PublicAnchorPayload = Readonly<{ version: 1; algorithm: 'SHA-256'; commitmentHash: string }>;
export type AnchoringReceipt = Readonly<{ payload: PublicAnchorPayload; networkNamespace: string; networkReference: string; transactionReference: string; anchoredAt: string }>;
export type SourcingCommitment = Readonly<{ eventId: string; eventVersion: number; round: number; deadline: string; committedAt: string; publicProof: PublicAnchorPayload; privateOpeningReference: string }>;
export type SettlementCallback = Readonly<{ provider: string; eventId: string; transactionReference: string; authenticatedEnvelopeReference: string }>;
/** Future server-only allowlisted implementation. No arbitrary user contract addresses. */
export interface SettlementProvider {
 readonly code: string;
 readonly version: number;
 readonly enabled: boolean;
 readonly reviewedAdapterReference: string;
 resolvePolicy(intent: SettlementIntent): Promise<SettlementPolicyDecision>;
 submit(intent: SettlementIntent, decisionReference: string): Promise<SettlementTransaction>;
 authenticateCallback(rawEnvelope: unknown): Promise<SettlementCallback>;
}
export type RegulatedFinancingBoundary = Readonly<{
 issuerReference: string; offeringReference: string; jurisdictionPolicyReference: string;
 investorEligibilityReference: string; kycAmlReference: string; rightsAgreementReference: string;
 riskDisclosureVersion: string; ownershipRegistryReference: string; distributionPolicyReference: string;
}>;

export function validateObligation(obligation: DomainObligation): void {
 if (!obligation.id || !Number.isInteger(obligation.version) || obligation.version < 1 || typeof obligation.amountMinor !== 'bigint' || obligation.amountMinor < 0n || !/^[A-Z]{3}$/.test(obligation.currency)) throw new Error('invalid_domain_obligation');
}
export function validateRightsSplit(agreement: RightsSplitAgreement): void {
 if (!Number.isInteger(agreement.version) || agreement.version < 1 || agreement.allocations.length < 1 || agreement.allocations.length > 1000) throw new Error('invalid_allocation_version');
 const ids = new Set<string>();let total = 0;
 for (const item of agreement.allocations) {
  if (!item.beneficiaryId || ids.has(item.beneficiaryId) || !Number.isInteger(item.shareBasisPoints) || item.shareBasisPoints <= 0 || item.shareBasisPoints > 10000) throw new Error('invalid_allocation');
  ids.add(item.beneficiaryId);total += item.shareBasisPoints;
 }
 if (total !== 10000) throw new Error('allocation_must_total_10000_basis_points');
}
/** Strict wire-shape check only; a domain/privacy review is still mandatory before anchoring. */
export function validatePublicAnchor(payload: unknown): payload is PublicAnchorPayload {
 if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
 const p = payload as Record<string, unknown>;
 return Object.keys(p).length === 3 && p.version === 1 && p.algorithm === 'SHA-256' && typeof p.commitmentHash === 'string' && /^[a-f0-9]{64}$/.test(p.commitmentHash);
}
