import test from 'node:test';
import assert from 'node:assert/strict';
import {executeAgentTool,calculateBudget,agentToolRegistry} from '../src/lib/agentContracts.ts';
import {resolveNeed} from '../src/lib/projectNeed.ts';
test('agent allowlist separates reads/proposals/writes and refuses arbitrary SQL, minor contact and unapproved mutation',async()=>{
 const ctx={userId:'a',projectId:'p',organizationId:null,requestId:'r'};const calls=[];
 const ok={status:'ok',data:null,evidence:[],unknown:['availability']};
 const gateway={authorize:async(c,t)=>{calls.push(t);return t!=='young_talent.search';},read:async()=>ok,propose:async()=>ok,writeApproved:async(c,t,a,id)=>id==='trusted-db-proposal'?ok:{...ok,status:'denied'}};
 for(const code of ['sql.execute','minor.contact','compliance.approve','permission.grant','child.auto_book','messages.send','__proto__'])assert.equal((await executeAgentTool(gateway,ctx,code,{})).status,'denied');
 assert.equal(calls.length,0);
 assert.equal((await executeAgentTool(gateway,ctx,'young_talent.search',{})).status,'denied');
 assert.equal((await executeAgentTool(gateway,ctx,'project.create_need',{})).status,'denied');
 assert.equal((await executeAgentTool(gateway,ctx,'project.create_need',{},'forged')).status,'denied');
 assert.equal((await executeAgentTool(gateway,ctx,'project.create_need',{},'trusted-db-proposal')).status,'ok');
 assert.equal((await executeAgentTool(gateway,ctx,'project.get_needs',{})).status,'ok');
 assert.equal(agentToolRegistry['messages.draft'].kind,'propose');
});
test('Crew Builder routes casting and minors outside price sourcing; budget uses integer arithmetic',()=>{
 assert.equal(resolveNeed('casting_subject'),'casting');assert.equal(resolveNeed('casting_subject',true),'young_talent_casting');
 assert.equal(resolveNeed('person'),'professional_proposal');assert.equal(resolveNeed('package'),'equipment_sourcing');
 assert.throws(()=>resolveNeed('person',true));assert.equal(calculateBudget([{quantity:3n,unitPriceMinor:101n},{quantity:2n,unitPriceMinor:10n}]),323n);
 assert.throws(()=>calculateBudget([{quantity:-1n,unitPriceMinor:1n}]));
});
