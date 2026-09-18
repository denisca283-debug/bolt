import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicSupabaseConfig as validate } from '../src/lib/deployment-config.ts';

const jwt = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
test('deployment rejects missing, malformed and privileged credentials', () => {
  for (const [url, key] of [
    [undefined, undefined], ['https://project.supabase.co', ''],
    ['not a URL', jwt('anon')], ['http://project.supabase.co', jwt('anon')],
    ['https://user:password@project.supabase.co', jwt('anon')],
    ['https://project.supabase.co/path', jwt('anon')],
    ['https://project.supabase.co', 'sb_secret_private'],
    ['https://project.supabase.co', jwt('service_role')],
    ['https://project.supabase.co', 'invalid'],
  ]) assert.ok(validate(url, key));
});
test('deployment accepts public hosted and local development credentials', () => {
  assert.equal(validate('https://project.supabase.co', jwt('anon')), null);
  assert.equal(validate('https://project.supabase.co', 'sb_publishable_public'), null);
  assert.equal(validate('http://127.0.0.1:54321', jwt('anon')), null);
});
