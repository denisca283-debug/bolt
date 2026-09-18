import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: ['src/hooks/useAuth.tsx'], bundle: true, write: false,
  format: 'cjs', platform: 'node', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  plugins: [{ name: 'fake-auth-only', setup(build) {
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'fake', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
      contents: 'export const isSupabaseConfigured = true; export const supabase = globalThis.fixture.client;',
    }));
  } }],
});
const validSession = () => ({
  user: { id: 'account-a', email: 'fixture@example.test', user_metadata: { full_name: 'Fixture' } },
  access_token: 'test-access-token', refresh_token: 'test-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});
async function mount(options = {}) {
  const fixture = {
    session: options.session ?? null, profile: options.profile ?? { id: 'account-a', full_name: 'Fixture' },
    profileError: options.profileError ?? null, writes: 0, callback: null, value: null,
    userError: options.userError ?? null,
  };
  fixture.client = {
    auth: {
      getSession: async () => options.hydration ? options.hydration : { data: { session: fixture.session }, error: null },
      getUser: async () => ({ data: { user: fixture.userError ? null : fixture.session?.user }, error: fixture.userError }),
      onAuthStateChange: (callback) => {
        fixture.callback = callback;
        queueMicrotask(() => callback('INITIAL_SESSION', fixture.session));
        return { data: { subscription: { unsubscribe() { fixture.callback = null; } } } };
      },
      signUp: async () => ({ data: { user: { id: options.fake ? 'obfuscated' : 'new' }, session: null }, error: null }),
      signInWithPassword: async () => {
        fixture.session = validSession();
        fixture.callback('SIGNED_IN', fixture.session);
        return { data: { session: fixture.session }, error: null };
      },
      signOut: async () => {
        if (options.logoutError) return { error: new Error('offline') };
        fixture.session = null; fixture.callback('SIGNED_OUT', null); return { error: null };
      },
      resetPasswordForEmail: async (_email, config) => {
        fixture.resetRedirect = config.redirectTo;
        return { error: null };
      },
      updateUser: async () => ({ error: options.updateError ?? null }),
    },
    from: (table) => {
      assert.equal(table, 'profiles'); // No auth.users, no email existence lookup.
      return {
        select: () => ({ eq: (_key, id) => {
          assert.equal(id, 'account-a');
          return { maybeSingle: async () => ({ data: fixture.profileError ? null : fixture.profile, error: fixture.profileError }) };
        } }),
        insert: async (row) => { fixture.writes++; fixture.profile = row; return { error: null }; },
      };
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, require, fixture, console,
    window: { setTimeout, clearTimeout, location: { origin: 'https://filmverse.example', hash: '' } }, setTimeout, clearTimeout,
  });
  const { AuthProvider, useAuth } = module.exports;
  function Probe() { fixture.value = useAuth(); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  fixture.close = () => act(() => renderer.unmount());
  fixture.emit = (event, next) => act(async () => { fixture.session = next; fixture.callback(event, next); });
  return fixture;
}
test('provider: new and existing email both remain guests; confirmed login authenticates', async () => {
  for (const fake of [false, true]) {
    const f = await mount({ fake });
    try {
      let result;
      await act(async () => { result = await f.value.signUp('Fixture', 'fixture@example.test', 'password'); });
      assert.equal(result.outcome, 'CHECK_EMAIL');
      assert.equal(f.value.isAuthenticated, false);
      assert.equal(f.value.user, null);
      assert.equal(f.writes, 0);
      await act(async () => { await f.value.signIn('fixture@example.test', 'password'); });
      assert.equal(f.value.isAuthenticated, true);
      assert.equal(f.value.profileStatus, 'FOUND');
    } finally { f.close(); }
  }
});
test('provider: valid stored session survives hydration', async () => {
  const f = await mount({ session: validSession() });
  try { assert.equal(f.value.authLoading, false); assert.equal(f.value.isAuthenticated, true); }
  finally { f.close(); }
});
test('provider: recovery uses auth event and root redirect; failed update remains recoverable', async () => {
  const f = await mount({ updateError: new Error('offline') });
  try {
    await act(async () => { await f.value.resetPassword('fixture@example.test'); });
    assert.equal(f.resetRedirect, 'https://filmverse.example');
    await f.emit('PASSWORD_RECOVERY', validSession());
    assert.equal(f.value.passwordRecoveryActive, true);
    await act(async () => { await f.value.updatePassword('long-password'); });
    assert.equal(f.value.passwordRecoveryActive, true);
    await f.emit('SIGNED_OUT', null);
    assert.equal(f.value.passwordRecoveryActive, false);
  } finally { f.close(); }
});
test('provider: token refresh from another tab uses the new real session', async () => {
  const f = await mount({ session: validSession() });
  try {
    const refreshed = { ...validSession(), access_token: 'refreshed-token' };
    await f.emit('TOKEN_REFRESHED', refreshed);
    assert.equal(f.value.session.access_token, 'refreshed-token');
    assert.equal(f.value.isAuthenticated, true);
    await f.emit('SIGNED_OUT', null);
    assert.equal(f.value.isAuthenticated, false);
  } finally { f.close(); }
});
test('provider: invalid or expired stored sessions are guests', async () => {
  for (const options of [
    { session: validSession(), userError: new Error('invalid JWT') },
    { session: { ...validSession(), expires_at: 1 } },
  ]) {
    const f = await mount(options);
    try { assert.equal(f.value.isAuthenticated, false); assert.equal(f.value.user, null); assert.equal(f.writes, 0); }
    finally { f.close(); }
  }
});
test('provider: profile RLS error preserves auth and does not insert; retry recovers', async () => {
  const f = await mount({ session: validSession(), profileError: { code: '42501' } });
  try {
    assert.equal(f.value.isAuthenticated, true);
    assert.equal(f.value.profileStatus, 'ERROR');
    assert.ok(f.value.profileError);
    assert.equal(f.writes, 0);
    f.profileError = null;
    await act(async () => { await f.value.refreshProfile(); });
    assert.equal(f.value.profileStatus, 'FOUND');
    assert.equal(f.value.profileError, null);
  } finally { f.close(); }
});
test('provider: explicit logout and cross-tab SIGNED_OUT clear all authenticated state', async () => {
  for (const crossTab of [false, true]) {
    const f = await mount({ session: validSession() });
    try {
      if (crossTab) await f.emit('SIGNED_OUT', null);
      else await act(async () => { await f.value.signOut(); });
      assert.equal(f.value.isAuthenticated, false);
      assert.equal(f.value.session, null);
      assert.equal(f.value.user, null);
      assert.equal(f.value.profile, null);
    } finally { f.close(); }
  }
});
test('provider: logout failure is visible, not fake successful logout', async () => {
  const f = await mount({ session: validSession(), logoutError: true });
  try {
    await act(async () => { await f.value.signOut(); });
    assert.equal(f.value.isAuthenticated, true);
    assert.ok(f.value.authError);
  } finally { f.close(); }
});
test('provider: a stale hydration response cannot undo logout', async () => {
  let finish;
  const hydration = new Promise(resolve => { finish = resolve; });
  const original = validSession();
  const f = await mount({ session: original, hydration });
  try {
    await f.emit('SIGNED_OUT', null);
    await act(async () => { finish({ data: { session: original }, error: null }); });
    assert.equal(f.value.isAuthenticated, false);
    assert.equal(f.value.user, null);
  } finally { f.close(); }
});
