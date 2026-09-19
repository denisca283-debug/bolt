import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('sourcing and AI: chronological replay, sealed bids, fair revisions, wallet and approval isolation',async t=>{
 const db=new PGlite();const q=async(s,a=[]) => { if(process.env.FILMVERSE_SQL_TRACE)console.error(s.slice(0,140));return (await db.query(s,a)).rows; };
 const scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('SET ROLE '+role);};
 const denied=(s,a=[])=>assert.rejects(q(s,a),e=>e.code==='42501');
 const [a,b,c,d]=[1,2,3,4].map(n=>'50000000-0000-4000-8000-00000000000'+n);
 try{
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text,bucket_id text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT SELECT,INSERT,DELETE ON storage.objects TO anon,authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()){if(process.env.FILMVERSE_SQL_TRACE)console.error(f);await db.exec(await readFile(new URL(f,dir),'utf8'));}
 for(const id of [a,b,c,d]){await q('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[id,id+'@test.invalid']);await q("INSERT INTO profiles(id,full_name,public_slug,city) VALUES($1,$2,$3,'Москва')",[id,'Person '+id,'person-'+id]);}


 let project,event,pb,pc,bid,request=crypto.randomUUID();
 const rule={title:'Equipment RFQ',event_type:'equipment',competition_mode:'sealed_rfq',currency:'RUB',starts_at:'2020-01-01T00:00:00Z',ends_at:'2099-01-01T00:00:00Z',budget_ceiling_minor:100000};
 const commercialTerms={"version":1,"valid_until":"2099-12-31T00:00:00Z","availability_status":"available","availability_statement":"Confirmed fixture availability","delivery_cost_minor":0,"pickup_cost_minor":0,"tax_inclusion":"included","deposit_terms":"No security deposit","insurance_terms":"Included","prep_service_cost_minor":0,"other_mandatory_fees_minor":0,"commercial_terms_summary":"Complete fixture package, all mandatory costs disclosed","compliance":"compliant","comparison_complete":true};
 const items=price=>[{description:'Equipment day',quantity:1,unit_price_minor:price}];
 async function inviteAndOpen(e){await as(a);const bpart=await scalar('SELECT sourcing_invite($1,$2,NULL)',[e,b]);const cpart=await scalar('SELECT sourcing_invite($1,$2,NULL)',[e,c]);await as(b);await q("SELECT sourcing_participant_decide($1,'accept')",[bpart]);await as(c);await q("SELECT sourcing_participant_decide($1,'accept')",[cpart]);await as(a);await q("SELECT sourcing_participant_decide($1,'qualify')",[bpart]);await q("SELECT sourcing_participant_decide($1,'qualify')",[cpart]);await q('SELECT sourcing_open($1)',[e]);return [bpart,cpart];}
 await t.test('Project Need is canonical and casting/minors cannot enter sourcing or crew reverse auction',async()=>{
  await as(a);project=await scalar("INSERT INTO projects(title) VALUES('Sourcing project') RETURNING id");
  const need=await scalar("INSERT INTO project_needs(project_id,title,target_type,resolution_route) VALUES($1,'Child lead','casting_subject','young_talent_casting') RETURNING id",[project]);
  await assert.rejects(q('SELECT sourcing_create($1,$2,$3)',[project,need,rule]),e=>e.code==='23514');
  await assert.rejects(q('SELECT sourcing_create($1,NULL,$2)',[project,{...rule,event_type:'individual_crew',competition_mode:'reverse_auction'}]),e=>e.code==='23514');
  const crew=await scalar("INSERT INTO project_needs(project_id,title,target_type,resolution_route) VALUES($1,'DP','person','professional_proposal') RETURNING id",[project]);
  await assert.rejects(q('SELECT sourcing_create($1,$2,$3)',[project,crew,{...rule,competition_mode:'reverse_auction'}]),e=>e.code==='23514');
  await as(d);await denied('SELECT sourcing_create($1,NULL,$2)',[project,rule]);await denied("INSERT INTO project_needs(project_id,title,target_type,resolution_route) VALUES($1,'Foreign crew','person','professional_proposal')",[project]);
  await as(a);event=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,rule]);[pb,pc]=await inviteAndOpen(event);
 });
 await t.test('sealed bids isolate competing identities, line items, prices and budget; buyer cannot peek before close',async()=>{
  await as(b);bid=await scalar(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,request,items(10000)]);
  assert.equal(await scalar(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,request,items(10000)]),bid);
  await assert.rejects(q(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,request,items(9000)]),e=>e.code==='23514');
  assert.deepEqual(await scalar('SELECT sourcing_feedback($1,NULL)',[pb]),{});
  await denied('SELECT target_budget_minor FROM sourcing_events');
  await as(c);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_bids'),0);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_bid_items'),0);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_participants'),1);
  await denied(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,crypto.randomUUID(),items(9000)]);
  await as(a);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_bids'),0);await denied("UPDATE sourcing_events SET buyer_sealed_until_close=false WHERE id=$1",[event]);
  await as(d);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_events'),0);await denied('SELECT sourcing_feedback($1,NULL)',[pb]);
  await as(null,'anon');await denied('SELECT id FROM sourcing_events');await denied('SELECT sourcing_open($1)',[event]);
 });
 await t.test('material change increments version, records shared notice and blocks reopen until every qualified party acknowledges',async()=>{
  await as(a);await q("SELECT sourcing_revise($1,'Revised rental specification','2099-02-01',120000,'Material specification changed')",[event]);
  assert.equal(await scalar('SELECT event_version FROM sourcing_events WHERE id=$1',[event]),2);
  await as(b);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_rule_notices'),1);
  await assert.rejects(q(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,crypto.randomUUID(),items(8000)]),e=>e.code==='23514');
  await q("SELECT sourcing_participant_decide($1,'accept')",[pb]);await as(a);await assert.rejects(q('SELECT sourcing_open($1)',[event]),e=>e.code==='23514');
  await as(c);await q("SELECT sourcing_participant_decide($1,'accept')",[pc]);await as(a);await q('SELECT sourcing_open($1)',[event]);
  await as(b);await denied('UPDATE sourcing_bids SET amount_minor=1 WHERE id=$1',[bid]);
  bid=await scalar(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,crypto.randomUUID(),items(8000)]);
  await as(a);await assert.rejects(q("SELECT sourcing_award($1,'manual_best_value','Quality and delivery reviewed')",[bid]),e=>e.code==='23514');
  await db.exec('RESET ROLE');await q("UPDATE sourcing_events SET ends_at=now()-interval '1 second' WHERE id=$1",[event]);
  await as(a);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_bids'),2);
  await q("SELECT sourcing_award($1,'manual_best_value','Quality and delivery reviewed')",[bid]);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_awards'),1);
  await db.exec('RESET ROLE');await denied("UPDATE sourcing_bids SET amount_minor=1");await denied("DELETE FROM sourcing_bid_items");await denied("DELETE FROM sourcing_awards");
 });
 await t.test('reverse bids enforce decrement, server time, idempotent extension; removal revokes bidder access',async()=>{
  await as(a);const auction=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,{...rule,competition_mode:'reverse_auction',rank_visibility:true,price_visibility:true,extension_window_seconds:600,extension_duration_seconds:120,maximum_extension_seconds:240}]);const [p1,p2]=await inviteAndOpen(auction);
  await db.exec('RESET ROLE');await q("UPDATE sourcing_events SET ends_at=now()+interval '1 minute' WHERE id=$1",[auction]);
  await as(b);const req=crypto.randomUUID();await q(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[auction,p1,req,items(10000)]);await q(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[auction,p1,req,items(10000)]);
  assert.equal(await scalar('SELECT extended_seconds FROM sourcing_events WHERE id=$1',[auction]),120);
  await as(c);await assert.rejects(q(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[auction,p2,crypto.randomUUID(),items(10000)]),e=>e.code==='23514');
  await q(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[auction,p2,crypto.randomUUID(),items(9900)]);
  assert.equal(await scalar('SELECT extended_seconds FROM sourcing_events WHERE id=$1',[auction]),240);
  assert.equal((await scalar('SELECT sourcing_feedback($1,NULL)',[p2])).rank,1);
  await as(a);await q("SELECT sourcing_participant_decide($1,'remove')",[p2]);
  await as(c);await denied('SELECT sourcing_feedback($1,NULL)',[p2]);await denied(`SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,'${JSON.stringify(commercialTerms)}'::jsonb)`,[auction,p2,crypto.randomUUID(),items(9800)]);
 });
 await t.test('split-lot awards preserve scoped bid history, forbid cross-event lot injection',async()=>{
  await as(a);const e=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,{...rule,bid_scope:'lots'}]);const lot=await scalar("INSERT INTO sourcing_lots(event_id,title) VALUES($1,'Camera') RETURNING id",[e]);const lot2=await scalar("INSERT INTO sourcing_lots(event_id,title) VALUES($1,'Lighting') RETURNING id",[e]);const [p1]=await inviteAndOpen(e);
  assert.equal((await q("UPDATE sourcing_lots SET title='Late material edit' WHERE id=$1 RETURNING id",[lot])).length,0);
  await as(b);await assert.rejects(q(`SELECT sourcing_bid_submit($1,$2,$3,$4,$5,'${JSON.stringify(commercialTerms)}'::jsonb)`,[event,pb,lot,crypto.randomUUID(),items(500)]),e=>e.code==='23514');
  const b1=await scalar(`SELECT sourcing_bid_submit($1,$2,$3,$4,$5,'${JSON.stringify(commercialTerms)}'::jsonb)`,[e,p1,lot,crypto.randomUUID(),items(500)]);
  const b2=await scalar(`SELECT sourcing_bid_submit($1,$2,$3,$4,$5,'${JSON.stringify(commercialTerms)}'::jsonb)`,[e,p1,lot2,crypto.randomUUID(),items(700)]);
  await db.exec('RESET ROLE');await q("UPDATE sourcing_events SET ends_at=now()-interval '1 second' WHERE id=$1",[e]);
  await as(a);await q("SELECT sourcing_award($1,'manual_best_value','Camera compliance and delivery')",[b1]);await q("SELECT sourcing_award($1,'manual_best_value','Light compliance and delivery')",[b2]);
  assert.equal(await scalar('SELECT count(*)::int FROM sourcing_awards WHERE event_id=$1',[e]),2);
 });
 await t.test('commercial costs, explicit alternatives, immutable withdrawal and no fake discount',async()=>{
  await as(a);const e=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,rule]);const [p1,p2]=await inviteAndOpen(e);
  const submit=(party,price,terms)=>scalar('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,party,crypto.randomUUID(),items(price),terms]);
  await as(b);const costly=await submit(p1,500,{...commercialTerms,delivery_cost_minor:700,pickup_cost_minor:100,tax_inclusion:'excluded',tax_amount_minor:200,prep_service_cost_minor:50,other_mandatory_fees_minor:25});
  assert.deepEqual((await q('SELECT item_subtotal_minor,mandatory_additional_costs_minor,comparable_total_minor FROM sourcing_bids WHERE id=$1',[costly])).map(r=>Object.values(r).map(Number)),[[500,1075,1575]]);
  await denied('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,p1,crypto.randomUUID(),items(1),{...commercialTerms,discount_reference:crypto.randomUUID()}]);
  await denied("INSERT INTO commercial_offers(provider_organization_id) VALUES($1)",[crypto.randomUUID()]);
  const alternative=await submit(p1,400,{...commercialTerms,compliance:'alternative',alternative_specification:{requested:'Alexa Mini LF',offered:'Alexa 35',deviation:'Different sensor and workflow; no equivalence claim'}});
  assert.equal(await scalar('SELECT compliance FROM sourcing_bids WHERE id=$1',[alternative]),'alternative');
  assert.equal((await scalar('SELECT sourcing_bid_lifecycle($1)',[costly])).status,'superseded');
  await as(c);const standard=await submit(p2,1000,commercialTerms);
  await q("SELECT sourcing_bid_withdraw($1,'Provider availability changed')",[standard]);
  assert.equal((await scalar('SELECT sourcing_bid_lifecycle($1)',[standard])).status,'withdrawn');
  assert.equal(await scalar('SELECT count(*)::int FROM sourcing_bids WHERE id=$1',[standard]),1);
  await denied('DELETE FROM sourcing_bid_withdrawals WHERE bid_id=$1',[standard]);
  await db.exec('RESET ROLE');await q("UPDATE sourcing_events SET ends_at=now()-interval '1 second' WHERE id=$1",[e]);
  await as(a);await assert.rejects(q("SELECT sourcing_award($1,'manual_best_value','Qualified offer reviewed')",[standard]),e=>e.code==='23514');
  await assert.rejects(q("SELECT sourcing_award($1,'lowest_compliant_bid','Compare total package costs')",[alternative]),e=>e.code==='23514');
  await q("SELECT sourcing_award($1,'manual_best_value','Explicit alternative manually accepted')",[alternative]);
 });
 await t.test('provider prepare and submit are independent; unrelated employee cannot read or submit',async()=>{
  await as(b);const org=await scalar("SELECT organization_create('Rental provider','bid-permission-provider','rental_house')");
  await db.exec('RESET ROLE');await q("INSERT INTO organization_members(organization_id,user_id,role,active) VALUES($1,$2,'member',true),($1,$3,'member',true)",[org,c,d]);
  await q("INSERT INTO organization_sourcing_authorities(organization_id,user_id,permission,granted_by) VALUES($1,$2,'prepare_bid',$3)",[org,c,b]);
  await as(a);const e=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,rule]);const party=await scalar('SELECT sourcing_invite($1,NULL,$2)',[e,org]);
  await as(b);await q("SELECT sourcing_participant_decide($1,'accept')",[party]);await as(a);await q("SELECT sourcing_participant_decide($1,'qualify')",[party]);await q('SELECT sourcing_open($1)',[e]);
  await as(c);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_events WHERE id=$1',[e]),1);
  await denied('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,party,crypto.randomUUID(),items(500),commercialTerms]);
  await as(d);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_events WHERE id=$1',[e]),0);
  await denied('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,party,crypto.randomUUID(),items(500),commercialTerms]);
  await db.exec('RESET ROLE');await q("INSERT INTO organization_sourcing_authorities(organization_id,user_id,permission,granted_by) VALUES($1,$2,'submit_bid',$3)",[org,c,b]);
  await as(c);await q('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,party,crypto.randomUUID(),items(500),commercialTerms]);
 });
 await t.test('a possible offer never becomes a confirmed discount through browser claims',async()=>{
  await as(b);const org=await scalar("SELECT organization_create('Discount provider','discount-provider','rental_house')");
  await as(a);const e=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,rule]);const party=await scalar('SELECT sourcing_invite($1,NULL,$2)',[e,org]);
  await as(b);await q("SELECT sourcing_participant_decide($1,'accept')",[party]);await as(a);await q("SELECT sourcing_participant_decide($1,'qualify')",[party]);await q('SELECT sourcing_open($1)',[e]);
  await db.exec('RESET ROLE');const offer=await scalar("INSERT INTO commercial_offers(provider_organization_id,offer_type,scope_category,eligibility,claim_status,discount_basis_points,valid_from,valid_until,geography,terms,status,source,source_reference,observed_at) VALUES($1,'student_discount','equipment','Reviewed student project required','possible',1000,now()-interval '1 day',now()+interval '1 month','RU','Provider terms apply','published','provider_quote','quote:fixture',now()) RETURNING id",[org]);
  await q("INSERT INTO filmverse_private.commercial_offer_eligibility(offer_id,participant_id,evidence_reference,valid_until) VALUES($1,$2,'reviewed-fixture',now()+interval '1 week')",[offer,party]);
  await as(b);await denied("UPDATE commercial_offers SET claim_status='confirmed' WHERE id=$1",[offer]);
  await denied('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,party,crypto.randomUUID(),items(500),{...commercialTerms,discount_reference:offer}]);
  await db.exec('RESET ROLE');await q("UPDATE commercial_offers SET claim_status='confirmed' WHERE id=$1",[offer]);
  await as(b);await q('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,party,crypto.randomUUID(),items(500),{...commercialTerms,discount_reference:offer}]);
  await denied("UPDATE commercial_offers SET claim_status='sponsored_promotion' WHERE id=$1",[offer]);
 });
 await t.test('commercial offer semantics reject invalid trusted-service combinations, not only browser writes',async()=>{
  await as(b);const org=await scalar("SELECT organization_create('Offer invariant provider','offer-invariant-provider','rental_house')");
  await as(null,'service_role');
  const insert=(kind,claim,bps=null,amount=null)=>q("INSERT INTO commercial_offers(provider_organization_id,offer_type,scope_category,eligibility,claim_status,discount_basis_points,discount_amount_minor,currency,valid_from,valid_until,geography,terms,status,source,source_reference,observed_at) VALUES($1,$2,'equipment','Public eligibility',$3,$4,$5,'RUB',now()-interval '2 days',now()+interval '1 week','RU','Public terms','published','provider_quote','internal:quote:secret',now()) RETURNING id",[org,kind,claim,bps,amount]);
  for(const combination of [
   ['student_discount','sponsored_promotion'],['package_discount','sponsored_promotion'],
   ['promotion','possible'],['promotion','confirmed'],['promotion','sponsored_promotion',null,100],['promotion','sponsored_promotion',1000],
  ])await assert.rejects(insert(...combination),e=>e.code==='23514'&&e.constraint==='commercial_offer_claim_semantics');
  for(const combination of [
   ['promotion','sponsored_promotion'],['student_discount','possible',1000],
   ['student_discount','confirmed',1000],['package_discount','confirmed',null,100],
  ])assert.equal((await insert(...combination)).length,1);
 });
 await t.test('commercial discovery projects safe columns; provenance is management-only and eligibility remains private',async()=>{
  await as(b);const org=await scalar("SELECT organization_create('Safe offer provider','safe-offer-provider','rental_house')");
  await as(null,'service_role');
  const create=()=>scalar("INSERT INTO commercial_offers(provider_organization_id,offer_type,scope_category,eligibility,claim_status,discount_basis_points,valid_from,valid_until,geography,terms,status,source,source_reference,observed_at) VALUES($1,'student_discount','equipment','Public student criteria','confirmed',1000,now()-interval '2 days',now()+interval '1 week','RU','Public terms','published','provider_quote','internal:private-document:42',now()) RETURNING id",[org]);
  const published=await create();const hidden=[];
  for(const status of ['draft','withdrawn','expired']){const id=await create();await q('UPDATE commercial_offers SET status=$1 WHERE id=$2',[status,id]);hidden.push(id);}
  const expired=await create();await q("UPDATE commercial_offers SET valid_until=now()-interval '1 hour' WHERE id=$1",[expired]);hidden.push(expired);
  const future=await create();await q("UPDATE commercial_offers SET valid_from=now()+interval '1 day' WHERE id=$1",[future]);hidden.push(future);
  assert.equal(await scalar('SELECT source_reference FROM commercial_offers WHERE id=$1',[published]),'internal:private-document:42');
  await as(d);const rows=await q('SELECT * FROM commercial_offer_discover() WHERE provider_organization_id=$1',[org]);
  assert.equal(rows.length,1);assert.equal(rows[0].id,published);
  assert.deepEqual(Object.keys(rows[0]).sort(),['id','provider_organization_id','offer_type','scope_category','eligibility','claim_status','discount_basis_points','discount_amount_minor','currency','valid_from','valid_until','geography','terms','status','source'].sort());
  assert.equal(JSON.stringify(rows).includes('internal:'),false);
  for(const id of hidden)assert.equal(await scalar('SELECT count(*)::int FROM commercial_offers WHERE id=$1',[id]),0);
  await denied('SELECT * FROM commercial_offers');await denied('SELECT source_reference FROM commercial_offers');
  await denied("SELECT id FROM commercial_offers WHERE source_reference LIKE 'internal:%'");
  await denied('SELECT * FROM filmverse_private.commercial_offer_eligibility');
  await denied('SELECT commercial_offer_provenance($1)',[published]);
  await as(b);assert.equal((await scalar('SELECT commercial_offer_provenance($1)',[published])).source_reference,'internal:private-document:42');
  assert.equal(await scalar('SELECT count(*)::int FROM commercial_offers WHERE provider_organization_id=$1',[org]),6);
  assert.equal(await scalar('SELECT count(*)::int FROM commercial_offer_discover() WHERE provider_organization_id=$1',[org]),1);
  await denied('SELECT source_reference FROM commercial_offers');await denied('SELECT * FROM filmverse_private.commercial_offer_eligibility');
  await q("UPDATE organizations SET visibility='members_only' WHERE id=$1",[org]);
  await as(d);assert.equal(await scalar('SELECT count(*)::int FROM commercial_offer_discover() WHERE provider_organization_id=$1',[org]),0);
  await as(null,'anon');await denied('SELECT * FROM commercial_offer_discover()');await denied('SELECT source_reference FROM commercial_offers');
 });
 await t.test('raw commercial provenance requires current organization management, never view_sourcing alone',async()=>{
  await as(b);const org=await scalar("SELECT organization_create('Managed offers','managed-offers','rental_house')");
  const other=await scalar("SELECT organization_create('Other managed offers','other-managed-offers','rental_house')");
  await db.exec('RESET ROLE');
  await q("INSERT INTO organization_members(organization_id,user_id,role,active) VALUES($1,$2,'admin',true),($1,$3,'member',true),($1,$4,'member',true)",[org,a,c,d]);
  await q("INSERT INTO organization_sourcing_authorities(organization_id,user_id,permission,granted_by) VALUES($1,$2,'view_sourcing',$3)",[org,c,b]);
  await as(null,'service_role');
  const create=provider=>scalar("INSERT INTO commercial_offers(provider_organization_id,offer_type,scope_category,eligibility,claim_status,valid_from,valid_until,geography,terms,status,source,source_reference,observed_at) VALUES($1,'student_discount','equipment','Public eligibility','possible',now()-interval '1 day',now()+interval '1 week','RU','Public terms','published','provider_quote','private:manager-only',now()) RETURNING id",[provider]);
  const own=await create(org),foreign=await create(other);
  assert.equal(await scalar('SELECT source_reference FROM commercial_offers WHERE id=$1',[own]),'private:manager-only');
  for(const user of [c,d]){
   await as(user);assert.equal(await scalar('SELECT count(*)::int FROM commercial_offer_discover() WHERE id=$1',[own]),1);
   await denied('SELECT source_reference FROM commercial_offers WHERE id=$1',[own]);
   await denied('SELECT commercial_offer_provenance($1)',[own]);await denied('SELECT * FROM filmverse_private.commercial_offer_eligibility');
  }
  await as(a);assert.equal((await scalar('SELECT commercial_offer_provenance($1)',[own])).source_reference,'private:manager-only');
  await denied('SELECT commercial_offer_provenance($1)',[foreign]);await denied('SELECT * FROM filmverse_private.commercial_offer_eligibility');
  await db.exec('RESET ROLE');await q('UPDATE organization_members SET active=false WHERE organization_id=$1 AND user_id=$2',[org,a]);
  await as(a);await denied('SELECT commercial_offer_provenance($1)',[own]);
 });
 await t.test('lowest-compliant award compares complete costs, not body-only equipment prices',async()=>{
  await as(a);const e=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,rule]);const [p1,p2]=await inviteAndOpen(e);
  await as(b);const bodyOnlyCheaper=await scalar('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,p1,crypto.randomUUID(),items(500),{...commercialTerms,delivery_cost_minor:1000}]);
  await as(c);const packageCheaper=await scalar('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,p2,crypto.randomUUID(),items(1000),commercialTerms]);
  await db.exec('RESET ROLE');await q("UPDATE sourcing_events SET ends_at=now()-interval '1 second' WHERE id=$1",[e]);
  await as(a);await assert.rejects(q("SELECT sourcing_award($1,'lowest_compliant_bid','Compare complete usable packages')",[bodyOnlyCheaper]),e=>e.code==='23514');
  await q("SELECT sourcing_award($1,'lowest_compliant_bid','Compare complete usable packages')",[packageCheaper]);
 });
 await t.test('participant Q&A is private until publication; common changes require equal disclosure and reacknowledgement',async()=>{
  await as(a);const e=await scalar('SELECT sourcing_create($1,NULL,$2)',[project,rule]);const [p1,p2]=await inviteAndOpen(e);
  await as(b);const question=await scalar("SELECT sourcing_question_ask($1,$2,'Does the package include lenses?')",[e,p1]);
  await as(c);assert.equal(await scalar('SELECT count(*)::int FROM sourcing_questions WHERE id=$1',[question]),0);
  await as(a);await assert.rejects(q("SELECT sourcing_question_answer($1,'Add two lenses to common scope',false,true)",[question]),e=>e.code==='23514');
  await q("SELECT sourcing_question_answer($1,'Add two lenses to common scope',true,true)",[question]);
  await as(c);assert.equal(await scalar('SELECT state FROM sourcing_questions WHERE id=$1',[question]),'published_to_all');
  await denied('SELECT asked_by FROM sourcing_questions');await denied('SELECT participant_id FROM sourcing_questions');
  assert.equal(await scalar('SELECT status FROM sourcing_events WHERE id=$1',[e]),'qualification');
  await assert.rejects(q('SELECT sourcing_bid_submit($1,$2,NULL,$3,$4,$5)',[e,p2,crypto.randomUUID(),items(500),commercialTerms]),e=>e.code==='23514');
 });
 let wallet,operation;
 await t.test('wallet ownership, server-owned catalog, disabled deployment default, free allowance and debit/refund idempotency',async()=>{
  await as(a);wallet=await scalar('SELECT ai_wallet_open(NULL)');
  await assert.rejects(q('SELECT ai_claim_free($1)',[wallet]),e=>e.code==='23514');
  await denied("UPDATE ai_operation_catalog SET credit_cost=0");await denied("SELECT filmverse_private.ai_grant($1,'grant',999,'server:forged')",[wallet]);
  await db.exec('RESET ROLE');await q('UPDATE ai_allowance_policy SET enabled=true');await q("UPDATE ai_operation_catalog SET enabled=true WHERE operation_code='filters.parse'");
  await as(a);await q('SELECT ai_claim_free($1)',[wallet]);await q('SELECT ai_claim_free($1)',[wallet]);assert.equal(Number(await scalar('SELECT sum(credits) FROM ai_credit_ledger WHERE wallet_id=$1',[wallet])),8);
  const req=crypto.randomUUID();operation=await scalar("SELECT ai_consume($1,$2,'filters.parse',$3)",[wallet,project,req]);assert.equal(await scalar("SELECT ai_consume($1,$2,'filters.parse',$3)",[wallet,project,req]),operation);
  assert.equal(Number(await scalar('SELECT sum(credits) FROM ai_credit_ledger WHERE wallet_id=$1',[wallet])),7);
  await denied('SELECT estimated_infrastructure_cost FROM ai_usage_operations');
  await as(b);await denied("SELECT ai_consume($1,$2,'filters.parse',$3)",[wallet,project,crypto.randomUUID()]);assert.equal(await scalar('SELECT count(*)::int FROM ai_credit_ledger'),0);await denied('SELECT ai_claim_free($1)',[wallet]);
  await db.exec('RESET ROLE');await q('SELECT filmverse_private.ai_refund($1)',[operation]);await q('SELECT filmverse_private.ai_refund($1)',[operation]);assert.equal(Number(await scalar('SELECT sum(credits) FROM ai_credit_ledger WHERE wallet_id=$1',[wallet])),8);await denied('DELETE FROM ai_credit_ledger');
 });
 await t.test('organization wallet requires current role and same-company project; removal takes effect immediately',async()=>{
  await as(a);const org=await scalar("SELECT organization_create('AI Studio','ai-studio','studio')");const other=await scalar("SELECT organization_create('Other AI Studio','other-ai-studio','studio')");
  const op=await scalar("INSERT INTO projects(title,organization_id) VALUES('Company film',$1) RETURNING id",[org]);const wp=await scalar('SELECT ai_wallet_open($1)',[org]);
  await db.exec('RESET ROLE');await q("INSERT INTO organization_members(organization_id,user_id,role,active) VALUES($1,$2,'producer',true)",[org,b]);await q("SELECT filmverse_private.ai_grant($1,'grant',5,'server:company-allowance')",[wp]);
  await as(b);await q("SELECT ai_consume($1,$2,'filters.parse',$3)",[wp,op,crypto.randomUUID()]);await denied('SELECT ai_wallet_open($1)',[other]);await denied("SELECT ai_consume($1,$2,'filters.parse',$3)",[wp,project,crypto.randomUUID()]);
  await db.exec('RESET ROLE');await q('UPDATE organization_members SET active=false WHERE organization_id=$1 AND user_id=$2',[org,b]);
  await as(b);await denied("SELECT ai_consume($1,$2,'filters.parse',$3)",[wp,op,crypto.randomUUID()]);assert.equal(await scalar('SELECT count(*)::int FROM ai_wallets WHERE id=$1',[wp]),0);
 });
 await t.test('AI approval is project/user/argument-bound, cannot mutate arbitrary tools or create private memory from browser',async()=>{
  await db.exec('RESET ROLE');const proposal=await scalar("INSERT INTO agent_action_proposals(project_id,initiating_user,tool_code,arguments,arguments_hash,risk,expires_at) VALUES($1,$2,'project.create_need','{}',encode(sha256(convert_to('{}','UTF8')),'hex'),'high',now()+interval '1 hour') RETURNING id",[project,a]);
  const hash=await scalar('SELECT arguments_hash FROM agent_action_proposals WHERE id=$1',[proposal]);
  await as(b);await denied('SELECT agent_approve($1,$2,true)',[proposal,hash]);assert.equal(await scalar('SELECT count(*)::int FROM agent_project_memory'),0);
  await as(a);await denied("INSERT INTO agent_project_memory(project_id,summary) VALUES($1,'Injected cross-project memory')",[project]);await assert.rejects(q('SELECT agent_approve($1,$2,true)',[proposal,'changed']),e=>e.code==='23514');
  await q('SELECT agent_approve($1,$2,true)',[proposal,hash]);assert.equal(await scalar('SELECT status FROM agent_action_proposals WHERE id=$1',[proposal]),'approved');
  await denied("UPDATE agent_action_proposals SET arguments='{\"sql\":\"select everything\"}' WHERE id=$1",[proposal]);
 });
 }finally{await db.close();}
});
