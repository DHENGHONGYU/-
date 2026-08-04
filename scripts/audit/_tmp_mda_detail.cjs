// Get detailed MDA errors per file with exact patterns
const { spawnSync } = require('child_process');
const path = require('path');

const res = spawnSync('npx', [
  'eslint', 'src/', '--ext', '.ts,.tsx', '--format', 'json',
], {
  cwd: 'd:\\FinSightV9', encoding: 'utf-8',
  maxBuffer: 150 * 1024 * 1024, shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const reports = JSON.parse(res.stdout);
const errors = [];
for (const r of reports) {
  if (!r.messages?.length) continue;
  const relFile = path.relative('d:\\FinSightV9', r.filePath);
  for (const m of r.messages) {
    if (!m.ruleId || m.severity !== 2) continue;
    errors.push({ file: relFile, line: m.line, col: m.column, rule: m.ruleId, msg: m.message, lineText: m.line });
  }
}

// Group by file
const byFile = {};
for (const e of errors) {
  if (!byFile[e.file]) byFile[e.file] = [];
  byFile[e.file].push(e);
}

console.log('=== ALL ERROR GROUPS ===');
for (const [f, arr] of Object.entries(byFile)) {
  console.log(`\n${f}: ${arr.length} errors`);
  for (const e of arr) {
    console.log(`  L${e.line}:${e.col} [${e.rule}] ${e.msg.slice(0, 140)}`);
  }
}
console.log(`\nTotal: ${errors.length} errors in ${Object.keys(byFile).length} files`);
