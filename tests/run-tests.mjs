import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Each node:test file has an isolated process. Direct execution avoids a Node 23
// test-worker/PGlite startup hang seen on the development host. Never skip SQL
// tests; timeout or nonzero exit makes the entire command fail.
let failed = false;
for (const file of readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.test.mjs')).sort()) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', `tests/${file}`], {
    stdio: 'inherit', timeout: 60000,
  });
  if (result.error || result.status !== 0) {
    console.error(`FAILED: ${file}`, result.error?.message || result.signal || result.status);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
