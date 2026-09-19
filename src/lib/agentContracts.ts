/** Typed contract only: no provider, service-role client, SQL executor or hidden memory. */
export type AgentRiskLevel = 'low' | 'medium' | 'high';
export type AgentToolKind = 'read' | 'propose' | 'write';
export type AgentContext = Readonly<{ userId: string; projectId: string; organizationId: string | null; requestId: string }>;
export type AgentIntent = Readonly<{ objective: string; constraints: readonly AgentConstraint[] }>;
export type AgentConstraint = Readonly<{ field: string; operator: 'equals' | 'at_least' | 'at_most'; value: string | number | boolean; required: boolean }>;
export type AgentEvidence = Readonly<{ source: 'filmverse'; entityType: string; entityId: string; field: string; observedAt: string; value: string | number | boolean | null }>;
export type AgentRecommendation = Readonly<{ subjectId: string; matched: readonly AgentEvidence[]; unknown: readonly string[]; conflicts: readonly AgentEvidence[]; explanation: string }>;
export type AgentToolResult<T = unknown> = Readonly<{ status: 'ok' | 'denied' | 'unavailable'; data: T | null; evidence: readonly AgentEvidence[]; unknown: readonly string[] }>;
export type AgentActionProposal = Readonly<{ id: string; projectId: string; initiatingUser: string; tool: AgentToolCode; argumentsHash: string; expiresAt: string; risk: AgentRiskLevel }>;
export type AgentToolDefinition = Readonly<{ kind: AgentToolKind; risk: AgentRiskLevel; permission: string; minorPolicy: 'forbidden' | 'authorized_search' | 'guardian_domain'; description: string }>;
const read = (permission: string, description: string): AgentToolDefinition => ({kind:'read',risk:'low',permission,minorPolicy:'forbidden',description});
export const agentToolRegistry = {
 'project.get_context': read('project.read','Current accessible project summary'),
 'project.get_needs': read('project.read','Canonical needs, not agent shadow state'),
 'project.create_need': {kind:'write',risk:'high',permission:'project.manage',minorPolicy:'guardian_domain',description:'Create canonical project need after approval'},
 'actors.search': read('people.search','Adult actor discovery'),
 'models.search': read('people.search','Adult model discovery'),
 'young_talent.search': {...read('search_minor_talent','Protected discovery only; never child contact'),minorPolicy:'authorized_search'},
 'professionals.search': read('people.search','Find crew with explicit evidence'),
 'companies.search': read('companies.search','Company discovery'),
 'professional_graph.search': read('people.search','Consenting visible graph edges; not ranking privilege'),
 'equipment.search': read('equipment.search','Equipment catalogue, availability unknown unless verified'),
 'rental.search_packages': read('equipment.search','Published rental packages'),
 'casting.search_for_role': {kind:'read',risk:'medium',permission:'casting.read',minorPolicy:'guardian_domain',description:'Authorized project casting context'},
 'casting.add_candidate': {kind:'write',risk:'high',permission:'casting.manage',minorPolicy:'guardian_domain',description:'Canonical role candidate; guardian consent enforced by domain'},
 'sourcing.create_draft': {kind:'write',risk:'high',permission:'project.manage',minorPolicy:'forbidden',description:'Draft only; no auction for actors/models/minors'},
 'sourcing.find_participants': read('sourcing.read','Eligible providers without sending invites'),
 'sourcing.compare_bids': read('sourcing.review','Only bids currently visible to buyer; seal preserved'),
 'education.search': read('education.search','Published education programs'),
 'events.search': read('events.search','Accessible industry events'),
 'offers.search': read('offers.search','Published offers, no invented prices'),
 'budget.calculate_scenario': read('project.read','Deterministic minor-unit arithmetic'),
 'messages.draft': {kind:'propose',risk:'medium',permission:'messages.draft',minorPolicy:'forbidden',description:'Draft text only; never send'}
} as const satisfies Record<string,AgentToolDefinition>;
export type AgentToolCode = keyof typeof agentToolRegistry;

/** Must be implemented on a trusted server using the initiating user's RLS scope.
 * authorize rechecks live membership/permissions, never trusts request-supplied flags.
 * writeApproved must atomically bind+consume a current DB approval and execute the
 * canonical mutation, rechecking permissions/consent; no standalone consume-then-write.
 */
export interface AgentDomainGateway {
 authorize(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>): Promise<boolean>;
 read(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>): Promise<AgentToolResult>;
 propose(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>): Promise<AgentToolResult>;
 writeApproved(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>, approvalId: string): Promise<AgentToolResult>;
}
export async function executeAgentTool(gateway:AgentDomainGateway, context:AgentContext, code:string, args:Readonly<Record<string,unknown>>, approvalId?:string):Promise<AgentToolResult>{
 const denied:AgentToolResult={status:'denied',data:null,evidence:[],unknown:[]};
 if(!context.userId||!context.projectId||!context.requestId||!Object.prototype.hasOwnProperty.call(agentToolRegistry,code)||!args||Array.isArray(args)||typeof args!=='object')return denied;
 const tool=code as AgentToolCode;const definition:AgentToolDefinition=agentToolRegistry[tool];
 // Explicit deny by tool allowlist: no contact_child, approve_compliance, grant_permission,
 // auto_book, send_message or arbitrary_sql can ever be dispatched.
 if(!await gateway.authorize(context,tool,args))return denied;
 if(definition.kind==='write'){if(!approvalId)return denied;return gateway.writeApproved(context,tool,args,approvalId);}
 if(definition.kind==='propose')return gateway.propose(context,tool,args);
 return gateway.read(context,tool,args);
}
export function calculateBudget(items:readonly {quantity:bigint;unitPriceMinor:bigint}[]):bigint{
 if(items.length>1000)throw new Error('too_many_items');
 return items.reduce((total,item)=>{if(item.quantity<0n||item.unitPriceMinor<0n)throw new Error('negative_budget_input');return total+item.quantity*item.unitPriceMinor;},0n);
}
