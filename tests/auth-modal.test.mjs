import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: ['src/components/AuthModal.tsx'], bundle: true, write: false, format: 'cjs',
  platform: 'node', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'lucide-react'],
  plugins: [{ name: 'fake-session-boundary', setup(build) {
    build.onResolve({ filter: /hooks\/useAuth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    build.onResolve({ filter: /\.\.\/router$/ }, () => ({ path: 'router', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'auth'
      ? 'export const useAuth = () => globalThis.fixture.auth;'
      : 'export const useRouter = () => globalThis.fixture.router;' }));
  } }],
});
test('signup notice offers sign in, reset and browse; never asserts account creation or sent email', async () => {
  const fixture = {
    auth: { isAuthenticated: false, supabaseReady: true, signIn: async () => ({ error: null }),
      signUp: async () => ({ outcome: 'CHECK_EMAIL', error: null }) },
    router: { navigate(path) { fixture.path = path; } }, modal: null,
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, require, fixture, console,
    document: { activeElement: null, addEventListener() {}, removeEventListener() {} },
    HTMLElement: class {}, setTimeout, clearTimeout,
  });
  const { AuthModalProvider, useAuthModal } = module.exports;
  function Probe() { fixture.modal = useAuthModal(); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(AuthModalProvider, null, React.createElement(Probe))); });
  const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
  const button = label => renderer.root.findAllByType('button').find(b => text(b) === label);
  const register = async () => {
    await act(async () => fixture.modal.openRegister());
    const inputs = renderer.root.findAllByType('input');
    await act(async () => {
      for (const input of inputs) input.props.onChange({ target: { value: input.props.type === 'text' ? 'Fixture' :
        input.props.type === 'email' ? 'fixture@example.test' : 'test-password' } });
    });
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  };
  try {
    await register();
    let content = JSON.stringify(renderer.toJSON());
    assert.match(content, /Если это новый адрес/);
    assert.match(content, /Если у вас уже есть аккаунт FilmVerse/);
    assert.doesNotMatch(content, /Мы отправили|аккаунт создан|активировать аккаунт/);
    for (const label of ['Войти', 'Забыли пароль?', 'Продолжить просмотр']) assert.ok(button(label), label);
    await act(async () => button('Войти').props.onClick());
    assert.equal(renderer.root.findAllByType('input').find(i => i.props.type === 'password').props.value, '');
    assert.ok(renderer.root.findByType('form'));
    await register();
    await act(async () => button('Забыли пароль?').props.onClick());
    assert.equal(fixture.path, '/forgot-password');
    assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
    await register();
    await act(async () => button('Продолжить просмотр').props.onClick());
    assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
  } finally { act(() => renderer.unmount()); }
});
