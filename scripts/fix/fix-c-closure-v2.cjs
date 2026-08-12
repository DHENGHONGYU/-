/**
 * C 类 change_log 闭环增强版（覆盖无 version 文档）
 *
 * 对缺失 change_log 的文档补一条当前版本条目。
 * 版本确定优先级：
 *   1. body 版本声明（**Version/版本**）
 *   2. frontmatter.version
 *   3. change_log 已有最新
 *   4. v1.0.0
 * 日期确定优先级：
 *   1. body **Last Updated/日期**
 *   2. frontmatter.last_updated
 *   3. 基准日
 *
 * 用法：
 *   node scripts/fix/fix-c-closure-v2.cjs --dry-run
 *   node scripts/fix/fix-c-closure-v2.cjs
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');
const BASELINE_DATE = '2026-08-11';
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

function extractBodyVersion(body) {
  let m = body.match(/^\s*>\s*\*\*(?:版本|Version)\*\*\s*[:：]\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m);
  if (m) return m[1];
  m = body.match(/^#\s*.*[—\-–]\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)\s*$/m);
  if (m) return m[1];
  return null;
}

function extractBodyDate(body) {
  let m = body.match(/^\s*>\s*\*\*(?:Last Updated|最新更新|最后更新|日期)\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/m);
  if (m) return m[1];
  m = body.match(/^\s*>\s*\*\*日期\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/m);
  if (m) return m[1];
  return null;
}

function hasValidChangeLog(raw) {
  if (!raw) return false;
  return /version:\s*(v?[\d]+\.[\d]+)/.test(raw);
}

function upsertField(rawFm, key, value) {
  const lines = rawFm.split('\n');
  let found = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(new RegExp(`^${key}:\\s*`))) { found = i; break; }
  }
  if (found !== -1) {
    lines[found] = `${key}: ${value}`;
  } else {
    let insertAt = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('change_log:')) { insertAt = i; break; }
    }
    lines.splice(insertAt, 0, `${key}: ${value}`);
  }
  return lines.join('\n');
}

function appendChangeLogBlock(rawFm, version, date) {
  const lines = rawFm.split('\n');
  const entry = [
    `change_log:`,
    `  - version: ${version}`,
    `    changes: "C 类版本闭环(${BASELINE_DATE})：补全 change_log 初始条目"`,
    `    date: ${date}`,
  ];
  const clean = lines.filter(l => l.trim().length > 0);
  return clean.concat(entry).join('\n');
}

let changed = 0;
let checked = 0;
const changedFiles = [];

for (const fp of walk(ROOT)) {
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { continue; }
  const parsed = parseFrontmatter(content);
  if (!parsed) continue;
  checked++;

  if (hasValidChangeLog(parsed.fm.change_log_raw)) continue; // 已有有效 change_log

  // 确定版本
  let ver = extractBodyVersion(parsed.body);
  if (!ver && parsed.fm.version) ver = parsed.fm.version;
  if (!ver) ver = 'v1.0.0';
  if (!/^v/i.test(ver)) ver = 'v' + ver;

  // 确定日期
  let date = extractBodyDate(parsed.body);
  if (!date && parsed.fm.last_updated && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fm.last_updated)) date = parsed.fm.last_updated;
  if (!date) date = BASELINE_DATE;

  let rawFm = parsed.rawFm;
  // 补 version（若缺）
  if (!parsed.fm.version) rawFm = upsertField(rawFm, 'version', ver);
  // 补 last_updated（若缺）
  if (!parsed.fm.last_updated) rawFm = upsertField(rawFm, 'last_updated', date);
  // 补 change_log
  rawFm = appendChangeLogBlock(rawFm, ver, date);

  const rel = path.relative(ROOT, fp);
  changed++;
  changedFiles.push({ rel, ver, date });

  if (DRY_RUN) {
    console.log(`[dry] ${rel}: +change_log v=${ver} d=${date}`);
  } else {
    fs.writeFileSync(fp, '---\n' + rawFm + '\n---' + parsed.body);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`扫描 ${checked} 份，需补 change_log ${changed} 份`);
if (changedFiles.length <= 10) {
  changedFiles.forEach(f => console.log(`  - ${f.rel}: v=${f.ver} d=${f.date}`));
} else {
  changedFiles.slice(0, 8).forEach(f => console.log(`  - ${f.rel}: v=${f.ver} d=${f.date}`));
  console.log(`  ... (另 ${changed - 8} 份)`);
}