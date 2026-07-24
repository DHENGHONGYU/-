// Flaky test isolation helper.
// Reads tests/quarantine.list (one glob per line, # comments allowed) and:
//   stable     -> `vitest run` EXCLUDING the quarantined globs (trust signal)
//   quarantine  -> `vitest run` INCLUDING ONLY the quarantined files
// Usage (npm scripts): `test:stable` / `test:quarantine`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const listPath = fileURLToPath(new URL('../tests/quarantine.list', import.meta.url));
const mode = process.argv[2] || 'stable';

const globs = readFileSync(listPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

if (mode === 'quarantine') {
  if (globs.length === 0) {
    console.log('[test:quarantine] quarantine.list is empty — nothing to run.');
    process.exit(0);
  }
  execFileSync('npx', ['vitest', 'run', ...globs], { stdio: 'inherit' });
} else {
  const exclude = globs.flatMap((g) => ['--exclude', g]);
  execFileSync('npx', ['vitest', 'run', ...exclude], { stdio: 'inherit' });
}
