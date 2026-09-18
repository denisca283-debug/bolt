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
   CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
   CREATE PUBLICATION supabase_realtime;
  `);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
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
 }finally{await db.close();}
});
