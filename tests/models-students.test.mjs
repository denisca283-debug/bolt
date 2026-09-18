import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('models and student ecosystem: chronological PostgreSQL replay and adversarial scenarios',async t=>{
 const db=new PGlite();const q=async(s,a=[]) => { if(process.env.FILMVERSE_SQL_TRACE)console.error(s.slice(0,140));return (await db.query(s,a)).rows; };
 const scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('SET ROLE '+role);};
 const denied=(s,a=[])=>assert.rejects(q(s,a),e=>e.code==='42501');
 const [a,b,c,d]=[1,2,3,4].map(n=>'30000000-0000-4000-8000-00000000000'+n);
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
 await t.test('model-only and actor+model share one identity; atomically save measurements, not private identity copies',async()=>{
  await as(a);await q("SELECT model_save($1,$2)",[{categories:['commercial','editorial'],bio:'Model',tfp_collaboration:true},{height_cm:178,waist_cm:65,visibility:'private'}]);
  assert.equal(await scalar('SELECT count(*)::int FROM actors WHERE user_id=$1',[a]),0);
  await q("INSERT INTO actors(user_id,full_name) VALUES($1,'Same person')",[a]);
  assert.equal(await scalar('SELECT count(*)::int FROM profiles WHERE id=$1',[a]),1);
  await q("SELECT model_save($1,$2)",[{categories:['commercial']},{height_cm:180,visibility:'private'}]);
  assert.equal(await scalar('SELECT height_cm::int FROM model_measurements WHERE user_id=$1',[a]),180);
  await assert.rejects(q('SELECT model_save($1,$2)',[{bio:'Must roll back'},{height_cm:-1}]),e=>e.code==='23514');
  assert.notEqual(await scalar('SELECT bio FROM model_profiles WHERE user_id=$1',[a]),'Must roll back');
  await as(b);assert.equal((await q("UPDATE model_profiles SET bio='hacked' WHERE user_id=$1 RETURNING user_id",[a])).length,0);
  assert.equal((await q('SELECT * FROM model_measurements WHERE user_id=$1',[a])).length,0);
  assert.equal((await scalar('SELECT model_search($1)',[{height_min:170}])).length,0,'cannot infer private height through search');
  const found=await scalar('SELECT model_search($1)',[{category:'commercial'}]);assert.equal(found[0].id,a);assert.equal(found[0].height_cm,null);
  await as(a);await q("UPDATE model_measurements SET visibility='members'");
  await as(b);assert.equal((await q('SELECT user_id FROM model_measurements WHERE user_id=$1',[a])).length,1);
  await as(null,'anon');assert.equal((await q('SELECT user_id FROM model_measurements WHERE user_id=$1',[a])).length,0);
  await as(a);await q("UPDATE model_measurements SET visibility='work_context'");
  await as(b);assert.equal((await q('SELECT user_id FROM model_measurements WHERE user_id=$1',[a])).length,0);
  await as(a);await q("UPDATE model_measurements SET visibility='public'");
  await as(null,'anon');assert.equal((await scalar('SELECT model_search($1)',[{height_min:170}])).length,1);
 });
 await t.test('digitals/portfolio metadata and representation share privacy architecture',async()=>{
  await as(a);await q("INSERT INTO profile_media(media_type,model_angle,object_path) VALUES('model_digitals','full_front',$1)",[a+'/digital.jpg']);
  await q("INSERT INTO profile_media(media_type,object_path,visibility) VALUES('model_portfolio',$1,'public')",[a+'/portfolio.jpg']);
  await q("INSERT INTO model_credits(kind,title,client_name,year) VALUES('editorial','Editorial work','Client',2026)");
  const agency=await scalar("SELECT organization_create('Model agency','model-agency','agency')");
  await q("INSERT INTO profile_representations(organization_id,name,role_type,territory,visibility) VALUES($1,'Agency','mother_agency','Россия','public')",[agency]);
  await as(null,'anon');assert.equal((await scalar('SELECT model_search($1)',[{digitals:true}])).length,0);
  assert.equal((await scalar('SELECT model_search($1)',[{portfolio:true,represented:true}])).length,1);
  assert.equal((await q('SELECT id FROM model_credits WHERE user_id=$1',[a])).length,1);
 });
 let affiliation,verification,school;
 await t.test('custom/private and education-school affiliations do not confer school workspace membership',async()=>{
  await as(b);school=await scalar("SELECT organization_create('Film School','film-school','education')");
  await as(a);affiliation=await scalar("INSERT INTO education_affiliations(organization_id,institution_name,expected_graduation_year,badge_visible) VALUES($1,'Private school',$2,true) RETURNING id",[school,new Date().getFullYear()+1]);
  assert.equal(await scalar('SELECT count(*)::int FROM organization_members WHERE organization_id=$1 AND user_id=$2',[school,a]),0);
  assert.equal(await scalar('SELECT student_badge($1)',[a]),false);
  await as(c);await q("INSERT INTO education_affiliations(institution_name,status) VALUES('Custom school','alumni')");
  await as(null,'anon');assert.equal((await q('SELECT id FROM education_affiliations WHERE user_id=$1',[a])).length,0);
 });
 await t.test('private evidence, explicit review authority, no self-verification, bounded expiry',async()=>{
  await as(a);const path=a+'/enrollment.pdf';await q("INSERT INTO storage.objects(id,name,bucket_id) VALUES($1,$2,'student-evidence')",[crypto.randomUUID(),path]);
  const unused=a+'/unused.pdf';await q("INSERT INTO storage.objects(id,name,bucket_id) VALUES($1,$2,'student-evidence')",[crypto.randomUUID(),unused]);
  assert.equal((await q('DELETE FROM storage.objects WHERE name=$1 RETURNING id',[unused])).length,1);
  verification=await scalar('SELECT student_verification_submit($1,$2)',[affiliation,path]);
  assert.equal((await q('DELETE FROM storage.objects WHERE name=$1 RETURNING id',[path])).length,0,'submitted evidence must remain immutable');
  await denied("UPDATE student_verifications SET status='approved',valid_until=now()+interval '10 years' WHERE id=$1",[verification]);
  await denied("SELECT student_verification_decide($1,true,now()+interval '1 month','Enrollment reviewed')",[verification]);
  await as(d);assert.equal((await q('SELECT * FROM student_verifications')).length,0);assert.equal((await q('SELECT id FROM storage.objects WHERE name=$1',[path])).length,0);
  await db.exec('RESET ROLE');await q("INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name='review_student_verification'",[b]);
  await q("INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name='review_student_verification'",[a]);
  await as(a);await denied("SELECT student_verification_decide($1,true,now()+interval '1 month','Enrollment reviewed')",[verification]);
  await as(b);const queue=await scalar('SELECT student_review_queue()');assert.equal(queue[0].user_id,a);assert.equal('email' in queue[0],false);assert.equal('dob' in queue[0],false);
  await assert.rejects(q("SELECT student_verification_decide($1,true,now()+interval '2 years','Enrollment reviewed')",[verification]),e=>e.code==='22023');
  await q("SELECT student_verification_decide($1,true,now()+interval '1 month','Enrollment reviewed')",[verification]);
  assert.equal(await scalar('SELECT decision_reason FROM student_verifications WHERE id=$1',[verification]),'Enrollment reviewed');assert.ok(await scalar('SELECT reviewed_at FROM student_verifications WHERE id=$1',[verification]));
  await as(null,'anon');assert.equal(await scalar('SELECT student_badge($1)',[a]),true);
  assert.equal((await q('SELECT id FROM education_affiliations WHERE user_id=$1',[a])).length,0,'badge does not disclose school');
  await denied('SELECT * FROM student_verifications');
 });
 let project;
 await t.test('self-declared versus verified project; affiliation cannot be stolen',async()=>{
  await as(c);const self=await scalar("INSERT INTO projects(title,student_project) VALUES('Educational film',true) RETURNING id");
  assert.equal(await scalar('SELECT student_project_badge($1)',[self]),false);
  await denied("UPDATE projects SET education_affiliation_id=$1 WHERE id=$2",[affiliation,self]);
  await as(a);project=await scalar("INSERT INTO projects(title,city,student_project,education_affiliation_id) VALUES('Student model film','Москва',true,$1) RETURNING id",[affiliation]);
  assert.equal(await scalar('SELECT student_project_badge($1)',[project]),true);
  await as(null,'anon');const search=await scalar('SELECT student_project_search($1)',[{verified:true}]);assert.equal(search.length,1);assert.equal('education_affiliation_id' in search[0],false);
  assert.equal((await scalar('SELECT student_project_search($1)',[{school:'Private school'}])).length,0,'cannot infer private school via filter');
 });
 let request;
 const terms={need_type:'mentorship',title:'Production consultation',description:'Discuss film planning',city:'Москва',start_date:'2027-02-01',end_date:'2027-02-02',compensation_type:'unpaid_educational',expenses_covered:'Не покрываются',usage_rights:'Без записи',deliverables:'Одна консультация',visibility:'public',mentorship_topic:'Planning',duration_minutes:30,remote:true};
 await t.test('structured support persists terms, enforces authority/limits/private access and closure',async()=>{
  await as(c);await denied('SELECT support_request_create($1,$2)',[project,terms]);
  await as(a);request=await scalar('SELECT support_request_create($1,$2)',[project,terms]);
  const privateId=await scalar('SELECT support_request_create($1,$2)',[project,{...terms,visibility:'private'}]);
  await denied("INSERT INTO project_support_requests(project_id,created_by,title) VALUES($1,$2,'Bypass')",[project,a]);
  await as(null,'anon');assert.equal((await q('SELECT id FROM project_support_requests WHERE id=$1',[request])).length,1);
  assert.equal((await q('SELECT id FROM project_support_requests WHERE id=$1',[privateId])).length,0);
  assert.equal((await scalar('SELECT student_project_search($1)',[{need:'mentorship',compensation:'unpaid_educational'}])).length,1);
  assert.equal((await scalar('SELECT student_project_search($1)',[{need:'equipment'}])).length,0);
  await as(a);await q("UPDATE project_support_requests SET status='closed' WHERE id=$1",[request]);
  await as(null,'anon');assert.equal((await q('SELECT id FROM project_support_requests WHERE id=$1',[request])).length,0);
  assert.equal((await scalar('SELECT student_project_search($1)',[{need:'mentorship'}])).length,0,'private request must not influence public discovery');
  await as(a);for(let i=0;i<3;i++)await q('SELECT support_request_create($1,$2)',[project,terms]);
  await assert.rejects(q('SELECT support_request_create($1,$2)',[project,terms]),e=>e.code==='23514');
 });
 await t.test('student model application uses canonical application, no actor-only fields',async()=>{
  await as(c);await denied("INSERT INTO work_opportunities(title,type,project_id) VALUES('Stolen project','vacancy',$1)",[project]);
  const work=await scalar("INSERT INTO work_opportunities(title,type,audience,target_kinds,city,shoot_date,compensation_type,expenses_covered,usage_rights,deliverables) VALUES('Model film','casting','Модели',ARRAY['models'],'Москва','2027-02-01','tfp','Travel','Portfolio only','Ten frames') RETURNING id");
  await as(a);await q('INSERT INTO work_applications(work_id) VALUES($1)',[work]);
  assert.equal(await scalar('SELECT count(*)::int FROM work_applications WHERE work_id=$1',[work]),1);
  await as(c);await assert.rejects(q("INSERT INTO work_opportunities(title,type,audience,target_kinds) VALUES('Hidden unpaid','casting','Модели',ARRAY['models'])"),e=>e.code==='23514');
 });
 await t.test('support opt-in/opt-out, company privacy and blocks never expose private contact',async()=>{
  await as(c);await q("INSERT INTO student_support_preferences(enabled,support_types,cities) VALUES(true,ARRAY['mentorship'],ARRAY['Москва'])");
  const org=await scalar("SELECT organization_create('Support Rental','support-rental','rental_house')");
  await q("INSERT INTO organization_student_support(organization_id,enabled,support_types,cities) VALUES($1,true,ARRAY['rental_discount'],ARRAY['Москва'])",[org]);
  await as(a);assert.equal((await scalar("SELECT support_search('person','Москва','mentorship')")).length,1);
  assert.equal((await scalar("SELECT support_search('company','Москва','rental_discount')")).length,1);
  await q('INSERT INTO user_blocks(blocked_user_id) VALUES($1)',[c]);
  assert.equal((await scalar("SELECT support_search('person','Москва','mentorship')")).length,0);
  await as(d);assert.equal((await q("UPDATE organization_student_support SET enabled=false WHERE organization_id=$1 RETURNING organization_id",[org])).length,0);
  await as(c);await q("UPDATE organizations SET visibility='members_only' WHERE id=$1",[org]);await q('UPDATE student_support_preferences SET enabled=false');
  await as(d);assert.equal((await scalar("SELECT support_search('company')")).length,0);assert.equal((await scalar("SELECT support_search('person')")).length,0);
 });
 await t.test('expiry and affiliation changes remove badge; PRO never re-verifies',async()=>{
  await db.exec('RESET ROLE');await q("UPDATE student_verifications SET verified_at=now()-interval '2 months',valid_until=now()-interval '1 month' WHERE id=$1",[verification]);
  await as(a);assert.equal(await scalar('SELECT student_badge($1)',[a]),false);assert.equal(await scalar('SELECT student_project_badge($1)',[project]),false);
  await assert.rejects(q('SELECT support_request_create($1,$2)',[project,terms]),e=>e.code==='23514');
  await db.exec('RESET ROLE');await q("INSERT INTO account_entitlements(user_id,entitlement_code,source) VALUES($1,'pro','test')",[a]);
  await q("UPDATE student_verifications SET valid_until=now()+interval '1 month' WHERE id=$1",[verification]);
  await as(a);await q("UPDATE education_affiliations SET institution_name='Changed school' WHERE id=$1",[affiliation]);
  assert.equal(await scalar('SELECT student_badge($1)',[a]),false);await denied('UPDATE education_affiliations SET revision=1 WHERE id=$1',[affiliation]);
  await as(d);assert.equal((await q("UPDATE education_affiliations SET status='alumni' WHERE id=$1 RETURNING id",[affiliation])).length,0);
 });
 await t.test('basic help, company eligibility and type-aware fields work without claiming verification',async()=>{
  await as(d);const basic=await scalar("INSERT INTO projects(title,student_project) VALUES('Self declared',true) RETURNING id");
  const n=await scalar('SELECT support_request_create($1,$2)',[basic,{...terms,usage_rights:null,deliverables:null}]);assert.ok(n);
  await assert.rejects(q('SELECT support_request_create($1,$2)',[basic,terms]),e=>e.code==='23514');
  await as(b);const org=await scalar("SELECT organization_create('Helpful school','helpful-school','education')");
  await q("INSERT INTO organization_student_support(organization_id,enabled,eligibility) VALUES($1,true,'all_student_projects')",[org]);
  await as(d);assert.equal(await scalar('SELECT student_program_eligible($1,$2)',[org,basic]),true);
  await as(b);await q("UPDATE organization_student_support SET eligibility='verified_only' WHERE organization_id=$1",[org]);
  const orgProject=await scalar("INSERT INTO projects(title,organization_id,student_project) VALUES('School production',$1,true) RETURNING id",[org]);
  assert.ok(await scalar('SELECT support_request_create($1,$2)',[orgProject,{...terms,need_type:'transport',usage_rights:null,deliverables:null}]));
  await as(d);assert.equal(await scalar('SELECT student_program_eligible($1,$2)',[org,basic]),false);
  await denied("INSERT INTO projects(title,organization_id,student_project) VALUES('Impersonation',$1,true)",[org]);
 });
 await t.test('canonical blocks reject new direct sends and invitations while retaining history',async()=>{
  await as(a);const room=await scalar('SELECT get_or_create_direct_chat($1)',[b]);await q('SELECT chat_send($1,$2,$3)',[room,'History',crypto.randomUUID()]);
  await as(b);await q("INSERT INTO profile_contacts(kind,value,visibility) VALUES('phone','visible-contact','public')");
  await as(a);assert.equal((await q('SELECT value FROM profile_contacts WHERE user_id=$1',[b])).length,1);
  await q('INSERT INTO user_blocks(blocked_user_id) VALUES($1)',[b]);
  await denied('SELECT chat_send($1,$2,$3)',[room,'Blocked',crypto.randomUUID()]);
  assert.equal((await q('SELECT id FROM chat_messages WHERE room_id=$1',[room])).length,1);
  assert.equal((await q('SELECT value FROM profile_contacts WHERE user_id=$1',[b])).length,0);
  await denied('INSERT INTO project_members(project_id,user_id) VALUES($1,$2)',[project,b]);
  await as(b);await denied('SELECT chat_send($1,$2,$3)',[room,'Reverse blocked',crypto.randomUUID()]);
  const org=await scalar("SELECT organization_create('Blocked invites','blocked-invites','production_company')");
  await denied('SELECT organization_invite($1,$2,$3)',[org,a+'@test.invalid','member']);
  await as(d);await q('INSERT INTO user_blocks(blocked_user_id) VALUES($1)',[b]);await denied('SELECT get_or_create_direct_chat($1)',[b]);
 });
 await t.test('new relations enforce RLS and private definers fix search_path',async()=>{
  await db.exec('RESET ROLE');
  const tables=['model_profiles','model_measurements','model_credits','education_affiliations','student_verifications','student_program_policy','project_support_requests','student_support_preferences','organization_student_support','user_blocks','support_reports'];
  for(const table of tables)assert.equal(await scalar('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',['public.'+table]),true,table);
  const unsafe=await q("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='filmverse_private' AND p.prosecdef AND NOT ('search_path=\"\"'=ANY(coalesce(p.proconfig,ARRAY[]::text[])))");assert.deepEqual(unsafe,[]);
  assert.equal(await scalar("SELECT has_function_privilege('anon','public.student_verification_submit(uuid,text)','EXECUTE')"),false);
  assert.equal(await scalar("SELECT has_function_privilege('authenticated','filmverse_private.student_current(uuid)','EXECUTE')"),false);
  assert.equal(await scalar("SELECT file_size_limit::int FROM storage.buckets WHERE id='student-evidence'"),10485760);
 });
 }finally{await db.close();}
});
