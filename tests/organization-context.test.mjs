import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const bundle=await build({entryPoints:['src/hooks/useOrganization.tsx'],bundle:true,write:false,format:'cjs',platform:'node',external:['react'],plugins:[{name:'organization-fixture',setup(build){
 build.onResolve({filter:/lib\/supabase$/},()=>({path:'client',namespace:'fixture'}));
 build.onResolve({filter:/\/useAuth$/},()=>({path:'auth',namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='client'?'export const supabase=globalThis.client;':'export const useAuth=()=>globalThis.auth;'}));
}}]});
test('company context survives same-person token refresh; logout and account switch clear authority',async()=>{
 const module={exports:{}}; let calls=0;
 const runtime={React,module,exports:module.exports,require:createRequire(import.meta.url),auth:{user:{id:'person-a'}},client:{from(table){
  calls++;
  const data=table==='organizations'?[{id:'company-a',name:'Production A'}]:table==='organization_members'?[{organization_id:'company-a',role:'owner'}]:[{role_key:'owner',permission:'publish_jobs'}];
  const query={select(){return query;},eq(){return query;},order(){return query;},limit(){return query;},then(resolve){return Promise.resolve({data,error:null}).then(resolve);}};
  return query;
 }}};
 vm.runInNewContext(bundle.outputFiles[0].text,runtime);
 let value,renderer;function Probe(){value=module.exports.useOrganization();return null;}
 const tree=()=>React.createElement(module.exports.OrganizationProvider,null,React.createElement(Probe));
 await act(async()=>{renderer=create(tree());});
 try{
  await act(async()=>value.select('company-a'));
  assert.equal(value.selected.id,'company-a');assert.equal(value.can('publish_jobs'),true);assert.equal(calls,3);
  runtime.auth={user:{id:'person-a',refreshed:true}};
  await act(async()=>renderer.update(tree()));
  assert.equal(value.selected.id,'company-a');assert.equal(calls,3,'no refetch/reset on a new auth object for the same account');
  runtime.auth={user:null};await act(async()=>renderer.update(tree()));
  assert.equal(value.selected,null);assert.equal(value.organizations.length,0);assert.equal(value.can('publish_jobs','company-a'),false);
  runtime.auth={user:{id:'person-b'}};await act(async()=>renderer.update(tree()));
  assert.equal(value.selected,null,'another person must explicitly choose their own publication context');
 }finally{act(()=>renderer.unmount());}
});
