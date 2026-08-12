/**
 * 版本闭环治理（正确方向：取最高版本为真值，仅升不降）
 *
 * 真值判定优先级：
 *   1. 正文版本声明行 body（记录真实迭代）
 *   2. change_log 最新条目
 *   3. frontmatter.version
 * 取三者中 semver 最大者为权威真值，将 FM.version 与 body 版本声明行同步到真值。
 *
 * 仅同步版本号，不重写其他字段、不新增/删除 change_log 条目、不降级任何版本。
 *
 * 用法：
 *   node scripts/fix/fix-closure-true-value.cjs --dry-run
 *   node scripts/fix/fix-closure-true-value.cjs
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');
const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '.venv', 'venv', '__pycache__', '.hf_cache', 'outputs', '.trae', 'deliverables']);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.isFile() && e.name.endsWith('.md')) out.push(path.join(dir, e.name));
  }
  return out;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const rawFm = content.slice(4, end);
  const body = content.slice(end + 4);
  const fm = {};
  let inChangeLog = false;
  let changeLogBuf = [];
  for (const line of rawFm.split('\n')) {
    if (inChangeLog) {
      if (/^[A-Za-z_][\w]*:\s*/.test(line)) { fm.change_log_raw = changeLogBuf.join('\n'); inChangeLog = false; }
      else { changeLogBuf.push(line); continue; }
    }
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    fm[k] = v.replace(/^"|"$/g, '').trim();
    if (k === 'change_log') { inChangeLog = true; changeLogBuf = []; }
  }
  if (inChangeLog) fm.change_log_raw = changeLogBuf.join('\n');
  return { rawFm, fm, body };
}

function semverParts(v) {
  let s = v.trim().replace(/^v/, '');
  const dashIdx = s.indexOf('-');
  let suffix = '';
  if (dashIdx !== -1) { suffix = s.slice(dashIdx); s = s.slice(0, dashIdx); }
  const parts = s.split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  return { parts, suffix };
}

function semverCmp(a, b) {
  const pa = semverParts(a).parts, pb = semverParts(b).parts;
  for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
  return 0;
}

function parseChangeLogLatest(raw) {
  if (!raw) return null;
  const matches = [...raw.matchAll(/version:\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/g)];
  if (matches.length === 0) return null;
  let max = matches[0][1];
  for (let i = 1; i < matches.length; i++) if (semverCmp(matches[i][1], max) > 0) max = matches[i][1];
  return max;
}

function extractBodyVersion(body) {
  const patterns = [
    /^\s*>\s*\*\*版本\*\*\s*[:：]\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m,
    /^\s*>\s*\*\*Version\*\*\s*[:：]\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m,
    /^\s*#\s*.*[—\-–]\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)\s*$/m,
  ];
  for (const p of patterns) { const m = body.match(p); if (m) return m[1]; }
  return null;
}

function rewriteFmVersion(rawFm, newVer) {
  const lines = rawFm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^version:\s*/.test(lines[i])) { lines[i] = `version: ${newVer}`; break; }
  }
  return lines.join('\n');
}

function rewriteBodyVersion(body, newVer) {
  const re = /(^>\s*\*\*(?:版本|Version)\*\*\s*[:：]\s*)(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m;
  if (re.test(body)) return body.replace(re, `$1${newVer}`);
  const re2 = /(^#\s*.*[—\-–]\s*)(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)(\s*)$/m;
  if (re2.test(body)) return body.replace(re2, `$1${newVer}$3`);
  return null;
}

const files = walk(ROOT);
let changed = 0;
let checked = 0;
const changedFiles = [];

for (const fp of files) {
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { continue; }
  const parsed = parseFrontmatter(content);
  if (!parsed) continue;
  checked++;

  const fmVer = parsed.fm.version;
  const bodyVer = extractBodyVersion(parsed.body);
  const clLatest = parseChangeLogLatest(parsed.fm.change_log_raw);

  // 收集候选真值
  const candidates = [];
  if (bodyVer) candidates.push({ v: bodyVer, src: 'body' });
  if (clLatest) candidates.push({ v: clLatest, src: 'change_log' });
  if (fmVer) candidates.push({ v: fmVer, src: 'FM' });
  if (candidates.length === 0) continue;

  // 取 semver 最大为真值
  let truth = candidates[0];
  for (const c of candidates) if (semverCmp(c.v, truth.v) > 0) truth = c;

  let newFm = parsed.rawFm;
  let newBody = parsed.body;
  let fileChanged = false;

  // FM 同步到真值（若真值 > FM）
  if (fmVer && semverCmp(truth.v, fmVer) > 0) {
    newFm = rewriteFmVersion(newFm, truth.v);
    fileChanged = true;
  }
  // body 同步到真值（若真值 > body）
  if (bodyVer && semverCmp(truth.v, bodyVer) > 0) {
    const r = rewriteBodyVersion(newBody, truth.v);
    if (r) { newBody = r; fileChanged = true; }
  }

  if (!fileChanged) continue;

  const rel = path.relative(ROOT, fp);
  changed++;
  changedFiles.push({ rel, fmVer, bodyVer, truth: truth.v, src: truth.src });

  if (DRY_RUN) {
    console.log(`[dry] ${rel}: FM=${fmVer || '-'} body=${bodyVer || '-'} cl=${clLatest || '-'} → ${truth.v}(${truth.src})`);
  } else {
    const newContent = '---\n' + newFm + '\n---' + newBody;
    fs.writeFileSync(fp, newContent);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`扫描 ${checked} 份，需同步 ${changed} 份`);
if (changedFiles.length <= 12) {
  changedFiles.forEach(f => console.log(`  - ${f.rel}: → ${f.truth}(${f.src})`));
} else {
  changedFiles.slice(0, 8).forEach(f => console.log(`  - ${f.rel}: → ${f.truth}(${f.src})`));
  console.log(`  ... (另 ${changed - 8} 份)`);
}