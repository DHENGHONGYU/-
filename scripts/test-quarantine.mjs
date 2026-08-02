// Flaky test isolation helper.
// Reads tests/quarantine.list (one glob per line, # comments allowed) and:
//   stable     -> `vitest run` EXCLUDING the quarantined globs (trust signal)
//   quarantine  -> `vitest run` INCLUDING ONLY the quarantined files
// Usage (npm scripts): `test:stable` / `test:quarantine`.
//
// 2026-08-02 fix: execFileSync('npx') 在 Windows 下 ENOENT（npx 实为 npx.cmd，
// Node 的 execFileSync 不做 .cmd 解析）。改为 process.execPath 直驱 vitest.mjs，
// 跨平台且不依赖 npx/shell。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const listPath = fileURLToPath(new URL('../tests/quarantine.list', import.meta.url));
const mode = process.argv[2] || 'stable';

const vitestBin = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

const globs = readFileSync(listPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

if (mode === 'quarantine') {
  if (globs.length === 0) {
    console.log('[test:quarantine] quarantine.list is empty — nothing to run.');
    process.exit(0);
  }
  execFileSync(process.execPath, [vitestBin, 'run', ...globs], { stdio: 'inherit' });
} else {
  const exclude = globs.flatMap((g) => ['--exclude', g]);
  execFileSync(process.execPath, [vitestBin, 'run', ...exclude], { stdio: 'inherit' });
}
