import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySignup, classifyProfile, ensureProfile, liveSession } from '../src/lib/auth-state.ts';

const session = () => ({ user: { id: 'account-a' }, access_token: 'token', expires_at: Date.now() / 1000 + 3600 });

test('new email and obfuscated existing user produce identical private-safe results', () => {
  for (const user of [{ id: 'new' }, { id: 'fake', identities: [] }, null]) {
    assert.equal(classifySignup({ user, session: null }, null), 'CHECK_EMAIL');
  }
});
test('duplicate errors also preserve privacy; unrelated errors remain errors', () => {
  for (const error of [
    { code: 'user_already_exists', message: 'hidden' },
    { code: 'email_exists', message: 'hidden' },
    { message: 'User already registered' },
  ]) assert.equal(classifySignup({ session: null }, error), 'CHECK_EMAIL');
  for (const message of ['Failed to fetch', 'rate limit', 'Password too short']) {
    assert.equal(classifySignup({ session: null }, { message }), 'ERROR');
  }
});
test('only a live session, not a user object, authenticates signup', () => {
  assert.equal(classifySignup({ session: session() }, null), 'AUTHENTICATED');
  assert.equal(classifySignup({ session: { ...session(), expires_at: 1 } }, null), 'CHECK_EMAIL');
});
test('session lifecycle: hydration, expiry, signout, cross-tab null, re-login', () => {
  const valid = session();
  assert.equal(liveSession(valid), valid);
  assert.deepEqual(liveSession(JSON.parse(JSON.stringify(valid))), valid);
  assert.equal(liveSession(valid, valid.expires_at * 1000), null);
  assert.equal(liveSession(null), null);
  assert.equal(liveSession({ ...valid, access_token: '' }), null);
  assert.equal(liveSession(session())?.user.id, 'account-a');
});
test('profile FOUND, NOT_FOUND and ERROR are distinct; error wins over data', () => {
  assert.deepEqual(classifyProfile({ id: 'a' }, null), { status: 'FOUND', profile: { id: 'a' } });
  assert.deepEqual(classifyProfile(null, null), { status: 'NOT_FOUND' });
  assert.equal(classifyProfile(null, { code: '42501' }).status, 'ERROR');
  assert.equal(classifyProfile({ id: 'a' }, new Error()).status, 'ERROR');
});
test('network, RLS and duplicate-row read errors NEVER insert or change auth', async () => {
  for (const error of [{ code: '42501' }, { code: 'PGRST116' }, new Error('network')]) {
    let writes = 0;
    const valid = session();
    const result = await ensureProfile(
      async () => classifyProfile(null, error),
      async () => { writes++; return { error: null }; },
      () => true,
    );
    assert.equal(result.status, 'ERROR');
    assert.equal(writes, 0);
    assert.equal(liveSession(valid), valid);
  }
});
test('thrown read failure never inserts', async () => {
  let writes = 0;
  const result = await ensureProfile(async () => { throw Error('offline'); },
    async () => { writes++; return { error: null }; }, () => true);
  assert.equal(result.status, 'ERROR');
  assert.equal(writes, 0);
});
test('missing profile creates once and reads persisted row back', async () => {
  let row = null;
  let writes = 0;
  const read = async () => classifyProfile(row, null);
  const insert = async () => { writes++; row = { id: 'a' }; return { error: null }; };
  assert.equal((await ensureProfile(read, insert, () => true)).status, 'FOUND');
  assert.equal((await ensureProfile(read, insert, () => true)).status, 'FOUND');
  assert.equal(writes, 1);
});
test('concurrent profile creation recovers only from unique conflict', async () => {
  let reads = 0;
  const result = await ensureProfile(async () => ++reads === 1 ? { status: 'NOT_FOUND' } :
    { status: 'FOUND', profile: { id: 'a' } }, async () => ({ error: { code: '23505' } }), () => true);
  assert.equal(result.status, 'FOUND');
  assert.equal(reads, 2);
});
test('insert denied remains visible error; it is not hidden by another read', async () => {
  let reads = 0;
  const result = await ensureProfile(async () => { reads++; return { status: 'NOT_FOUND' }; },
    async () => ({ error: { code: '42501' } }), () => true);
  assert.equal(result.status, 'ERROR');
  assert.equal(reads, 1);
});
test('logout/account switch while loading prevents profile creation', async () => {
  let writes = 0;
  await ensureProfile(async () => ({ status: 'NOT_FOUND' }),
    async () => { writes++; return { error: null }; }, () => false);
  assert.equal(writes, 0);
});
test('unreadable row after insert is not success', async () => {
  assert.equal((await ensureProfile(async () => ({ status: 'NOT_FOUND' }),
    async () => ({ error: null }), () => true)).status, 'ERROR');
});
