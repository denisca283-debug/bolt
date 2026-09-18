import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><html><body><div id="root"><button id="trigger">Open</button></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const bundle = await build({
  entryPoints: ['src/components/ModalShell.tsx'], bundle: true, write: false, format: 'cjs',
  platform: 'node', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom', 'lucide-react'],
});
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require,
  document, HTMLElement, Node: dom.window.Node, console });
const { ModalShell } = module.exports;
test('modal locks background, traps focus, closes with Escape/overlay/X and restores focus', async () => {
  const mountPoint = document.createElement('div');
  document.body.append(mountPoint);
  const root = createRoot(mountPoint);
  const trigger = document.getElementById('trigger');
  trigger.focus();
  let closes = 0;
  await act(async () => root.render(React.createElement(ModalShell,
    { title: 'Long form', onClose: () => closes++ }, React.createElement('input', { id: 'inside' }))));
  try {
    const dialog = document.querySelector('[role="dialog"]');
    assert.equal(document.activeElement, dialog);
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(document.getElementById('root').inert, true);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent, 'Long form');
    assert.ok(dialog.className.includes('100dvh'));
    assert.ok(dialog.querySelector('header'));
    assert.ok(dialog.querySelector('.overflow-y-auto'));
    trigger.focus();
    assert.equal(document.activeElement, dialog);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(closes, 1);
    await act(async () => dialog.querySelector('button').click());
    assert.equal(closes, 2);
    await act(async () => dialog.querySelector('input').click());
    assert.equal(closes, 2);
    await act(async () => dialog.parentElement.click());
    assert.equal(closes, 3);
  } finally {
    await act(async () => root.unmount());
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.getElementById('root').inert, false);
    assert.equal(document.activeElement, trigger);
    mountPoint.remove();
  }
});
