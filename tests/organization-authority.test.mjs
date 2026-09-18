import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const ids=[1,2,3,4].map(n=>'10000000-0000-4000-8000-00000000000'+n);
const [a,b,c,d]=ids;
test('organization identity: replay, consent, invitation and adversarial authority',async t=>{
 const db=new PGlite();
 const q=async(sql,args=[]) => {
  if(process.env.FILMVERSE_SQL_TRACE) console.error(sql.slice(0,120));
  return (await db.query(sql,args)).rows;
 };
 const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
 const as=async(id,role='authenticated')=>{
  await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('SET ROLE '+role);
 };
 const denied=(sql,args=[])=>assert.rejects(q(sql,args),e=>e.code==='42501');
 try{
  await db.exec(`
   CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
   CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
   CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text,bucket_id text);
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA storage TO anon,authenticated;
   GRANT SELECT,INSERT,DELETE ON storage.objects TO anon,authenticated;
   CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
   CREATE PUBLICATION supabase_realtime;
  `);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  const legacy='20000000-0000-4000-8000-000000000001';
  let legacyOrg,legacyMember,legacyProject,legacySkill;
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) {
   if(file.includes('organization_identity_authority')){
    await q('INSERT INTO auth.users(id) VALUES($1)',[legacy]);
    await q("INSERT INTO profiles(id,full_name) VALUES($1,'Legacy owner')",[legacy]);
    legacyOrg=await scalar("INSERT INTO organizations(name,slug,organization_type,created_by) VALUES('Legacy org','legacy-org','legacy_custom',$1) RETURNING id",[legacy]);
    legacyMember=await scalar("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner') RETURNING id",[legacyOrg,legacy]);
    legacyProject=await scalar("INSERT INTO projects(title,user_id) VALUES('Legacy personal project',$1) RETURNING id",[legacy]);
    legacySkill=await scalar("INSERT INTO user_skills(user_id,skill_id) SELECT $1,id FROM skills WHERE name='Реклама' RETURNING id",[legacy]);
   }
   await db.exec(await readFile(new URL(file,dir),'utf8'));
  }
  await t.test('pre-layer rows retain IDs, custom type and personal ownership; experience selection maps without deletion',async()=>{
   assert.equal(await scalar('SELECT id FROM organization_members WHERE organization_id=$1',[legacyOrg]),legacyMember);
   assert.equal(await scalar('SELECT organization_type FROM organizations WHERE id=$1',[legacyOrg]),'legacy_custom');
   const project=(await q('SELECT user_id,organization_id FROM projects WHERE id=$1',[legacyProject]))[0];
   assert.equal(project.user_id,legacy);assert.equal(project.organization_id,null);
   assert.equal(await scalar('SELECT id FROM user_skills WHERE user_id=$1',[legacy]),legacySkill);
   assert.equal(await scalar('SELECT count(*)::int FROM user_experience_tags WHERE user_id=$1',[legacy]),1);
   // Keep legacy fixture out of later public-discovery expectations.
   await q("UPDATE organizations SET visibility='members_only' WHERE id=$1",[legacyOrg]);
  });
  for(const id of ids){
   await q('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[id,id+'@example.test']);
   await q('INSERT INTO profiles(id,full_name,public_slug) VALUES($1,$2,$3)',[id,'Test '+id,'test-'+id]);
  }
  await as(a);
  const org=await scalar("SELECT organization_create('Test Rental','test-rental','rental_house')");
  await t.test('atomic company owner; creator and privileged columns immutable',async()=>{
   assert.equal(await scalar('SELECT role FROM organization_members WHERE organization_id=$1',[org]),'owner');
   await denied("UPDATE organizations SET created_by=$1 WHERE id=$2",[b,org]);
   await denied("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",[org,b]);
   await denied("UPDATE organization_members SET role='admin'");
   await denied("SELECT organization_member_change($1,$2,'owner',false)",[org,a]);
  });
  await t.test('public company projection never exposes raw company or internal roster',async()=>{
   await as(null,'anon');
   await denied('SELECT * FROM organizations');await denied('SELECT * FROM organization_members');
   const pub=await scalar("SELECT company_public('test-rental')");
   assert.equal(pub.name,'Test Rental');for(const key of ['created_by','billing','members','permissions']) assert.equal(key in pub,false);
   assert.equal((await scalar('SELECT company_search()')).length,1);
  });
  let invitation;
  await t.test('invitation binds confirmed email, no arbitrary self-join or email lookup',async()=>{
   await as(a);invitation=await scalar("SELECT organization_invite($1,$2,'producer')",[org,b+'@example.test']);
   await as(c);await denied("SELECT organization_invitation_reply($1,'accept')",[invitation]);
   assert.equal(await scalar('SELECT count(*)::int FROM organization_invitations'),0);
   await as(b);await q("SELECT organization_invitation_reply($1,'accept')",[invitation]);
   await q("SELECT organization_invitation_reply($1,'accept')",[invitation]);
   assert.equal(await scalar('SELECT count(*)::int FROM organization_members WHERE user_id=$1',[b]),1);
   assert.equal(await scalar("SELECT filmverse_private.org_can($1,'manage_projects')",[org]),true);
   assert.equal(await scalar("SELECT filmverse_private.org_can($1,'manage_billing')",[org]),false);
   await denied("SELECT organization_member_change($1,$2,'owner',true)",[org,b]);
   await denied("SELECT organization_invite($1,$2,'member')",[org,d+'@example.test']);
  });
  await t.test('admin cannot promote to owner/finance; removed members lose access immediately',async()=>{
   await as(a);await q("SELECT organization_member_change($1,$2,'admin',true)",[org,b]);
   await as(b);await denied("SELECT organization_member_change($1,$2,'owner',true)",[org,b]);
   await denied("SELECT organization_invite($1,$2,'finance')",[org,d+'@example.test']);
   await as(a);await q("SELECT organization_member_change($1,$2,'admin',false)",[org,b]);
   await as(b);assert.equal(await scalar('SELECT count(*)::int FROM organizations'),0);
   assert.equal(await scalar("SELECT filmverse_private.org_can($1,'manage_projects')",[org]),false);
   assert.equal((await q("UPDATE organizations SET name='Stolen' WHERE id=$1 RETURNING id",[org])).length,0);
  });
  await t.test('members-only and unlisted are distinct from discovery; old owner remains',async()=>{
   await as(a);await q("UPDATE organizations SET visibility='members_only' WHERE id=$1",[org]);
   await as(c);assert.equal(await scalar("SELECT company_public('test-rental')"),null);
   await as(a);await q("UPDATE organizations SET visibility='unlisted' WHERE id=$1",[org]);
   await as(null,'anon');assert.equal((await scalar("SELECT company_public('test-rental')")).id,org);
   assert.equal((await scalar('SELECT company_search()')).length,0);
   await as(a);assert.equal(await scalar("SELECT role FROM organization_members WHERE user_id=$1",[a]),'owner');
  });
  await t.test('unconfirmed/expired invites cannot join; account deletion cannot orphan company',async()=>{
   await as(a);const invite=await scalar("SELECT organization_invite($1,$2,'member')",[org,c+'@example.test']);
   await db.exec('RESET ROLE');await q('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1',[c]);
   await as(c);await denied("SELECT organization_invitation_reply($1,'accept')",[invite]);
   await db.exec('RESET ROLE');await q('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[c]);
   await q("UPDATE organization_invitations SET expires_at=now()-interval '1 day' WHERE id=$1",[invite]);
   await as(c);await q("SELECT organization_invitation_reply($1,'accept')",[invite]);
   assert.equal(await scalar('SELECT status FROM organization_invitations WHERE id=$1',[invite]),'expired');
   assert.equal(await scalar('SELECT count(*)::int FROM organization_members WHERE user_id=$1',[c]),0);
   await db.exec('RESET ROLE');await denied('DELETE FROM auth.users WHERE id=$1',[a]);
  });
  await t.test('producer content survives departure and account deletion; other company cannot take it',async()=>{
   await as(a);const invite=await scalar("SELECT organization_invite($1,$2,'producer')",[org,b+'@example.test']);
   await as(b);await q("SELECT organization_invitation_reply($1,'accept')",[invite]);
   const project=await scalar("INSERT INTO projects(title,organization_id,visibility) VALUES('Company film',$1,'private') RETURNING id",[org]);
   await q("INSERT INTO work_opportunities(title,type,audience,organization_id) VALUES('DP','job','professional',$1)",[org]);
   await denied("UPDATE projects SET organization_id=NULL WHERE id=$1",[project]);
   await q("SELECT organization_member_change($1,$2,'producer',false)",[org,b]);
   assert.equal((await q("UPDATE projects SET title='stolen' WHERE id=$1 RETURNING id",[project])).length,0);
   await db.exec('RESET ROLE');await q("SELECT set_config('request.jwt.claim.sub','',false)");
   await q('DELETE FROM auth.users WHERE id=$1',[b]);
   assert.equal(await scalar('SELECT organization_id FROM projects WHERE id=$1',[project]),org);
   assert.equal(await scalar('SELECT user_id FROM projects WHERE id=$1',[project]),null);
   await as(a);await q("UPDATE projects SET title='Still owned by company' WHERE id=$1",[project]);
   await as(c);assert.equal((await q('SELECT id FROM projects WHERE id=$1',[project])).length,0);
  });
  await t.test('agency briefs/relations, rental packages and company billing never leak or cross tenants',async()=>{
   await as(a);
   const agency=await scalar("SELECT organization_create('Agency','the-agency','agency')");
   const brief=await scalar("INSERT INTO organization_briefs(organization_id,title,confidential_budget) VALUES($1,'Client brief','private budget') RETURNING id",[agency]);
   const inventory=await scalar("INSERT INTO organization_inventory_items(organization_id,category,custom_name,replacement_value) VALUES($1,'camera','Camera',100000) RETURNING id",[org]);
   const pack=await scalar("INSERT INTO equipment_packages(organization_id,name) VALUES($1,'Camera package') RETURNING id",[org]);
   await q("INSERT INTO equipment_package_items(organization_id,package_id,inventory_item_id) VALUES($1,$2,$3)",[org,pack,inventory]);
   const otherPack=await scalar("INSERT INTO equipment_packages(organization_id,name) VALUES($1,'Other company package') RETURNING id",[agency]);
   await assert.rejects(q("INSERT INTO equipment_package_items(organization_id,package_id,inventory_item_id) VALUES($1,$2,$3)",[agency,otherPack,inventory]),e=>e.code==='23503');
   await q("INSERT INTO marketplace_listings(title,mode,organization_id,inventory_item_id) VALUES('Rental camera','rent',$1,$2)",[org,inventory]);
   await denied("INSERT INTO organization_entitlements(organization_id,entitlement_code,source) VALUES($1,'organization_pro','test')",[org]);
   await denied("INSERT INTO organization_campaign_daily_metrics(organization_id,promotion_id,day) VALUES($1,$2,current_date)",[org,crypto.randomUUID()]);
   await assert.rejects(q("INSERT INTO organization_promotions(organization_id,product_code,targeting) VALUES($1,'brand_campaign',$2)",[agency,{religion:['x']}]),e=>e.code==='23514');
   await as(c);assert.equal((await q('SELECT id FROM organization_briefs WHERE id=$1',[brief])).length,0);
   assert.equal((await q('SELECT id FROM organization_inventory_items')).length,0);
   assert.equal((await q('SELECT id FROM project_organizations')).length,0);
   assert.equal((await q('SELECT id FROM organization_entitlements')).length,0);
   await denied("INSERT INTO marketplace_listings(title,mode,organization_id) VALUES('Unauthorized','rent',$1)",[org]);
   await as(null,'anon');await denied('SELECT * FROM organization_briefs');await denied('SELECT * FROM organization_entitlements');
  });
  await t.test('private person cannot be read by slug/id/actor/skills; application context grants only relevant access',async()=>{
   await as(c);
   await q("INSERT INTO profile_privacy_settings(profile_visibility,message_permission,invite_permission) VALUES('private','none','members')");
   await q("INSERT INTO actors(user_id,full_name) VALUES($1,'Private Actor')",[c]);
   await q("INSERT INTO profile_contacts(kind,value) VALUES('phone','private phone')");
   await q("INSERT INTO pulse_feed(user_id,kind,person,action) VALUES($1,'role','Private Actor','private activity')",[c]);
   await as(a);const work=await scalar("INSERT INTO work_opportunities(title,type,audience) VALUES('Casting','casting','actor') RETURNING id");
   assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   assert.equal((await q('SELECT id FROM profiles WHERE id=$1',[c])).length,0);
   assert.equal((await q('SELECT id FROM actors WHERE user_id=$1',[c])).length,0);
   assert.equal((await q('SELECT id FROM pulse_feed WHERE user_id=$1',[c])).length,0);
   await denied('SELECT get_or_create_direct_chat($1)',[c]);
   await as(c);const application=await scalar('INSERT INTO work_applications(work_id) VALUES($1) RETURNING id',[work]);
   const path=c+'/self-tape.mp4';
   await q("INSERT INTO profile_media(media_type,object_path,visibility,application_id) VALUES('self_tape',$1,'application_context',$2)",[path,application]);
   await q("INSERT INTO storage.objects(id,name,bucket_id) VALUES($1,$2,'profile-media')",[crypto.randomUUID(),path]);
   await as(a);assert.equal((await scalar('SELECT person_public($1)',['test-'+c])).id,c);
   assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,0);
   assert.equal((await q('SELECT id FROM storage.objects WHERE name=$1',[path])).length,1);
   await as(d);assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   assert.equal((await q('SELECT id FROM profile_media WHERE object_path=$1',[path])).length,0);
   assert.equal((await q('SELECT id FROM storage.objects WHERE name=$1',[path])).length,0);
   await as(c);await q("UPDATE work_applications SET status='withdrawn' WHERE id=$1",[application]);
   await as(a);assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   assert.equal((await q('SELECT id FROM storage.objects WHERE name=$1',[path])).length,0);
  });
  await t.test('project visibility requires accepted membership; privacy settings owner-only',async()=>{
   await as(a);const project=await scalar("INSERT INTO projects(title) VALUES('Private collaboration') RETURNING id");
   await denied('INSERT INTO project_members(project_id,user_id) VALUES($1,$2)',[project,c]);
   await as(c);await q("UPDATE profile_privacy_settings SET profile_visibility='members'");
   await as(a);const membership=await scalar('INSERT INTO project_members(project_id,user_id) VALUES($1,$2) RETURNING id',[project,c]);
   await denied("SELECT project_membership_reply($1,'active')",[membership]);
   await as(c);await q("SELECT project_membership_reply($1,'active')",[membership]);
   await q("UPDATE profile_privacy_settings SET profile_visibility='private'");
   await as(a);assert.equal((await scalar('SELECT person_public($1)',['test-'+c])).id,c);
   await as(d);assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   assert.equal((await q("UPDATE profile_privacy_settings SET profile_visibility='public' WHERE user_id=$1 RETURNING user_id",[c])).length,0);
   await as(c);await q("SELECT project_membership_reply($1,'removed')",[membership]);
   await as(a);assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   await as(null,'anon');assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   await as(c);await q("UPDATE profile_privacy_settings SET profile_visibility='public',search_discoverable=false");
   await as(a);assert.equal((await scalar('SELECT person_public($1)',['test-'+c])).id,c);
   assert.equal((await scalar('SELECT actor_directory()')).some(row=>row.user_id===c),false);
   assert.equal((await scalar('SELECT person_recipients()')).some(row=>row.id===c),false);
  });
  await t.test('Resume publication is atomic, idempotent and cannot self-grant or spend twice',async()=>{
   await as(d);
   const resume=await scalar("INSERT INTO profile_publications(headline) VALUES('Looking for work') RETURNING id");
   const second=await scalar("INSERT INTO profile_publications(headline) VALUES('Another resume') RETURNING id");
   const request=crypto.randomUUID();
   await denied('SELECT resume_publish($1,$2)',[resume,request]);
   assert.equal(await scalar('SELECT status FROM profile_publications WHERE id=$1',[resume]),'draft');
   await denied("UPDATE profile_publications SET status='active' WHERE id=$1",[resume]);
   await denied("INSERT INTO resume_entitlement_receipts(publication_id,user_id,entitlement_id,kind) VALUES($1,$2,$3,'pro')",[resume,d,crypto.randomUUID()]);
   await db.exec('RESET ROLE');
   const grant=await scalar("INSERT INTO account_entitlements(user_id,entitlement_code,source,remaining_uses) VALUES($1,'resume_publication','test',1) RETURNING id",[d]);
   await as(d);assert.equal(await scalar('SELECT resume_publish($1,$2)',[resume,request]),resume);
   assert.equal(await scalar('SELECT resume_publish($1,$2)',[resume,request]),resume);
   await assert.rejects(q('SELECT resume_publish($1,$2)',[second,request]),e=>e.code==='22023');
   await denied('SELECT resume_publish($1,$2)',[second,crypto.randomUUID()]);
   await q("SELECT resume_transition($1,'paused')",[resume]);
   await q('SELECT resume_publish($1,$2)',[resume,crypto.randomUUID()]);
   await db.exec('RESET ROLE');assert.equal(await scalar('SELECT remaining_uses FROM account_entitlements WHERE id=$1',[grant]),0);
   await as(a);await denied('SELECT resume_publish($1,$2)',[resume,crypto.randomUUID()]);
   await denied("SELECT resume_transition($1,'closed')",[resume]);
   await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM resume_publications WHERE id=$1',[resume]),1);
   await db.exec('RESET ROLE');await q("UPDATE account_entitlements SET status='revoked' WHERE id=$1",[grant]);
   await as(null,'anon');assert.equal(await scalar('SELECT count(*)::int FROM resume_publications WHERE id=$1',[resume]),0);
   await as(d);assert.equal(await scalar('SELECT status FROM resume_publications WHERE id=$1',[resume]),'expired');
  });
  await t.test('PRO publication does not consume a one-time use; invalid draft rolls back',async()=>{
   await db.exec('RESET ROLE');
   const grant=await scalar("INSERT INTO account_entitlements(user_id,entitlement_code,source,remaining_uses) VALUES($1,'resume_publication','test',1) RETURNING id",[a]);
   await q("INSERT INTO account_entitlements(user_id,entitlement_code,source) VALUES($1,'pro','test')",[a]);
   await as(a);const resume=await scalar("INSERT INTO profile_publications(headline,desired_profession_ids) VALUES('Invalid profession',ARRAY[$1::uuid]) RETURNING id",[crypto.randomUUID()]);
   await assert.rejects(q('SELECT resume_publish($1,$2)',[resume,crypto.randomUUID()]),e=>e.code==='22023');
   assert.equal(await scalar('SELECT status FROM profile_publications WHERE id=$1',[resume]),'draft');
   await q("UPDATE profile_publications SET desired_profession_ids='{}' WHERE id=$1",[resume]);
   await q('SELECT resume_publish($1,$2)',[resume,crypto.randomUUID()]);
   await db.exec('RESET ROLE');assert.equal(await scalar('SELECT remaining_uses FROM account_entitlements WHERE id=$1',[grant]),1);
   assert.equal(await scalar('SELECT kind FROM resume_entitlement_receipts WHERE publication_id=$1',[resume]),'pro');
  });
  await t.test('custom skills trim, dedupe, bound count, remain owner-only; experience is separate',async()=>{
   await as(c);await q("UPDATE profile_privacy_settings SET profile_visibility='private'");
   const skill=await scalar("INSERT INTO user_custom_skills(name,scope) VALUES('  Unique   skill  ','actor') RETURNING id");
   assert.equal(await scalar('SELECT name FROM user_custom_skills WHERE id=$1',[skill]),'Unique skill');
   await assert.rejects(q("INSERT INTO user_custom_skills(name,scope) VALUES('unique skill','professional')"),e=>e.code==='23505');
   for(let i=0;i<49;i++)await q("INSERT INTO user_custom_skills(name,scope) VALUES($1,'actor')",['Skill '+i]);
   await assert.rejects(q("INSERT INTO user_custom_skills(name,scope) VALUES('Too many','actor')"),e=>e.code==='23514');
   await q("INSERT INTO user_experience_tags(tag_id) SELECT id FROM experience_tags WHERE name='Реклама'");
   await denied("INSERT INTO skills(name) VALUES('Client dictionary pollution')");
   await as(a);assert.equal(await scalar('SELECT count(*)::int FROM user_custom_skills WHERE user_id=$1',[c]),0);
   assert.equal((await q("UPDATE user_custom_skills SET name='hacked' WHERE id=$1 RETURNING id",[skill])).length,0);
   assert.equal(await scalar('SELECT count(*)::int FROM user_experience_tags WHERE user_id=$1',[c]),0);
   assert.equal(await scalar("SELECT is_active FROM skills WHERE name='Реклама'"),false);
   assert.equal(await scalar("SELECT scope FROM skills WHERE name='Верховая езда'"),'both');
  });
  await t.test('explicit contact/media grants enforce public, members, private and work-context boundaries',async()=>{
   await as(c);await q("UPDATE profile_privacy_settings SET profile_visibility='public'");
   await q("UPDATE profile_contacts SET visibility='public' WHERE user_id=$1",[c]);
   const path=c+'/public.jpg';
   const media=await scalar("INSERT INTO profile_media(media_type,object_path,visibility) VALUES('gallery',$1,'public') RETURNING id",[path]);
   const rep=await scalar("INSERT INTO profile_representations(name,contact,visibility,contact_visibility) VALUES('Public representative','Secret contact','public','private') RETURNING id");
   assert.equal((await q('SELECT * FROM profile_representations WHERE id=$1',[rep])).length,1);
   await as(null,'anon');
   for(const table of ['profile_contacts','profile_media'])assert.equal(await scalar('SELECT has_table_privilege(current_user,$1,\'SELECT\')',[table]),true);
   assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,1);
   assert.equal((await q('SELECT id FROM profile_media WHERE id=$1',[media])).length,1);
   assert.equal((await scalar('SELECT person_representatives($1)',[c]))[0].contact,null);
   await as(c);await q("UPDATE profile_contacts SET visibility='members' WHERE user_id=$1",[c]);
   await q("UPDATE profile_media SET visibility='members' WHERE id=$1",[media]);
   await q("UPDATE profile_representations SET visibility='members' WHERE id=$1",[rep]);
   await as(null,'anon');assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,0);
   assert.equal((await q('SELECT id FROM profile_media WHERE id=$1',[media])).length,0);
   assert.equal((await scalar('SELECT person_representatives($1)',[c])).length,0);
   await as(d);assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,1);
   assert.equal((await q('SELECT id FROM profile_media WHERE id=$1',[media])).length,1);
   assert.equal((await q('SELECT id FROM profile_representations WHERE id=$1',[rep])).length,0);
   const work=await scalar("INSERT INTO work_opportunities(title,type,audience) VALUES('Review','casting','actor') RETURNING id");
   await as(c);const application=await scalar('INSERT INTO work_applications(work_id) VALUES($1) RETURNING id',[work]);
   await q("UPDATE profile_contacts SET visibility='work_context' WHERE user_id=$1",[c]);
   await q("UPDATE profile_representations SET visibility='work_context',contact_visibility='work_context' WHERE id=$1",[rep]);
   await q("UPDATE profile_media SET visibility='application_context',application_id=$1 WHERE id=$2",[application,media]);
   await as(d);assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,1);
   assert.equal((await q('SELECT id FROM profile_media WHERE id=$1',[media])).length,1);
   assert.equal((await scalar('SELECT person_representatives($1)',[c]))[0].contact,'Secret contact');
   await as(a);assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,0);
   assert.equal((await q('SELECT id FROM profile_media WHERE id=$1',[media])).length,0);
   assert.equal((await scalar('SELECT person_representatives($1)',[c])).length,0);
   await as(c);await q("UPDATE profile_contacts SET visibility='private' WHERE user_id=$1",[c]);
   await q("UPDATE profile_media SET visibility='private',application_id=NULL WHERE id=$1",[media]);
   await q("UPDATE profile_representations SET visibility='private' WHERE id=$1",[rep]);
   await as(d);assert.equal((await q('SELECT id FROM profile_contacts WHERE user_id=$1',[c])).length,0);
   assert.equal((await q('SELECT id FROM profile_media WHERE id=$1',[media])).length,0);
   await q('UPDATE work_opportunities SET hiring_active=false WHERE id=$1',[work]);
  });
  await t.test('private profile can publish public Resume; hiring is DB authority; link-only requires revocable bearer',async()=>{
   await db.exec('RESET ROLE');await q("INSERT INTO account_entitlements(user_id,entitlement_code,source) VALUES($1,'pro','test')",[c]);
   await as(c);await q("UPDATE profile_privacy_settings SET profile_visibility='private'");
   const resume=await scalar("INSERT INTO profile_publications(headline,display_name) VALUES('Public professional identity','Chosen name') RETURNING id");
   await q('SELECT resume_publish($1,$2)',[resume,crypto.randomUUID()]);
   await as(null,'anon');const safe=await scalar('SELECT resume_read($1)',[resume]);
   assert.equal(safe.display_name,'Chosen name');assert.equal(await scalar('SELECT person_public($1)',['test-'+c]),null);
   for(const key of ['contacts','dob','permissions','media','entitlements','email'])assert.equal(key in safe,false);
   await as(c);await q("UPDATE profile_publications SET visibility='hiring_members' WHERE id=$1",[resume]);
   await as(null,'anon');assert.equal(await scalar('SELECT resume_read($1)',[resume]),null);
   await as(d);assert.equal(await scalar('SELECT resume_read($1)',[resume]),null);
   await as(a);assert.equal((await scalar('SELECT resume_read($1)',[resume])).id,resume);
   await as(c);await q("UPDATE profile_publications SET visibility='link_only' WHERE id=$1",[resume]);
   const token=await scalar('SELECT resume_share($1)',[resume]);assert.equal(token.length,64);
   await as(null,'anon');assert.equal(await scalar('SELECT resume_read($1)',[resume]),null);
   assert.equal(await scalar('SELECT resume_read($1,$2)',[resume,'f'.repeat(64)]),null);
   assert.equal((await scalar('SELECT resume_read($1,$2)',[resume,token])).id,resume);
   assert.equal((await q('SELECT id FROM resume_discovery WHERE id=$1',[resume])).length,0);
   assert.equal((await q('SELECT id FROM profile_publications WHERE id=$1',[resume])).length,0);
   await denied('SELECT * FROM filmverse_private.resume_share_keys');
   await as(d);await denied('SELECT resume_share($1)',[resume]);
   await as(c);await q('SELECT resume_share($1,true)',[resume]);
   await as(null,'anon');assert.equal(await scalar('SELECT resume_read($1,$2)',[resume,token]),null);
  });
  await t.test('invitation projection explains company without granting company table or private inviter fields',async()=>{
   await as(a);const invite=await scalar("SELECT organization_invite($1,$2,'member')",[org,d+'@example.test']);
   await as(d);const card=(await scalar('SELECT organization_invitation_cards()')).find(v=>v.id===invite);
   assert.equal(card.organization_name,'Test Rental');assert.equal(card.is_recipient,true);
   assert.equal('invited_email' in card,false);assert.equal('permissions' in card,false);
   assert.equal((await q('SELECT id FROM organizations WHERE id=$1',[org])).length,0);
   await as(c);assert.equal((await scalar('SELECT organization_invitation_cards()')).some(v=>v.id===invite),false);
   await as(null,'anon');await denied('SELECT organization_invitation_cards()');
  });
  await t.test('unlisted content is directly readable but absent from discovery views',async()=>{
   await as(a);
   for(const table of ['projects','work_opportunities','marketplace_listings']){
    const extra=table==='work_opportunities'?",type,audience":table==='marketplace_listings'?",mode":'';
    const values=table==='work_opportunities'?",'job','professional'":table==='marketplace_listings'?",'rent'":'';
    const id=await scalar(`INSERT INTO ${table}(title,visibility${extra}) VALUES('Link content','unlisted'${values}) RETURNING id`);
    await as(null,'anon');assert.equal((await q(`SELECT id FROM ${table} WHERE id=$1`,[id])).length,1);
    assert.equal((await q(`SELECT id FROM ${table}_discovery WHERE id=$1`,[id])).length,0);await as(a);
   }
  });
  await t.test('public team consent and representative contact redaction; every new table uses RLS',async()=>{
   await as(a);await q("UPDATE organizations SET visibility='public' WHERE id=$1",[org]);
   assert.equal((await scalar('SELECT company_team($1)',[org])).length,0);
   await q('UPDATE organization_members SET public_visible=true WHERE organization_id=$1 AND user_id=$2',[org,a]);
   await q("INSERT INTO profile_representations(name,contact,visibility,contact_visibility) VALUES('Agent','private-agent-phone','public','private')");
   await as(null,'anon');assert.equal((await scalar('SELECT company_team($1)',[org])).length,1);
   const reps=await scalar('SELECT person_representatives($1)',[a]);assert.equal(reps[0].name,'Agent');assert.equal(reps[0].contact,null);
   await denied('SELECT * FROM profile_representations');
   await db.exec('RESET ROLE');
   for(const table of ['organization_invitations','organization_audit_events','organization_inventory_items','equipment_packages','equipment_package_items','project_organizations','organization_briefs','organization_entitlements','organization_promotions','organization_campaign_daily_metrics','organization_inbox_threads','profile_privacy_settings','profile_contacts','profile_representations','profile_media','profile_publications','resume_entitlement_receipts','resume_publication_requests','user_custom_skills','user_experience_tags']){
    assert.equal(await scalar('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[table]),true,table);
   }
   const definer=await q("SELECT proname,proconfig FROM pg_proc WHERE pronamespace='filmverse_private'::regnamespace AND prosecdef");
   for(const f of definer)assert.ok(f.proconfig.some(c=>c.startsWith('search_path=')),f.proname);
  });
 }finally{await db.close();}
});
