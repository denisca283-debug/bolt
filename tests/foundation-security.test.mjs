import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PROFILE_FIELDS } from '../src/lib/profile-fields.ts';

const directory=new URL('../supabase/migrations/',import.meta.url);
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
test('final foundation: chronological replay, private authority and adversarial RLS',async t=>{
 const db=new PGlite();
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const as=async(id,role='authenticated')=>{
   await db.exec('RESET ROLE'); await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']); await db.exec(`SET ROLE ${role}`);
 };
 const denied=(sql,args=[])=>assert.rejects(q(sql,args),e=>e.code==='42501');
 try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text,bucket_id text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    CREATE PUBLICATION supabase_realtime;
  `);
  const files=(await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files){
    if(file.endsWith('_foundation_privacy_entitlements.sql')){
      await q('INSERT INTO auth.users(id) VALUES($1),($2)',[a,b]);
      await q("INSERT INTO profiles(id,full_name,public_slug,plan,date_of_birth) VALUES($1,'A','alice','pro','1990-01-01'),($2,'B','bob','free',NULL)",[a,b]);
      await q("INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name='create_professional_discussion'",[b]);
    }
    await db.exec(await readFile(new URL(file,directory),'utf8'));
  }
  await t.test('public URLs use safe projection; plan/date/internal and future columns denied',async()=>{
    await db.exec('ALTER TABLE profiles ADD COLUMN future_admin_flag boolean DEFAULT false');
    await as(null,'anon');
    assert.equal((await q(`SELECT ${PROFILE_FIELDS} FROM profiles WHERE public_slug='alice'`))[0].id,a);
    for(const column of ['date_of_birth','plan','onboarding_completed','future_admin_flag']){
      await denied(`SELECT ${column} FROM profiles`);
      await denied(`SELECT id FROM profiles WHERE ${column} IS NOT NULL`);
    }
    await as(a);
    for(const column of ['plan','onboarding_completed','date_of_birth','future_admin_flag']) await denied(`SELECT ${column} FROM profiles WHERE id=$1`,[a]);
    for(const sql of ["UPDATE profiles SET plan='pro'",'UPDATE profiles SET created_at=now()',
      'UPDATE profiles SET updated_at=now()','UPDATE profiles SET future_admin_flag=true']) await denied(sql);
    await q("UPDATE profiles SET full_name='Updated',public_slug='alice-new',city='Москва',country='Россия',gender='female',avatar_url='https://example.test/a.jpg',about='Bio',availability_status='busy',onboarding_completed=true WHERE id=$1",[a]);
    assert.equal((await q('SELECT full_name FROM profiles WHERE id=$1',[a]))[0].full_name,'Updated');
  });
  await t.test('permission privacy preserves founder-like grants and checked discussion RPC',async()=>{
    await as(null,'anon'); await denied('SELECT * FROM user_permissions');
    await as(a); assert.equal((await q('SELECT id FROM user_permissions WHERE user_id=$1',[b])).length,0);
    await denied("INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions LIMIT 1",[a]);
    await as(b); assert.equal((await q('SELECT id FROM user_permissions')).length,1);
    assert.equal((await q('SELECT can_create_department_chat($1) AS ok',[b]))[0].ok,true);
    await as(a); assert.equal((await q('SELECT can_create_department_chat($1) AS ok',[b]))[0].ok,false);
    const department=(await q('SELECT id FROM departments LIMIT 1'))[0].id;
    await denied('SELECT chat_create_group($1,$2,$3,$4)',['No permission',[b],department,crypto.randomUUID()]);
    await as(b); await q('SELECT chat_create_group($1,$2,$3,$4)',['Trusted',[a],department,crypto.randomUUID()]);
    await as(null,'service_role'); assert.equal((await q('SELECT * FROM user_permissions')).length,1);
  });
  await t.test('no legacy PRO backfill; only trusted server can grant/revoke entitlement',async()=>{
    await as(null,'service_role'); assert.equal((await q('SELECT * FROM account_entitlements')).length,0);
    await as(a);
    await denied("INSERT INTO account_entitlements(user_id,entitlement_code,source) VALUES($1,'pro','test')",[a]);
    await denied("INSERT INTO account_entitlements(user_id,entitlement_code,source,remaining_uses) VALUES($1,'resume_publication','test',1)",[a]);
    await denied("UPDATE account_entitlements SET status='active'");
    await denied('DELETE FROM account_entitlements'); await denied('TRUNCATE account_entitlements');
    await as(null,'service_role');
    await q("INSERT INTO account_entitlements(user_id,entitlement_code,source) VALUES($1,'pro','admin')",[a]);
    await q("INSERT INTO account_entitlements(user_id,entitlement_code,source,remaining_uses) VALUES($1,'resume_publication','test',1)",[a]);
    await as(a); assert.equal((await q('SELECT entitlement_code FROM account_entitlements')).length,2);
    await denied('SELECT source_reference FROM account_entitlements');
    await as(b); assert.equal((await q('SELECT entitlement_code FROM account_entitlements WHERE user_id=$1',[a])).length,0);
    await as(null,'anon'); await denied('SELECT entitlement_code FROM account_entitlements');
    await as(null,'service_role');
    await q("UPDATE account_entitlements SET status='revoked' WHERE entitlement_code='pro'");
    await q("UPDATE account_entitlements SET remaining_uses=0 WHERE entitlement_code='resume_publication'");
    await as(a); assert.equal((await q('SELECT entitlement_code FROM account_entitlements')).length,0);
  });
  await t.test('effective entitlement filters, timestamps and integrity constraints',async()=>{
    await as(null,'service_role');
    await q("INSERT INTO account_entitlements(user_id,entitlement_code,source,starts_at,expires_at) VALUES($1,'pro','test',now()-interval '2 days',now()-interval '1 day'),($1,'pro','test',now()+interval '1 day',NULL)",[a]);
    await assert.rejects(q("INSERT INTO account_entitlements(user_id,entitlement_code,source,remaining_uses) VALUES($1,'resume_publication','test',-1)",[a]),e=>e.code==='23514');
    await assert.rejects(q("INSERT INTO account_entitlements(user_id,entitlement_code,source) VALUES($1,'pro','subscription')",[a]),e=>e.code==='23514');
    await as(a); assert.equal((await q('SELECT entitlement_code FROM account_entitlements')).length,0);
  });
  await t.test('Pulse denies NULL/foreign owner; own succeeds; system event server-only',async()=>{
    await as(a);
    await denied("INSERT INTO pulse_feed(user_id,kind,person,action) VALUES(NULL,'join','A','joined')");
    await denied("INSERT INTO pulse_feed(user_id,kind,person,action) VALUES($1,'join','A','joined')",[b]);
    await q("INSERT INTO pulse_feed(user_id,kind,person,action) VALUES($1,'join','A','joined')",[a]);
    await as(null,'service_role'); await q("INSERT INTO pulse_feed(user_id,kind,person,action) VALUES(NULL,'join','System','notice')");
  });
  await t.test('messaging functions retained, fixed paths, precise execute and publication metadata',async()=>{
    await db.exec('RESET ROLE');
    const names=['chat_list','chat_unread_total','get_or_create_direct_chat','chat_create_group','chat_send','chat_mark_read','chat_manage_member','chat_rename','is_room_member','can_create_department_chat','bump_room_last_message'];
    const functions=await q("SELECT oid::regprocedure::text signature,proname,proconfig,prosrc,prosecdef FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY($1)",[names]);
    assert.equal(functions.length,names.length);
    for(const fn of functions){
      assert.ok(fn.proconfig?.includes('search_path=public'));
      const row=(await q("SELECT has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('authenticated',$1,'EXECUTE') u",[fn.signature]))[0];
      assert.equal(row.a,false); assert.equal(row.u,fn.proname!=='bump_room_last_message');
      if(fn.proname!=='bump_room_last_message') assert.match(fn.prosrc,/auth\.uid\(\)/);
    }
    assert.deepEqual((await q("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename")).map(r=>r.tablename),['chat_members','chat_messages','chat_rooms']);
  });
 } finally {await db.close();}
});
