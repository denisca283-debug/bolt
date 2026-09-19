/** Typed contract only: no provider, service-role client, SQL executor or hidden memory. */
export type AgentRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AgentToolKind = 'read' | 'propose' | 'write';
export type AgentContextRequest = Readonly<{ projectId: string | null; organizationId: string | null; castingRoleId: string | null; locale: string; currency: string; requestId: string }>;
export type AgentContext = AgentContextRequest & Readonly<{ userId: string; authorization: Readonly<{ reference: string; resolvedAt: string; source: 'server' }> }>;
export type AgentIntent = Readonly<{ objective: string; constraints: readonly AgentConstraint[] }>;
type Scalar = string | number | boolean;
export type AgentConstraint = Readonly<{ field: string; required: boolean } & (
 { operator: 'equals' | 'not_equals'; value: Scalar } |
 { operator: 'in' | 'not_in'; value: readonly Scalar[] } |
 { operator: 'at_least' | 'at_most'; value: number } |
 { operator: 'between'; value: readonly [number, number] } |
 { operator: 'contains'; value: string } |
 { operator: 'date_window'; value: Readonly<{ startsAt: string; endsAt: string; mode: 'within' | 'overlaps' }> }
)>;
export type AgentEvidence = Readonly<{ source: 'filmverse' | 'provider_quote' | 'partner_catalog' | 'trusted_external_adapter'; sourceReference: string; entityType: string; entityId: string; field: string; observedAt: string; freshness: Readonly<{ expiresAt: string | null; status: 'current' | 'stale' | 'unknown' }>; value: Scalar | null }>;
export type AgentRecommendation = Readonly<{ subjectId: string; matched: readonly AgentEvidence[]; unknown: readonly string[]; conflicts: readonly AgentEvidence[]; explanation: string }>;
export type AgentToolResult<T = unknown> = Readonly<{ status: 'ok' | 'denied' | 'unavailable'; data: T | null; evidence: readonly AgentEvidence[]; unknown: readonly string[] }>;
export type AgentActionProposal = Readonly<{ id: string; projectId: string; initiatingUser: string; tool: AgentToolCode; argumentsHash: string; expiresAt: string; risk: AgentRiskLevel }>;
type ToolPolicy = Readonly<{ kind: AgentToolKind; risk: AgentRiskLevel; permission: string; minorPolicy: 'forbidden' | 'authorized_search' | 'guardian_domain'; description: string }>;
export type AgentSchemaReference = Readonly<{ id: string; version: number; format: 'filmverse-domain-v1' }>;
export type AgentToolDefinition = ToolPolicy & Readonly<{ code: string; name: string; version: number; inputSchema: AgentSchemaReference; outputSchema: AgentSchemaReference; approvalRequirement: 'none' | 'bound_user_approval' | 'non_executable'; auditPolicy: 'decision_and_redacted_arguments' }>;
const read = (permission: string, description: string): ToolPolicy => ({kind:'read',risk:'low',permission,minorPolicy:'forbidden',description});
const critical = (description: string): ToolPolicy => ({kind:'write',risk:'critical',permission:'never_agent',minorPolicy:'forbidden',description});
const toolPolicies = {
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
 'casting.search_for_role': {kind:'read',risk:'medium',permission:'view_casting',minorPolicy:'guardian_domain',description:'Authorized project casting context'},
 'casting.add_candidate': {kind:'write',risk:'high',permission:'manage_candidates',minorPolicy:'guardian_domain',description:'Canonical role candidate; guardian consent enforced by domain'},
 'sourcing.create_draft': {kind:'write',risk:'high',permission:'manage_sourcing',minorPolicy:'forbidden',description:'Draft only; no auction for actors/models/minors'},
 'sourcing.find_participants': read('view_sourcing','Eligible providers without sending invites'),
 'sourcing.compare_bids': read('evaluate_bids','Only bids currently visible to buyer; seal preserved'),
 'education.search': read('education.search','Published education programs'),
 'events.search': read('events.search','Accessible industry events'),
 'offers.search': read('offers.search','Published offers, no invented prices'),
 'budget.calculate_scenario': read('project.read','Deterministic minor-unit arithmetic'),
 'messages.draft': {kind:'propose',risk:'medium',permission:'messages.draft',minorPolicy:'forbidden',description:'Draft text only; never send'},
 'verification.review': critical('Independent human/domain review only'),
 'guardian.authorize': critical('No agent may establish guardian authority'),
 'legal.approve': critical('No legal or compliance approval by agent'),
 'permission.grant': critical('No agent permission escalation'),
 'billing.authorize': critical('No agent billing authority'),
 'production.destructive_delete': critical('No destructive production execution'),
 'settlement.release': critical('No autonomous fund release')
} as const satisfies Record<string,ToolPolicy>;
export type AgentToolCode = keyof typeof toolPolicies;
export const agentToolRegistry = Object.freeze(Object.fromEntries(Object.entries(toolPolicies).map(([code, policy])=>[code,Object.freeze({
 ...policy,code,name:code,version:1,
 inputSchema:Object.freeze({id:code+'.input',version:1,format:'filmverse-domain-v1'}),
 outputSchema:Object.freeze({id:code+'.output',version:1,format:'filmverse-domain-v1'}),
 approvalRequirement:policy.risk==='critical'?'non_executable':policy.kind==='write'?'bound_user_approval':'none',
 auditPolicy:'decision_and_redacted_arguments'
})])) as Record<AgentToolCode,AgentToolDefinition>);

