import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const bundle = await build({
  entryPoints: ['src/hooks/useDiscussionPermission.ts'], bundle: true, write: false,
  format: 'cjs', platform: 'node', external: ['react'],
  plugins: [{ name: 'rpc-fixture', setup(build) {
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'fake', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const supabase = globalThis.client;' }));
  } }],
});

test('discussion permission: strict allow, errors fail closed, logout/account switch cancels stale permission', async () => {
  const pending = [];
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, require: createRequire(import.meta.url),
    client: { rpc: (name, args) => {
      assert.equal(name, 'can_create_department_chat');
      return new Promise((resolve, reject) => pending.push({ id: args.p_user, resolve, reject }));
    } },
  });
  let value, renderer;
  function Probe({ id }) { value = module.exports.useDiscussionPermission(id); return null; }
  const mount = async id => act(async () => { renderer = create(React.createElement(Probe, { id })); });
  const update = async id => act(async () => { renderer.update(React.createElement(Probe, { id })); });
  await mount('a');
  try {
    assert.equal(value.allowed, false);
    await update('b');
    await act(async () => pending.shift().resolve({ data: true, error: null }));
    assert.equal(value.allowed, false, 'A response must not enable B');
    await act(async () => pending.shift().resolve({ data: true, error: null }));
    assert.equal(value.allowed, true);
    await update(undefined);
    assert.equal(value.allowed, false);
    await update('c');
    await act(async () => pending.shift().resolve({ data: true, error: { message: 'RLS' } }));
    assert.equal(value.allowed, false);
    assert.match(value.reason, /Не удалось/);
    await update('d');
    await act(async () => pending.shift().reject(new Error('offline')));
    assert.equal(value.allowed, false);
    assert.match(value.reason, /Не удалось/);
    await update('e');
    await act(async () => pending.shift().resolve({ data: 'true', error: null }));
    assert.equal(value.allowed, false);
  } finally { act(() => renderer.unmount()); }
});
