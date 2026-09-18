import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const result = await build({
  entryPoints: ['src/components/create/PublishMenu.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'lucide-react'],
  plugins: [{ name: 'boundaries', setup(build) {
    build.onResolve({ filter: /useAuth$|AuthModal$|router$|ModalShell$|CreateDialog$/ }, args => ({path:args.path,namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'}, ({path}) => ({contents:
      path.endsWith('useAuth') ? 'export const useAuth=()=>({user:{id:"test"}});' :
      path.endsWith('AuthModal') ? 'export const useAuthModal=()=>({promptGuest(){}});' :
      path.endsWith('router') ? 'export const useRouter=()=>({navigate(){}});' :
      path.endsWith('ModalShell') ? 'export const ModalShell=({children})=>children;' :
      'export const CreateDialog=(props)=>{globalThis.fixture.dialog=props;return null;};'
    }));
  }}],
});
test('global publish offers vacancy/resume only and vacancy cannot switch to project or marketplace', async () => {
  const fixture = {};
  const module = {exports:{}};
  vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,require,fixture,console});
  let renderer;
  await act(async()=>{renderer=create(React.createElement(module.exports.PublishMenu,{onCreated(){}}));});
  const text = n => typeof n==='string'?n:(n.children||[]).map(text).join('');
  const button = name => renderer.root.findAllByType('button').find(n=>text(n).includes(name));
  try {
    await act(async()=>button('Разместить').props.onClick());
    assert.ok(button('Вакансию')); assert.ok(button('Резюме'));
    assert.equal(button('Проект'),undefined);
    await act(async()=>button('Вакансию').props.onClick());
    assert.equal(fixture.dialog.initialKind,'work');
    assert.equal(fixture.dialog.allowKindSwitch,false);
  } finally {act(()=>renderer.unmount());}
});
