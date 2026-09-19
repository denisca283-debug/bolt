import test from 'node:test';
import assert from 'node:assert/strict';
import {executeAgentTool,calculateBudget,agentToolRegistry,isAgentConstraint} from '../src/lib/agentContracts.ts';
import {resolveNeed} from '../src/lib/projectNeed.ts';
test('agent allowlist separates reads/proposals/writes and refuses arbitrary SQL, minor contact and unapproved mutation',async()=>{
 const ctx={projectId:'p',organizationId:null,castingRoleId:null,locale:'ru-RU',currency:'RUB',requestId:'r'};const calls=[];
 const ok={status:'ok',data:null,evidence:[],unknown:['availability']};
 const gateway={resolveContext:async request=>({...request,userId:'server-session-user',authorization:{reference:'trusted-resolution',resolvedAt:new Date().toISOString(),source:'server'}}),authorize:async(c,t)=>{calls.push(t);return t!=='young_talent.search';},read:async()=>ok,propose:async()=>ok,writeApproved:async(c,t,a,id)=>id==='trusted-db-proposal'?ok:{...ok,status:'denied'}};
 for(const code of ['sql.execute','minor.contact','compliance.approve','permission.grant','child.auto_book','messages.send','__proto__'])assert.equal((await executeAgentTool(gateway,ctx,code,{})).status,'denied');
 assert.equal(calls.length,0);
 assert.equal((await executeAgentTool(gateway,ctx,'young_talent.search',{})).status,'denied');
 assert.equal((await executeAgentTool(gateway,ctx,'project.create_need',{})).status,'denied');
 assert.equal((await executeAgentTool(gateway,ctx,'project.create_need',{},'forged')).status,'denied');
 assert.equal((await executeAgentTool(gateway,ctx,'project.create_need',{},'trusted-db-proposal')).status,'ok');
 assert.equal((await executeAgentTool(gateway,ctx,'project.get_needs',{})).status,'ok');
 assert.equal(agentToolRegistry['messages.draft'].kind,'propose');
});
test('critical operations cannot execute even with approval; client authority is stripped before server resolution',async()=>{
 const ctx={userId:'forged',projectId:'p',organizationId:null,castingRoleId:null,locale:'ru-RU',currency:'RUB',requestId:'r',permissions:['*'],approved:true};
 let resolved=0,executed=0;
 const gateway={resolveContext:async request=>{resolved++;assert.equal('userId' in request,false);assert.equal('permissions' in request,false);assert.equal('approved' in request,false);return {...request,userId:'actual-session',authorization:{source:'server',reference:'checked',resolvedAt:'2026-09-19T00:00:00Z'}};},authorize:async context=>{assert.equal(context.userId,'actual-session');return false;},read:async()=>{executed++;},writeApproved:async()=>{executed++;}};
 for(const [code,definition] of Object.entries(agentToolRegistry)){
  assert.equal(definition.code,code);assert.equal(definition.version,1);assert.equal(definition.inputSchema.version,1);assert.equal(definition.outputSchema.version,1);assert.ok(Object.isFrozen(definition));
  if(definition.risk==='critical')assert.equal((await executeAgentTool(gateway,ctx,code,{},'approved')).status,'denied');
 }
 assert.equal(resolved,0);assert.equal(executed,0);
 assert.equal((await executeAgentTool(gateway,ctx,'project.get_context',{})).status,'denied');assert.equal(resolved,1);assert.equal(executed,0);
});
test('Crew Builder routes casting and minors outside price sourcing; budget uses integer arithmetic',()=>{
 assert.equal(resolveNeed('casting_subject'),'casting');assert.equal(resolveNeed('casting_subject',true),'young_talent_casting');
 assert.equal(resolveNeed('person'),'professional_proposal');assert.equal(resolveNeed('package'),'equipment_sourcing');
 assert.throws(()=>resolveNeed('person',true));assert.equal(calculateBudget([{quantity:3n,unitPriceMinor:101n},{quantity:2n,unitPriceMinor:10n}]),323n);
 assert.throws(()=>calculateBudget([{quantity:-1n,unitPriceMinor:1n}]));
});
test('editable typed constraints retain negation, sets, ranges, text and date windows without hidden predicates',()=>{
 const valid=[['equals','Moscow'],['not_equals',false],['in',['RU','KZ']],['not_in',['unavailable']],['at_least',1],['at_most',100],['between',[1,10]],['contains','camera'],['date_window',{startsAt:'2026-10-01',endsAt:'2026-10-04',mode:'overlaps'}]];
 for(const [operator,value] of valid)assert.equal(isAgentConstraint({field:'test',required:true,operator,value}),true,operator);
 for(const [operator,value] of [['sql','DROP'],['in',[]],['between',[10,1]],['at_least',NaN],['date_window',{startsAt:'invalid',endsAt:'2026-10-04',mode:'within'}]])assert.equal(isAgentConstraint({field:'test',required:true,operator,value}),false);
});