/** Must be implemented on a trusted server using the initiating user's RLS scope.
 * authorize rechecks live membership/permissions, never trusts request-supplied flags.
 * writeApproved must atomically bind+consume a current DB approval and execute the
 * canonical mutation, rechecking permissions/consent; no standalone consume-then-write.
 */
export interface AgentDomainGateway {
 /** Derive identity from server session, resolve scope and fresh authority; never echo client flags. */
 resolveContext(request: AgentContextRequest): Promise<AgentContext | null>;
 authorize(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>): Promise<boolean>;
 read(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>): Promise<AgentToolResult>;
 propose(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>): Promise<AgentToolResult>;
 writeApproved(context: AgentContext, tool: AgentToolCode, args: Readonly<Record<string,unknown>>, approvalId: string): Promise<AgentToolResult>;
}
export async function executeAgentTool(gateway:AgentDomainGateway, request:AgentContextRequest, code:string, args:Readonly<Record<string,unknown>>, approvalId?:string):Promise<AgentToolResult>{
 const denied:AgentToolResult={status:'denied',data:null,evidence:[],unknown:[]};
 if(!request?.requestId||!Object.prototype.hasOwnProperty.call(agentToolRegistry,code)||!args||Array.isArray(args)||typeof args!=='object')return denied;
 const tool=code as AgentToolCode;const definition:AgentToolDefinition=agentToolRegistry[tool];
 if(definition.risk==='critical'||definition.approvalRequirement==='non_executable')return denied;
 // Copy only the scope request. Even an injected userId/permissions/approved flag never reaches the resolver.
 const context=await gateway.resolveContext({projectId:request.projectId??null,organizationId:request.organizationId??null,castingRoleId:request.castingRoleId??null,locale:request.locale,currency:request.currency,requestId:request.requestId});
 if(!context?.userId||!context.authorization?.reference||context.authorization.source!=='server'||context.requestId!==request.requestId)return denied;
 if(/^(project|casting|sourcing|budget)\./.test(tool)&&!context.projectId)return denied;
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
export function isAgentConstraint(input: unknown): input is AgentConstraint {
 if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
 const c=input as Record<string,unknown>;
 if(Object.keys(c).some(k=>!['field','operator','value','required'].includes(k))||typeof c.field!=='string'||c.field.length<1||c.field.length>100||typeof c.required!=='boolean')return false;
 const scalar=(v:unknown)=>typeof v==='boolean'||(typeof v==='string'&&v.length<=1000)||(typeof v==='number'&&Number.isFinite(v));
 switch(c.operator){
  case 'equals':case 'not_equals':return scalar(c.value);
  case 'in':case 'not_in':return Array.isArray(c.value)&&c.value.length>0&&c.value.length<=50&&c.value.every(scalar);
  case 'at_least':case 'at_most':return typeof c.value==='number'&&Number.isFinite(c.value);
  case 'between':return Array.isArray(c.value)&&c.value.length===2&&c.value.every(v=>typeof v==='number'&&Number.isFinite(v))&&c.value[0]<=c.value[1];
  case 'contains':return typeof c.value==='string'&&c.value.length>0&&c.value.length<=1000;
  case 'date_window':{
   if(!c.value||typeof c.value!=='object'||Array.isArray(c.value))return false;
   const v=c.value as Record<string,unknown>;
   return Object.keys(v).length===3&&['within','overlaps'].includes(String(v.mode))&&typeof v.startsAt==='string'&&typeof v.endsAt==='string'&&Number.isFinite(Date.parse(v.startsAt))&&Number.isFinite(Date.parse(v.endsAt))&&Date.parse(v.startsAt)<=Date.parse(v.endsAt);
  }
  default:return false;
 }
}
