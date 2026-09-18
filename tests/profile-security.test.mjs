import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PROFILE_FIELDS } from '../src/lib/profile-fields.ts';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const c = '00000000-0000-4000-8000-000000000003';

test('profile security: real PostgreSQL column grants plus owner RLS', async (t) => {
  const db = new PGlite();
  const sql = (query, args = []) => db.query(query, args);
  const as = async (id, role = 'authenticated') => {
    await db.exec('RESET ROLE');
    await sql("SELECT set_config('request.jwt.claim.sub', $1, false)", [id || '']);
    await db.exec(`SET ROLE ${role}`);
  };
  const denied = (query, args = []) => assert.rejects(sql(query, args), error => error.code === '42501');
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `);
    const files = await readdir(migrationDirectory);
    // Replay the actual profile, permission and chat foundations (not a mock table).
    for (const number of ['001', '002', '004', '006', '009', '010', '011']) {
      await db.exec(await readFile(new URL(files.find(f => f.includes(`_${number}_`)), migrationDirectory), 'utf8'));
    }
    await sql('INSERT INTO auth.users VALUES ($1),($2),($3)', [a,b,c]);
    await sql("INSERT INTO profiles(id,full_name,date_of_birth,plan) VALUES ($1,'A','1990-01-02','pro'),($2,'B','1991-02-03','free')", [a,b]);
    // Explicit pre-existing column grants must not survive the correction.
    await db.exec('GRANT SELECT(date_of_birth), UPDATE(plan), INSERT(plan) ON profiles TO PUBLIC, anon, authenticated');
    const correction = await readFile(new URL(files.find(f => f.endsWith('_profile_column_security.sql')), migrationDirectory), 'utf8');
    await db.exec(correction);
    await db.exec(correction); // Defensive replay is safe and non-destructive.

    await t.test('guest can browse safe fields but cannot read/filter/order private date', async () => {
      await as(null, 'anon');
      assert.equal((await sql(`SELECT ${PROFILE_FIELDS} FROM profiles`)).rows.length, 2);
      await denied('SELECT date_of_birth FROM profiles');
      await denied('SELECT plan FROM profiles');
      await denied('SELECT onboarding_completed FROM profiles');
      await denied('SELECT * FROM profiles');
      await denied("SELECT id FROM profiles WHERE date_of_birth = '1990-01-02'");
      await denied('SELECT id FROM profiles ORDER BY date_of_birth');
      await denied("UPDATE profiles SET full_name = 'guest'");
    });
    await t.test('owner can edit safe fields, not plan/id/timestamps/private date', async () => {
      await as(a);
      assert.equal((await sql("UPDATE profiles SET full_name='Edited' WHERE id=$1 RETURNING id", [a])).rows.length, 1);
      await denied("UPDATE profiles SET plan='pro' WHERE id=$1", [a]);
      await denied('UPDATE profiles SET id=$1 WHERE id=$2', [c,a]);
      await denied("UPDATE profiles SET created_at=now() WHERE id=$1", [a]);
      await denied('SELECT date_of_birth FROM profiles WHERE id=$1', [a]);
      await denied("UPDATE profiles SET date_of_birth='2000-01-01' WHERE id=$1", [a]);
      assert.equal((await sql("UPDATE profiles SET full_name='Hacked' WHERE id=$1 RETURNING id", [b])).rows.length, 0);
      await denied('DELETE FROM profiles WHERE id=$1', [a]);
      await denied('TRUNCATE profiles');
    });
    await t.test('bootstrap works; forged PRO insert/upsert and foreign owner are denied', async () => {
      await as(c);
      await denied("INSERT INTO profiles(id,plan) VALUES ($1,'pro')", [c]);
      await denied("INSERT INTO profiles(id,full_name) VALUES ($1,'Forged')", [a]);
      const created = await sql(`INSERT INTO profiles(id,full_name,public_slug,onboarding_completed) VALUES ($1,'C','c',false) RETURNING ${PROFILE_FIELDS}`, [c]);
      assert.equal(created.rows[0].id, c);
      assert.equal(created.rows[0].plan, undefined);
      await denied("INSERT INTO profiles(id,plan) VALUES ($1,'pro') ON CONFLICT(id) DO UPDATE SET plan=excluded.plan", [c]);
      await denied("UPDATE profiles SET full_name='C' WHERE id=$1 RETURNING *", [c]);
    });
    await t.test('trusted server retains stored data; legacy PRO grants no discussion permission', async () => {
      await as(a);
      assert.equal((await sql('SELECT can_create_department_chat($1) AS allowed', [a])).rows[0].allowed, false);
      await as(null, 'service_role');
      assert.equal((await sql('SELECT date_of_birth::text FROM profiles WHERE id=$1', [a])).rows[0].date_of_birth, '1990-01-02');
      assert.equal((await sql('SELECT plan FROM profiles WHERE id=$1', [a])).rows[0].plan, 'pro');
      await sql("UPDATE profiles SET plan='pro' WHERE id=$1", [c]);
    });
    await t.test('only an explicit trusted grant enables discussions and cannot be forged', async () => {
      await as(null, 'service_role');
      await sql("INSERT INTO permissions(name) VALUES ('create_professional_discussion') ON CONFLICT DO NOTHING");
      await sql("INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name='create_professional_discussion'", [b]);
      await as(b);
      assert.equal((await sql('SELECT can_create_department_chat($1) AS allowed', [b])).rows[0].allowed, true);
      await as(a);
      assert.equal((await sql('SELECT can_create_department_chat($1) AS allowed', [b])).rows[0].allowed, false);
      await denied("INSERT INTO user_permissions(user_id,permission_id) SELECT $1,id FROM permissions WHERE name='create_professional_discussion'", [a]);
      await as(null, 'service_role');
      await sql('DELETE FROM user_permissions WHERE user_id=$1', [b]);
      await as(b);
      assert.equal((await sql('SELECT can_create_department_chat($1) AS allowed', [b])).rows[0].allowed, false);
    });
  } finally { await db.close(); }
});

test('browser profile projection excludes private date and wildcard reads', async () => {
  assert.ok(!PROFILE_FIELDS.includes('date_of_birth'));
  assert.ok(!PROFILE_FIELDS.includes('plan'));
  assert.ok(!PROFILE_FIELDS.includes('onboarding_completed'));
  for (const file of ['src/hooks/useAuth.tsx', 'src/pages/ProfilePage.tsx']) {
    const source = await readFile(file, 'utf8');
    assert.ok(source.includes('.select(PROFILE_FIELDS)') || source.includes(".rpc('person_public'"));
    assert.doesNotMatch(source, /from\('profiles'\)\s*\.select\(['"]\*['"]\)/);
  }
});
