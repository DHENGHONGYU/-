// Get full MDA error details for precise fixes
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const res = spawnSync('npx', [
  'eslint', 'src/', '--ext', '.ts,.tsx', '--format', 'json',
], {
  cwd: 'd:\\FinSightV9', encoding: 'utf-8',
  maxBuffer: 200 * 1024 * 1024, shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const reports = JSON.parse(res.stdout);
const output = [];

for (const r of reports) {
  if (!r.messages?.length) continue;
  const relFile = path.relative('d:\\FinSightV9', r.filePath);
  const fileErrors = [];
  for (const m of r.messages) {
    if (!m.ruleId || m.severity !== 2) continue;
    fileErrors.push({
      line: m.line,
      col: m.column,
      rule: m.ruleId,
      msg: m.message,
    });
  }
  if (fileErrors.length > 0) {
    output.push({ file: relFile, errors: fileErrors });
  }
}

console.log(JSON.stringify(output, null, 2));
