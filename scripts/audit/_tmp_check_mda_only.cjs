// Get only MDA errors
const { spawnSync } = require('child_process');
const path = require('path');

const res = spawnSync('npx', ['eslint', 'src/', '--ext', '.ts,.tsx', '--format', 'json'], {
  cwd: 'd:\\FinSightV9', encoding: 'utf-8',
  maxBuffer: 150 * 1024 * 1024, shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const reports = JSON.parse(res.stdout);
const mdaErrors = [];
const otherErrors = [];
for (const r of reports) {
  if (!r.messages?.length) continue;
  const rel = path.relative('d:\\FinSightV9', r.filePath);
  for (const m of r.messages) {
    if (!m.ruleId || m.severity !== 2) continue;
    const entry = { file: rel, line: m.line, rule: m.ruleId, msg: m.message };
    if (m.ruleId === '@typescript-eslint/no-unsafe-member-access') mdaErrors.push(entry);
    else otherErrors.push(entry);
  }
}
console.log('MDA ERRORS:', mdaErrors.length);
for (const e of mdaErrors) console.log(' ', JSON.stringify(e));
console.log('\nOTHER ERRORS:', otherErrors.length);
for (const e of otherErrors) console.log(' ', JSON.stringify(e));
