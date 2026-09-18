// Local-only manual QA. Not an app entrypoint, never a fallback backend.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';

if (import.meta.env.VITE_SUPABASE_URL !== 'https://filmverse-test.supabase.co') {
  throw new Error('QA harness requires isolated fixture Supabase URL');
}
const scenario = new URLSearchParams(location.search).get('scenario') || 'guest';
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', user_metadata: { full_name: 'Test Actor' }, app_metadata: { provider: 'email' }, created_at: '2026-01-01T00:00:00Z' };
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = [JSON.stringify({ alg: 'HS256', typ: 'JWT' }), JSON.stringify({ sub: user.id, exp, aud: 'authenticated', role: 'authenticated' }), 'fixture'].map(v => btoa(v).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')).join('.');
const session = { access_token: token, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
const key = 'sb-filmverse-test-auth-token';
localStorage.removeItem(key);
if (!['guest', 'recovery'].includes(scenario)) localStorage.setItem(key, JSON.stringify(session));
if (scenario === 'recovery') location.hash = `access_token=${token}&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery`;
let offline = scenario === 'network';
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.origin === location.origin) return fetchOriginal(input, options);
  if (url.hostname !== 'filmverse-test.supabase.co') throw new TypeError('External requests disabled in QA');
  if (url.pathname === '/auth/v1/user') {
    if (offline) throw new TypeError('Failed to fetch');
    if (scenario === 'invalid') return Response.json({ code: 'bad_jwt', message: 'invalid' }, { status: 401 });
    return Response.json(user);
  }
  if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
  if (url.pathname === '/auth/v1/token') return Response.json(session);
  if (url.pathname === '/rest/v1/profiles') {
    if (scenario === 'profile-error') return Response.json({ code: 'XX000', message: 'fixture error' }, { status: 500 });
    return Response.json({ id: user.id, full_name: 'Test Actor', public_slug: 'test-actor', city: 'Москва', availability_status: 'available' });
  }
  if (url.pathname.includes('/rpc/')) return Response.json(false);
  return Response.json([]);
};
const { default: App } = await import('../src/App');
createRoot(document.getElementById('root')!).render(<>
  {scenario === 'network' && <button style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 100 }}
    onClick={() => { offline = false; window.dispatchEvent(new Event('online')); }}>QA: восстановить соединение</button>}
  <App />
</>);
