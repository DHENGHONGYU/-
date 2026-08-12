/**
 * C 类 change_log 闭环治理
 *
 * 目标：确保每个有 frontmatter 的文档，change_log 最新条目版本 == frontmatter.version，
 * 且日期 == frontmatter.last_updated（或基准日）。
 *
 * 规则：
 *   1. 缺失 change_log / 无有效条目 → 补一条当前版本条目
 *   2. change_log 最新条目版本 < FM → 补一条 FM 版本条目（change_log 记录当前版本）
 *   3. change_log 最新条目版本 > FM → 升 FM 到 change_log（仅升不降）
 *   4. 条目变化时，纠正 change_log 子项缩进（version: 2 空格，changes/date: 4 空格）
 *
 * 用法：
 *   node scripts/fix/fix-c-closure.cjs --dry-run
 *   node scripts/fix/fix-c-closure.cjs
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

function fixChangeLogIndentAndMaybeAppend(rawFm, fm, fmVersion, date) {
  const lines = rawFm.split('\n');
  let clStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^change_log:\s*$/.test(lines[i])) { clStart = i; break; }
    if (/^change_log:\s*\S/.test(lines[i])) { clStart = i; break; } // 同一行
  }
  if (clStart === -1) {
    // 无 change_log：在末尾追加
    const entry = [
      `change_log:`,
      `  - version: ${fmVersion}`,
      `    changes: "C 类版本闭环(${BASELINE_DATE})：补全 change_log 初始条目"`,
      `    date: ${date}`,
    ];
    const cleanLines = lines.filter(l => l.trim().length > 0);
    return cleanLines.concat(entry).join('\n');
  }

  // 有 change_log 行
  const hasInline = /^change_log:\s*\S/.test(lines[clStart]);
  if (hasInline) {
    // 单行 change_log: - version: x —— 拆成标准块
    const inlineContent = lines[clStart].replace(/^change_log:\s*/, '').trim();
    const before = lines.slice(0, clStart);
    const after = lines.slice(clStart + 1);
    const block = [
      'change_log:',
      `  ${inlineContent}`,
      `  - version: ${fmVersion}`,
      `    changes: "C 类版本闭环(${BASELINE_DATE})：补全 change_log 条目"`,
      `    date: ${date}`,
    ];
    return before.concat(block, after).join('\n');
  }

  // 标准块：修正缩进 + 确保最新条目为 FM 版本
  let clEnd = lines.length;
  for (let i = clStart + 1; i < lines.length; i++) {
    const line = lines[i];
    const isTopKey = /^[A-Za-z_][\w]*:\s*/.test(line) && !/^\s/.test(line) && !/^-/.test(line) && !/^changes:/.test(line) && !/^date:/.test(line);
    if (isTopKey) { clEnd = i; break; }
  }

  // 重建 change_log 块：修正缩进 + 在头部插入 FM 版本条目（若缺失）
  const newBlock = ['change_log:'];
  // 新条目（change_log 最新在前）
  newBlock.push(`  - version: ${fmVersion}`);
  newBlock.push(`    changes: "C 类版本闭环(${BASELINE_DATE})：change_log 对齐当前版本"`);
  newBlock.push(`    date: ${date}`);
  // 原条目（保留，修正缩进）
  for (let i = clStart + 1; i < clEnd; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let newLine = line;
    if (/^\s*-\s*version:/.test(line)) newLine = '  ' + line.replace(/^\s*/, '');
    else if (/^\s*(changes:|date:)/.test(line)) newLine = '    ' + line.replace(/^\s*/, '');
    newBlock.push(newLine);
  }
  const before = lines.slice(0, clStart);
  const after = lines.slice(clEnd);
  return before.concat(newBlock, after).join('\n');
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

  const fmVersion = parsed.fm.version;
  if (!fmVersion) continue; // 无版本号则跳过（B/A 类另行处理）

  const fmDate = (parsed.fm.last_updated && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fm.last_updated)) ? parsed.fm.last_updated : BASELINE_DATE;
  const clLatest = parseChangeLogLatest(parsed.fm.change_log_raw);

  // 已闭环：最新条目 == FM 版本 且 有最新条目
  if (clLatest && semverCmp(clLatest, fmVersion) === 0) {
    // 还需检查缩进是否规范？为效率，仅当无 change_log 或版本不匹配才处理
    continue;
  }

  // 需要处理：缺失 change_log，或最新条目 ≠ FM
  const hasCl = ('change_log' in parsed.fm) || !!parsed.fm.change_log_raw;

  // 若 change_log 最新 > FM：升 FM（仅升）
  let targetFmVersion = fmVersion;
  if (clLatest && semverCmp(clLatest, fmVersion) > 0) {
    targetFmVersion = clLatest;
  }

  const newRawFm = fixChangeLogIndentAndMaybeAppend(parsed.rawFm, parsed.fm, targetFmVersion, fmDate);

  // 若 FM 需要升（change_log > FM），重写 version 行
  let finalRawFm = newRawFm;
  if (targetFmVersion !== fmVersion) {
    finalRawFm = newRawFm.replace(/^(version:\s*).*$/m, `$1${targetFmVersion}`);
  }

  const rel = path.relative(ROOT, fp);
  changed++;
  changedFiles.push({ rel, hasCl, fmVersion, clLatest, targetFmVersion });

  if (DRY_RUN) {
    console.log(`[dry] ${rel}: FM=${fmVersion} cl=${clLatest || 'null'} → ${targetFmVersion}`);
  } else {
    const newContent = '---\n' + finalRawFm + '\n---' + parsed.body;
    fs.writeFileSync(fp, newContent);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`扫描 ${checked} 份，需处理 ${changed} 份`);
if (changedFiles.length <= 12) {
  changedFiles.forEach(f => console.log(`  - ${f.rel}: ${f.fmVersion} / cl=${f.clLatest || 'null'} → ${f.targetFmVersion}`));
} else {
  changedFiles.slice(0, 8).forEach(f => console.log(`  - ${f.rel}: ${f.fmVersion} / cl=${f.clLatest || 'null'} → ${f.targetFmVersion}`));
  console.log(`  ... (另 ${changed - 8} 份)`);
}