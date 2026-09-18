import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const directory = new URL('../supabase/migrations/', import.meta.url);
const ids = [1,2,3,4].map(n => `00000000-0000-4000-8000-00000000000${n}`);
const [a,b,c,d] = ids;
const bootstrap = `
 CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
 CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text,bucket_id text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 CREATE PUBLICATION supabase_realtime;
`;

test('full migration replay and messaging convergence: A/B/C/D authorization', async t => {
 const db = new PGlite();
 const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
 const scalar = async (sql,args=[]) => Object.values((await q(sql,args))[0])[0];
 const as = async (id,role='authenticated') => {
   await db.exec('RESET ROLE');
   await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);
   await db.exec(`SET ROLE ${role}`);
 };
 const denied = (sql,args=[]) => assert.rejects(q(sql,args),e=>e.code==='42501');
 try {
  await db.exec(bootstrap);
  const files = (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  const name = files.find(f=>f.endsWith('_messaging_schema_convergence.sql'));
  for (const file of files) await db.exec(await readFile(new URL(file,directory),'utf8'));
  for (const [i,id] of ids.entries()) {
    await q('INSERT INTO auth.users VALUES($1)',[id]);
    await q('INSERT INTO profiles(id,full_name) VALUES($1,$2)',[id,['Alice','Bob','Carol','Dan'][i]]);
  }
  await as(a);
  const room = await scalar('SELECT get_or_create_direct_chat($1)',[b]);
  const mid = crypto.randomUUID();
  await q('SELECT chat_send($1,$2,$3)',[room,'before migration',mid]);
  await as(b);
  await q('SELECT chat_mark_read($1,$2)',[room,mid]);
  await as(null,'service_role');
  const before = await q('SELECT id,seq,body FROM chat_messages ORDER BY seq');
  const readBefore = await q('SELECT user_id,last_read_seq,last_read_at FROM chat_members ORDER BY user_id');
  const old = await scalar('INSERT INTO conversations(participant_a,participant_b) VALUES($1,$2) RETURNING id',[a,b]);
  await q('INSERT INTO messages(conversation_id,sender_id,receiver_id,body) VALUES($1,$2,$3,$4)',[old,a,b,'legacy history']);
  await db.exec('RESET ROLE');
  // Simulate permissive policies and column grants left by a divergent environment.
  await db.exec('CREATE POLICY accidental_read ON chat_messages FOR SELECT TO authenticated USING(true)');
  await db.exec('GRANT INSERT(body), UPDATE(body) ON messages TO authenticated');
  const correction = await readFile(new URL(name,directory),'utf8');
  await db.exec(correction);
  await db.exec(correction);

  await t.test('history/read cursors retained; old system writes blocked, reads retained',async()=>{
    assert.deepEqual(await q('SELECT id,seq,body FROM chat_messages ORDER BY seq'),before);
    assert.deepEqual(await q('SELECT user_id,last_read_seq,last_read_at FROM chat_members ORDER BY user_id'),readBefore);
    await as(a);
    assert.equal(await scalar('SELECT count(*)::int FROM messages'),1);
    await denied('INSERT INTO conversations(participant_a,participant_b) VALUES($1,$2)',[a,c]);
    await denied('INSERT INTO messages(conversation_id,sender_id,receiver_id,body) VALUES($1,$2,$3,$4)',[old,a,b,'forbidden']);
    await denied("UPDATE messages SET body='forbidden'");
    await denied('INSERT INTO chat_messages(room_id,sender_id,body) VALUES($1,$2,$3)',[room,a,'bypass RPC']);
    await denied("UPDATE chat_rooms SET title='bypass RPC' WHERE id=$1",[room]);
    await denied('TRUNCATE chat_messages');
  });
  await t.test('unique direct pair, unread/read/search; read cursor cannot move backwards',async()=>{
    assert.equal(await scalar('SELECT get_or_create_direct_chat($1)',[b]),room);
    const fresh = crypto.randomUUID();
    await q('SELECT chat_send($1,$2,$3)',[room,'after migration',fresh]);
    await q('SELECT chat_send($1,$2,$3)',[room,'after migration',fresh]);
    assert.equal(await scalar('SELECT count(*)::int FROM chat_messages'),2);
    await as(b);
    assert.equal(await scalar('SELECT get_or_create_direct_chat($1)',[a]),room);
    assert.equal(Number(await scalar('SELECT chat_unread_total()')),1);
    const listed = await q("SELECT * FROM chat_list('Alice',0)");
    assert.equal(listed.length,1); assert.equal(listed[0].last_message_text,'after migration');
    assert.equal(Number(listed[0].unread),1);
    assert.equal((await q("SELECT * FROM chat_list('missing',0)")).length,0);
    await q('SELECT chat_mark_read($1,$2)',[room,fresh]);
    await q('SELECT chat_mark_read($1,$2)',[room,mid]);
    assert.equal(Number(await scalar('SELECT chat_unread_total()')),0);
  });
  await t.test('unrelated user cannot read/join/send/rename/invoke membership for another user',async()=>{
    await as(d);
    assert.equal((await q('SELECT * FROM chat_list()')).length,0);
    assert.equal(await scalar('SELECT count(*)::int FROM chat_messages'),0);
    assert.equal(await scalar('SELECT is_room_member($1,$2)',[room,a]),false);
    await denied('INSERT INTO chat_members(room_id,user_id) VALUES($1,$2)',[room,d]);
    await denied('SELECT chat_send($1,$2,$3)',[room,'intrusion',crypto.randomUUID()]);
    await denied('SELECT chat_manage_member($1,$2,$3)',[room,d,'member']);
    await denied('SELECT chat_rename($1,$2)',[room,'intrusion']);
    await denied('SELECT chat_mark_read($1,$2)',[room,mid]);
    await denied('CREATE TABLE public.attacker(id int)');
  });
  await t.test('group atomicity, member leave/revocation and owner transfer',async()=>{
    await as(a);
    const missing=crypto.randomUUID(),failed=crypto.randomUUID();
    await assert.rejects(q('SELECT chat_create_group($1,$2,NULL,$3)',['bad',[missing],failed]),e=>e.code==='23503');
    assert.equal(await scalar('SELECT count(*)::int FROM chat_rooms WHERE id=$1',[failed]),0);
    const group=await scalar('SELECT chat_create_group($1,$2,NULL,$3)',['Crew',[b,c],crypto.randomUUID()]);
    await as(c);
    await q('SELECT chat_send($1,$2,$3)',[group,'hello crew',crypto.randomUUID()]);
    await denied('SELECT chat_manage_member($1,$2,$3)',[group,d,'member']);
    await denied('SELECT chat_rename($1,$2)',[group,'not owner']);
    await as(a);
    await q('SELECT chat_manage_member($1,$2,$3)',[group,c,'remove']);
    await as(c);
    assert.equal(await scalar('SELECT count(*)::int FROM chat_messages WHERE room_id=$1',[group]),0);
    await denied('SELECT chat_send($1,$2,$3)',[group,'removed',crypto.randomUUID()]);
    // Own tombstone remains readable for realtime removal handling.
    assert.equal((await q('SELECT left_at FROM chat_members WHERE room_id=$1',[group])).length,1);
    await as(a);
    await q('SELECT chat_manage_member($1,$2,$3)',[group,a,'leave']);
    await as(b);
    await q('SELECT chat_rename($1,$2)',[group,'New owner']);
    assert.equal(await scalar('SELECT title FROM chat_rooms WHERE id=$1',[group]),'New owner');
  });
  await t.test('function privileges and realtime registration are explicit',async()=>{
    await as(null,'anon');
    await denied('SELECT * FROM chat_list()');
    await denied('SELECT chat_unread_total()');
    await denied('SELECT get_or_create_direct_chat($1)',[a]);
    await db.exec('RESET ROLE');
    assert.deepEqual((await q("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename")).map(r=>r.tablename),['chat_members','chat_messages','chat_rooms']);
    const f=await q("SELECT proname,prosecdef,proconfig FROM pg_proc WHERE proname IN ('chat_list','chat_unread_total')");
    assert.equal(f.length,2);
    for(const row of f){assert.equal(row.prosecdef,false);assert.ok(row.proconfig.includes('search_path=public'));}
    assert.equal(await scalar("SELECT has_function_privilege('authenticated','public.bump_room_last_message()','EXECUTE')"),false);
  });
  await t.test('missing realtime publication fails atomically without deleting message history',async()=>{
    await db.exec('DROP PUBLICATION supabase_realtime');
    const snapshot=await q('SELECT id,seq,body FROM chat_messages ORDER BY seq');
    await assert.rejects(db.exec(correction),/publication missing/);
    await db.exec('ROLLBACK');
    assert.deepEqual(await q('SELECT id,seq,body FROM chat_messages ORDER BY seq'),snapshot);
    await db.exec('CREATE PUBLICATION supabase_realtime');
  });
  await t.test('ambiguous direct membership stops migration without choosing or deleting data',async()=>{
    await q("INSERT INTO chat_members(room_id,user_id) VALUES($1,$2)",[room,d]);
    const snapshot=await q('SELECT id,seq,body FROM chat_messages ORDER BY seq');
    await assert.rejects(db.exec(correction),/membership inconsistent/);
    await db.exec('ROLLBACK');
    assert.equal(await scalar('SELECT count(*)::int FROM chat_members WHERE room_id=$1',[room]),3);
    assert.deepEqual(await q('SELECT id,seq,body FROM chat_messages ORDER BY seq'),snapshot);
  });
 } finally { await db.close(); }
});
