import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('production network: full replay, casting, guardians, graph, education and referral security',async t=>{
 const db=new PGlite();const q=async(s,a=[]) => { if(process.env.FILMVERSE_SQL_TRACE)console.error(s.slice(0,140));return (await db.query(s,a)).rows; };
 const scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('SET ROLE '+role);};
 const denied=(s,a=[])=>assert.rejects(q(s,a),e=>e.code==='42501');
 const [a,b,c,d]=[1,2,3,4].map(n=>'40000000-0000-4000-8000-00000000000'+n);
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

 let minor,subject,guardian,org,project,role,candidate;
 const grant=async(id,names)=>{await db.exec('RESET ROLE');await q('INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name=ANY($2) ON CONFLICT DO NOTHING',[id,names]);};
 await t.test('Young Talent is not an account; pending guardian cannot publish; neither guest nor PRO buys access',async()=>{
  await as(a);minor=await scalar("SELECT minor_create('Young performer','parent')");subject=await scalar('SELECT id FROM casting_subjects WHERE minor_talent_id=$1',[minor]);guardian=await scalar('SELECT id FROM minor_guardians WHERE minor_talent_id=$1',[minor]);
  assert.equal(await scalar('SELECT count(*)::int FROM profiles'),4);
  assert.equal((await q('UPDATE minor_talent_profiles SET discoverable=true WHERE id=$1 RETURNING id',[minor])).length,0);
  await denied('SELECT created_by FROM minor_talent_profiles');
  await denied("UPDATE minor_guardians SET status='approved' WHERE id=$1",[guardian]);
  await denied('SELECT * FROM filmverse_private.minor_talent_private');
  await as(b);await denied('SELECT young_talent_search()');
  await as(null,'anon');await denied('SELECT id FROM minor_talent_profiles');await denied('SELECT young_talent_search()');
  await grant(a,['review_guardianship']);await as(a);await denied("SELECT guardianship_review($1,true,'Examined original authority',now()+interval '1 month')",[guardian]);
  await grant(d,['review_guardianship','search_minor_talent','publish_minor_opportunity','review_minor_opportunity']);await as(d);
  await q("SELECT guardianship_review($1,true,'Examined original authority',now()+interval '1 month')",[guardian]);
  await as(a);await q('UPDATE minor_talent_profiles SET discoverable=true WHERE id=$1',[minor]);
  await as(d);assert.equal((await scalar('SELECT young_talent_search()'))[0].id,minor);
  assert.equal('created_by' in (await scalar('SELECT young_talent_search()'))[0],false);
  await denied("INSERT INTO storage.objects(id,name,bucket_id) VALUES($1,'unsafe-exif.jpg','minor-media')",[crypto.randomUUID()]);
 });
 await t.test('canonical application keeps child subject separate; consent cannot be borrowed; opportunity requires independent review',async()=>{
  await grant(b,['publish_minor_opportunity','search_minor_talent']);
  await as(b);project=await scalar("INSERT INTO projects(title) VALUES('Network film') RETURNING id");
  const work=await scalar("INSERT INTO work_opportunities(title,type,audience,project_id,minor_opportunity,minor_responsible_adult) VALUES('Young role','casting','actors',$1,true,$2) RETURNING id",[project,b]);
  await as(a);await denied('INSERT INTO work_applications(work_id,casting_subject_id) VALUES($1,$2)',[work,subject]);
  await as(d);await q('SELECT minor_opportunity_review($1)',[work]);
  await as(a);await q("INSERT INTO minor_project_consents(casting_subject_id,project_id,scope,terms_version,expires_at) VALUES($1,$2,'application','v1',now()+interval '1 week')",[subject,project]);
  const application=await scalar('INSERT INTO work_applications(work_id,casting_subject_id) VALUES($1,$2) RETURNING id',[work,subject]);
  assert.equal(await scalar('SELECT submitted_by FROM work_applications WHERE id=$1',[application]),a);
  await as(c);await denied('INSERT INTO work_applications(work_id,casting_subject_id) VALUES($1,$2)',[work,subject]);
  await as(b);role=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Lead') RETURNING id",[project]);
  candidate=await scalar("INSERT INTO role_candidates(role_id,casting_subject_id,application_id,source) VALUES($1,$2,$3,'application') RETURNING id",[role,subject,application]);
  await denied("SELECT casting_share_create($1,$2,now()+interval '1 day')",[project,[candidate]]);
  await as(a);await q('UPDATE minor_project_consents SET revoked_at=now() WHERE casting_subject_id=$1',[subject]);
  await as(b);const role2=await scalar("INSERT INTO casting_roles(project_id,title) VALUES($1,'Second role') RETURNING id",[project]);
  await denied("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'search')",[role2,subject]);
 });
 await t.test('casting scopes notes, roles, ensembles and selected-only expiring share without contacts',async()=>{
  await as(b);const adult=await scalar('SELECT id FROM casting_subjects WHERE adult_user_id=$1',[c]);
  const adultCandidate=await scalar("INSERT INTO role_candidates(role_id,casting_subject_id,source) VALUES($1,$2,'search') RETURNING id",[role,adult]);
  await q("INSERT INTO casting_reviewer_notes(candidate_id,body) VALUES($1,'Private reasoning')",[adultCandidate]);
  await q("INSERT INTO casting_comments(candidate_id,body) VALUES($1,'Shared casting context')",[adultCandidate]);
  const shared=await scalar("SELECT casting_share_create($1,$2,now()+interval '1 day')",[project,[adultCandidate]]);
  await as(null,'anon');const rows=await scalar('SELECT casting_share_read($1)',[shared.token]);assert.equal(rows.length,1);assert.equal(rows[0].candidate_id,adultCandidate);assert.deepEqual(Object.keys(rows[0]).sort(),['candidate_id','name','role']);
  await denied('SELECT * FROM casting_comments');await denied('SELECT * FROM filmverse_private.casting_share_keys');
  await as(c);assert.equal(await scalar('SELECT count(*)::int FROM casting_reviewer_notes'),0);assert.equal(await scalar('SELECT count(*)::int FROM casting_roles'),0);
  await denied("INSERT INTO casting_roles(project_id,title) VALUES($1,'Unrelated')",[project]);
  await as(b);await q('SELECT casting_share_revoke($1)',[shared.id]);
  await as(null,'anon');assert.equal((await scalar('SELECT casting_share_read($1)',[shared.token])).length,0);
 });
 let relation;
 await t.test('graph is bilateral, nonexclusive, private until individual opts in; ended relation disappears',async()=>{
  await as(b);org=await scalar("SELECT organization_create('Cinema school','network-school','education')");
  relation=await scalar("SELECT relationship_request($1,$2,'instructor','Directing mentor')",[org,c]);
  await q("SELECT relationship_respond($1,'confirm',true,true)",[relation]);
  assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,0);
  await as(c);await q("SELECT relationship_respond($1,'confirm',true,true)",[relation]);
  await denied("UPDATE organization_professional_relationships SET status='active'");
  await as(null,'anon');const graph=await scalar('SELECT professional_graph($1,NULL)',[org]);assert.equal(graph.length,1);assert.equal(graph[0].full_name,'Person '+c);assert.equal('email' in graph[0],false);
 });
 await t.test('education/events public discovery excludes drafts; unrelated editor denied; organization type enforced',async()=>{
  await as(b);const program=await scalar("INSERT INTO education_programs(organization_id,title,program_type,format,price_type) VALUES($1,'Directing course','course','online','free') RETURNING id",[org]);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM education_programs'),0);
  await as(c);await denied("INSERT INTO education_programs(organization_id,title,program_type,format,price_type) VALUES($1,'Spoof course','course','online','free')",[org]);
  await as(b);await q("UPDATE education_programs SET status='published' WHERE id=$1",[program]);
  await q("INSERT INTO education_program_instructors(program_id,user_id,role_title) VALUES($1,$2,'Mentor')",[program,c]);
  const event=await scalar("INSERT INTO industry_events(organizer_type,organization_id,title,event_type,format,price_type,starts_at,ends_at) VALUES('organization',$1,'School open day','open_day','online','free',now()+interval '1 day',now()+interval '2 days') RETURNING id",[org]);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM education_programs'),1);assert.equal(await scalar('SELECT count(*)::int FROM industry_events'),0);
  await as(b);await q("UPDATE industry_events SET status='published' WHERE id=$1",[event]);await denied("UPDATE industry_events SET moderation_status='hidden' WHERE id=$1",[event]);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM industry_events'),1);
  await as(c);await q("SELECT relationship_respond($1,'end')",[relation]);
  assert.equal((await scalar('SELECT professional_graph($1,NULL)',[org])).length,0);
  await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM education_program_instructors'),0);
 });
 await t.test('referral qualification is server-only, no self referral/minor bounty, ledger replay and cancellation safe',async()=>{
  await db.exec('RESET ROLE');
  const partner=await scalar("INSERT INTO growth_partners(partner_subject_type,user_id,partner_type,status) VALUES('user',$1,'individual','active') RETURNING id",[a]);
  const rule=await scalar("INSERT INTO referral_reward_rules(reward_type,partner_value,new_user_value,qualifying_event,enabled) VALUES('ai_credits',10,5,'first_application',true) RETURNING id");
  const campaign=await scalar("INSERT INTO referral_campaigns(partner_id,name,campaign_type,destination_path,reward_rule_id,ends_at,status) VALUES($1,'Test cohort','cohort','/students',$2,now()+interval '1 week','active') RETURNING id",[partner,rule]);
  const code=await scalar('INSERT INTO referral_codes(campaign_id) VALUES($1) RETURNING code',[campaign]);
  await as(a);await denied('SELECT referral_attribute($1)',[code]);
  await as(c);await q('SELECT referral_attribute($1)',[code]);await q('SELECT referral_attribute($1)',[code]);
  await denied('SELECT * FROM referral_reward_ledger');await denied("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[crypto.randomUUID()]);
  await db.exec('RESET ROLE');const attr=await scalar('SELECT id FROM referral_attributions WHERE new_user_id=$1',[c]);
  await assert.rejects(q("SELECT filmverse_private.referral_qualify($1,'minor_created','child-bounty')",[attr]),e=>e.code==='23514');
  const event=await scalar("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[attr]);
  assert.equal(await scalar("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[attr]),event);
  assert.equal(await scalar('SELECT count(*)::int FROM referral_reward_ledger'),2);
  await denied("UPDATE referral_reward_ledger SET value=999");await q('SELECT filmverse_private.referral_reverse($1)',[event]);await q('SELECT filmverse_private.referral_reverse($1)',[event]);assert.equal(Number(await scalar('SELECT sum(value) FROM referral_reward_ledger')),0);
  await assert.rejects(q("SELECT filmverse_private.referral_qualify($1,'first_application','verified-application')",[attr]),e=>e.code==='23514');
  await as(a);const dash=await scalar('SELECT referral_dashboard($1)',[partner]);assert.equal(dash.signups,1);assert.equal(await scalar('SELECT student_badge($1)',[c]),false);assert.equal('new_user_id' in dash,false);
  await as(d);await denied('SELECT referral_dashboard($1)',[partner]);
 });
 await t.test('every new relation has RLS and all definers fix search_path',async()=>{
  await db.exec('RESET ROLE');assert.equal(await scalar("SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity"),0);
  assert.equal(await scalar("SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='filmverse_private' AND p.prosecdef AND NOT coalesce(p.proconfig@>ARRAY['search_path=\"\"'],false)"),0);
 });
 }finally{await db.close();}
});
