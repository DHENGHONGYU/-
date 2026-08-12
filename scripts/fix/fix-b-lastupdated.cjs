/**
 * B 类 last_updated 闭环治理
 *
 * 目标：为缺失 last_updated 的文档补该字段。
 * 取值优先级：
 *   1. 正文 **Last Updated**: 行（body 声明）
 *   2. 正文 **日期**: 行
 *   3. change_log 最新条目日期
 *   4. 基准日 BASELINE_DATE
 *
 * 仅在缺失时补，不覆盖已有的 last_updated。
 *
 * 用法：
 *   node scripts/fix/fix-b-lastupdated.cjs --dry-run
 *   node scripts/fix/fix-b-lastupdated.cjs
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

function extractBodyDate(body) {
  // > **Last Updated**: YYYY-MM-DD
  let m = body.match(/^\s*>\s*\*\*(?:Last Updated|最新更新|最后更新|日期)\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/m);
  if (m) return m[1];
  m = body.match(/^\s*>\s*\*\*日期\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/m);
  if (m) return m[1];
  return null;
}

function parseChangeLogDate(raw) {
  if (!raw) return null;
  const m = raw.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function insertLastUpdated(rawFm) {
  const lines = rawFm.split('\n');
  // 找插入位置：在 doc_id 后、change_log 前，或末尾
  let insertAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('change_log:')) { insertAt = i; break; }
  }
  lines.splice(insertAt, 0, 'last_updated: ' + '');
  return { lines, insertAt };
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

  if (parsed.fm.last_updated && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fm.last_updated)) continue; // 已有合法

  // 提取日期
  let date = null;
  const bodyDate = extractBodyDate(parsed.body);
  if (bodyDate) date = bodyDate;
  else {
    const clDate = parseChangeLogDate(parsed.fm.change_log_raw);
    if (clDate) date = clDate;
  }
  if (!date) date = BASELINE_DATE;

  const rel = path.relative(ROOT, fp);
  changed++;
  changedFiles.push({ rel, date, src: bodyDate ? 'body' : (parseChangeLogDate(parsed.fm.change_log_raw) ? 'change_log' : 'baseline') });

  if (DRY_RUN) {
    console.log(`[dry] ${rel}: +last_updated=${date} (${changedFiles[changedFiles.length-1].src})`);
  } else {
    const { lines, insertAt } = insertLastUpdated(parsed.rawFm);
    lines[insertAt] = `last_updated: ${date}`;
    const newRawFm = lines.join('\n');
    fs.writeFileSync(fp, '---\n' + newRawFm + '\n---' + parsed.body);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`扫描 ${checked} 份，需补 last_updated ${changed} 份`);
if (changedFiles.length <= 12) {
  changedFiles.forEach(f => console.log(`  - ${f.rel}: ${f.date} (${f.src})`));
} else {
  changedFiles.slice(0, 8).forEach(f => console.log(`  - ${f.rel}: ${f.date} (${f.src})`));
  console.log(`  ... (另 ${changed - 8} 份)`);
}