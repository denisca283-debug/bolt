import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Isolated PG socket-only cluster. Never connect to a saved or production database.
// These fixtures verify concurrency of the exact C migrations, NOT full-stack RLS.
const commercialTerms={"version":1,"valid_until":"2099-12-31T00:00:00Z","availability_status":"available","availability_statement":"Confirmed fixture availability","delivery_cost_minor":0,"pickup_cost_minor":0,"tax_inclusion":"included","deposit_terms":"No security deposit","insurance_terms":"Included","prep_service_cost_minor":0,"other_mandatory_fees_minor":0,"commercial_terms_summary":"Complete fixture package, all mandatory costs disclosed","compliance":"compliant","comparison_complete":true};
const bin=process.env.FILMVERSE_PG_BIN||'';
const executable=name=>bin?join(bin,name):name;
const sync=(name,args)=>{const r=spawnSync(executable(name),args,{encoding:'utf8',timeout:30000});if(r.error||r.status!==0)throw new Error(r.error?.message||r.stderr||r.stdout);return r.stdout;};
test('real PostgreSQL races: bids, retry keys, rule edits, deadlines, wallet debit and refund',async t=>{
 const root=await mkdtemp(join(tmpdir(),'filmverse-pg-concurrency-'));const data=join(root,'data');const port=String(54000+Math.floor(Math.random()*10000));let started=false;
 const run=sql=>new Promise(resolve=>{const p=spawn(executable('psql'),['-X','-qAt','-h',root,'-p',port,'-U','fixture','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',error='';const timeout=setTimeout(()=>p.kill('SIGTERM'),20000);p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>error+=d);p.on('error',e=>{clearTimeout(timeout);resolve({code:1,out,error:e.message});});p.on('close',code=>{clearTimeout(timeout);resolve({code,out:out.trim(),error});});p.stdin.end(sql);});
 const ok=async sql=>{const r=await run(sql);assert.equal(r.code,0,r.error);return r.out;};
 const ids=[1,2,3,4,5,6,7,8,9].map(i=>'60000000-0000-4000-8000-'+String(i).padStart(12,'0'));const [buyer,b,c,project,event,pb,pc,wallet]=ids;
 const as=(id,sql)=>`BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${id}',true);${sql};COMMIT;`;
 const bid=(person,party,request,price,delay=false)=>as(person,`SELECT public.sourcing_bid_submit('${event}','${party}',NULL,'${request}','[{"description":"package","quantity":1,"unit_price_minor":${price}}]'::jsonb,'${JSON.stringify(commercialTerms)}'::jsonb)${delay?';SELECT pg_sleep(0.2)':''}`);
 try{
 sync('initdb',['-D',data,'--username=fixture','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
 sync('pg_ctl',['-D',data,'-l',join(root,'server.log'),'-o',`-k '${root}' -p ${port} -c listen_addresses=''`,'-w','start']);started=true;
 await ok(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE SCHEMA filmverse_private;GRANT USAGE ON SCHEMA public,auth,filmverse_private TO anon,authenticated,service_role;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id));
 CREATE TABLE public.organizations(id uuid PRIMARY KEY);
 CREATE TABLE public.organization_role_permissions(role_key text,permission text,PRIMARY KEY(role_key,permission));
 CREATE TABLE public.organization_members(organization_id uuid,user_id uuid,role text,active boolean DEFAULT true);
 CREATE TABLE public.projects(id uuid PRIMARY KEY,user_id uuid,organization_id uuid);
 CREATE TABLE public.project_members(project_id uuid,user_id uuid,status text);
 CREATE FUNCTION filmverse_private.org_discoverable(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=org) $$;
 CREATE FUNCTION filmverse_private.org_can(org uuid,permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organization_role_permissions rp ON rp.role_key=m.role AND rp.permission=$2 WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.active) $$;
 CREATE FUNCTION filmverse_private.project_can(project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.projects WHERE id=project AND (user_id=auth.uid() OR filmverse_private.org_can(organization_id,'manage_projects'))) $$;
 CREATE FUNCTION filmverse_private.project_collaborator(project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT filmverse_private.project_can(project) $$;
 CREATE FUNCTION filmverse_private.person_contactable(person uuid,action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() IS NOT NULL AND person<>auth.uid() $$;
 CREATE FUNCTION filmverse_private.org_public(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=org) $$;
 CREATE FUNCTION filmverse_private.ledger_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'append_only_ledger' USING ERRCODE='42501';END $$;`);
 for(const name of ['20260919031153_sourcing_need_foundation.sql','20260919031615_ai_wallet_agent_foundation.sql','20260919042407_sourcing_commercial_authority_correction.sql'])await ok(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await ok(`INSERT INTO auth.users VALUES('${buyer}'),('${b}'),('${c}');INSERT INTO profiles SELECT id FROM auth.users;
 INSERT INTO projects(id,user_id) VALUES('${project}','${buyer}');
 INSERT INTO sourcing_events(id,project_id,created_by,title,event_type,competition_mode,currency,starts_at,ends_at,status,ever_opened) VALUES('${event}','${project}','${buyer}','Race fixture','equipment','reverse_auction','RUB',now()-interval '1 day',now()+interval '1 day','open',true);
 INSERT INTO sourcing_participants(id,event_id,user_id,status,acknowledged_version) VALUES('${pb}','${event}','${b}','qualified',1),('${pc}','${event}','${c}','qualified',1);
 INSERT INTO ai_wallets(id,user_id) VALUES('${wallet}','${buyer}');UPDATE ai_operation_catalog SET enabled=true,credit_cost=1 WHERE operation_code='filters.parse';
 SELECT filmverse_private.ai_grant('${wallet}','grant',1,'server:initial');`);
 await t.test('same-price simultaneous bids serialize; only one can satisfy decrement',async()=>{
  const results=await Promise.all([run(bid(b,pb,crypto.randomUUID(),10000,true)),run(bid(c,pc,crypto.randomUUID(),10000,true))]);
  assert.equal(results.filter(r=>r.code===0).length,1,JSON.stringify(results));assert.match(results.find(r=>r.code!==0).error,/minimum_decrement_required/);
  assert.equal(await ok('SELECT count(*) FROM sourcing_bids'),'1');
 });
 await t.test('concurrent same request produces one immutable bid and same response',async()=>{
  const req=crypto.randomUUID();const results=await Promise.all([run(bid(b,pb,req,9900,true)),run(bid(b,pb,req,9900,true))]);
  for(const r of results)assert.equal(r.code,0,r.error);assert.equal(results[0].out,results[1].out);
  assert.equal(await ok(`SELECT count(*) FROM sourcing_bids WHERE request_id='${req}'`),'1');
 });
 await t.test('rule revision and bid race never writes an unacknowledged new version',async()=>{
  const results=await Promise.all([run(as(b,`SELECT public.sourcing_bid_submit('${event}','${pb}',NULL,'${crypto.randomUUID()}','[{"description":"package","quantity":1,"unit_price_minor":9800}]','${JSON.stringify(commercialTerms)}'::jsonb);SELECT pg_sleep(0.2)`)),run(as(buyer,`SELECT public.sourcing_revise('${event}','Changed specification',now()+interval '1 day',20000,'Material change for concurrent test')`))]);
  assert.equal(results[1].code,0,results[1].error);
  if(results[0].code!==0)assert.match(results[0].error,/bidding_not_open_or_acknowledged/);
  assert.equal(await ok('SELECT count(*) FROM sourcing_bids WHERE event_version=2'),'0');
  assert.equal(await ok(`SELECT status FROM sourcing_events WHERE id='${event}'`),'qualification');
 });
 await t.test('bid waiting for event lock uses fresh server clock after deadline',async()=>{
  await ok(`UPDATE sourcing_events SET status='open',ends_at=clock_timestamp()+interval '200 milliseconds';UPDATE sourcing_participants SET acknowledged_version=2;`);
  const lock=run(`BEGIN;SELECT 1 FROM sourcing_events WHERE id='${event}' FOR UPDATE;SELECT pg_advisory_xact_lock(717123);SELECT pg_sleep(1);COMMIT;`);
  // Marker is acquired only AFTER the event row lock; observe it before dispatching the waiting bid.
  let ready=false;for(let i=0;i<30;i++){if(await ok("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=717123 AND granted")==='1'){ready=true;break;}await new Promise(r=>setTimeout(r,10));}assert.equal(ready,true,'event lock must be held before race');
  const r=await run(bid(c,pc,crypto.randomUUID(),9700));await lock;
  assert.notEqual(r.code,0);assert.match(r.error,/bidding_not_open_or_acknowledged/);
 });
 await t.test('withdrawal and award race serialize: never both withdrawn and awarded',async()=>{
  await ok(`UPDATE sourcing_events SET status='open',ends_at=clock_timestamp()+interval '1 day';UPDATE sourcing_participants SET acknowledged_version=2;`);
  const offer=await ok(as(b,`SELECT public.sourcing_bid_submit('${event}','${pb}',NULL,'${crypto.randomUUID()}','[{"description":"complete package","quantity":1,"unit_price_minor":9000}]','${JSON.stringify(commercialTerms)}')`));
  const bidId=offer.split('\n').at(-1);
  await ok(`UPDATE sourcing_events SET ends_at=clock_timestamp()-interval '1 second';`);
  const results=await Promise.all([
   run(as(b,`SELECT public.sourcing_bid_withdraw('${bidId}','Provider withdraws final offer')`)),
   run(as(buyer,`SELECT public.sourcing_award('${bidId}','manual_best_value','Reviewed final package and availability')`))
  ]);
  assert.equal(results.filter(r=>r.code===0).length,1,JSON.stringify(results));
  assert.match(results.find(r=>r.code!==0).error,/awarded_offer_cannot_withdraw|award_not_eligible/);
  assert.equal(await ok(`SELECT (SELECT count(*) FROM sourcing_awards WHERE bid_id='${bidId}')+(SELECT count(*) FROM sourcing_bid_withdrawals WHERE bid_id='${bidId}')`),'1');
 });
 let operation;
 await t.test('two simultaneous debits with one credit cannot overspend',async()=>{
  const consume=req=>as(buyer,`SELECT public.ai_consume('${wallet}','${project}','filters.parse','${req}');SELECT pg_sleep(0.2)`);
  const results=await Promise.all([run(consume(crypto.randomUUID())),run(consume(crypto.randomUUID()))]);
  assert.equal(results.filter(r=>r.code===0).length,1,JSON.stringify(results));assert.match(results.find(r=>r.code!==0).error,/insufficient_ai_credits/);
  assert.equal(await ok(`SELECT sum(credits) FROM ai_credit_ledger WHERE wallet_id='${wallet}'`),'0');
  operation=await ok('SELECT id FROM ai_usage_operations LIMIT 1');
 });
 await t.test('concurrent refunds return exact debit once, no minted credits',async()=>{
  const results=await Promise.all([run(`SELECT filmverse_private.ai_refund('${operation}')`),run(`SELECT filmverse_private.ai_refund('${operation}')`)]);
  for(const r of results)assert.equal(r.code,0,r.error);assert.equal(await ok("SELECT count(*) FROM ai_credit_ledger WHERE entry_type='refund'"),'1');
  assert.equal(await ok(`SELECT sum(credits) FROM ai_credit_ledger WHERE wallet_id='${wallet}'`),'1');
 });
 }finally{
 if(started)sync('pg_ctl',['-D',data,'-m','fast','-w','stop']);
 // Only the exact mkdtemp directory created by this test is removed.
 await rm(root,{recursive:true,force:true});
 }
});
