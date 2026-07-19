// 验证所有高频目标文件是否存在 (UTF-8 BOM 标记版)
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// 从CSV读取top50
const csv = fs.readFileSync('scripts/docs/reports/audit/top50-d2d.csv', 'utf-8');
const lines = csv.split('\n').slice(1).filter(Boolean);
console.log('CSV lines:', lines.length, 'first:', JSON.stringify(lines[0]).slice(0, 200));
const targets = [];
for (const l of lines) {
  // 格式: count,"target"
  const idx = l.indexOf(',');
  if (idx < 0) continue;
  const countStr = l.slice(0, idx);
  let rest = l.slice(idx + 1);
  if (rest.startsWith('"')) rest = rest.slice(1);
  if (rest.endsWith('"')) rest = rest.slice(0, -1);
  // 取消CSV转义
  rest = rest.replace(/""/g, '"');
  const count = parseInt(countStr, 10);
  if (!isNaN(count)) targets.push({ count, target: rest });
}
console.log('Parsed targets:', targets.length);

function walk(dir, res = []) {
  if (!fs.existsSync(dir)) return res;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'coverage', '.husky', '.workbuddy'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, res);
    else if (e.isFile() && /\.md$/.test(e.name)) res.push(p);
  }
  return res;
}

const all = []
  .concat(walk(path.join(ROOT, 'docs')))
  .concat(walk(path.join(ROOT, 'prompts')))
  .concat(['AGENTS.md', 'docs/explanation/README.md', 'CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md'].map(f => path.join(ROOT, f)));

const basenameMap = new Map();
const fullPathMap = new Map();
all.forEach(f => {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const base = path.basename(f);
  if (!basenameMap.has(base)) basenameMap.set(base, []);
  basenameMap.get(base).push(rel);
  fullPathMap.set(rel, true);
});

const out = [];
out.push('=== Target existence analysis ===');
out.push('');

for (const { count, target } of targets) {
  const base = path.basename(target);
  const basenameMatches = basenameMap.get(base) || [];
  const fullMatch = fullPathMap.has(target);
  const isBasenameOnly = !target.includes('/');

  let verdict, suggestions = [];
  if (fullMatch) {
    verdict = 'FULL_PATH_EXISTS';
  } else if (basenameMatches.length === 1) {
    verdict = 'BASENAME_UNIQUE';
    suggestions = basenameMatches;
  } else if (basenameMatches.length > 1) {
    verdict = `BASENAME_MULTI(${basenameMatches.length})`;
    suggestions = basenameMatches;
  } else if (isBasenameOnly) {
    verdict = 'BASENAME_MISSING';
  } else {
    verdict = 'PATH_MISSING';
  }

  out.push(`[count=${count.toString().padStart(2)}] [${verdict.padEnd(20)}] ${target}`);
  suggestions.slice(0, 3).forEach(s => out.push(`    -> ${s}`));
}

const result = out.join('\n');
fs.writeFileSync('scripts/docs/reports/audit/verify_high_freq.txt', result, 'utf-8');
console.log('Wrote', out.length, 'lines');
