/**
 * 文档新鲜度批量校对执行器
 *
 * 批次切分（R3 用户 2026-08-11 确认）：
 *   Batch 1 = 全部 A 类（双轨不一致，any tier） + P0 级 B/C 类（tier === 'important' || 'T0'）
 *   Batch 2 = 仅非 P0 的 B 类（last_updated 缺失/格式错误，非 T0/important）
 *   Batch 3 = 仅非 P0 的 C 类（change_log 闭环失败，非 T0/important）
 *   注：同一文件若跨类命中，一律归入「最早批次」，避免重复处理
 *
 * 规则：
 *   R1 真值优先级：change_log 最新条目 > 正文 **版本** 行 > 标题 — vX.Y.Z > frontmatter.version 裸值
 *   R2 基准校对必须 PATCH++：先对齐为真值，再规范化为 X.Y.Z 三位，最后 PATCH 位 +1
 *
 * 用法：
 *   npx tsx scripts/fix/apply-doc-freshness-batch.ts --batch 1 --dry-run
 *   npx tsx scripts/fix/apply-doc-freshness-batch.ts --batch 1 --dry-run --out report.md
 *   npx tsx scripts/fix/apply-doc-freshness-batch.ts --batch 1            # 实际写入
 */

import * as fs from 'fs';
import * as path from 'path';

// ============= CLI args =============

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const i = args.indexOf('--' + name);
  if (i === -1) return undefined;
  return args[i + 1];
}
const hasFlag = (name: string) => args.includes('--' + name);

const BATCH_N = Number(getArg('batch') ?? '0');
const DRY_RUN = hasFlag('dry-run') || hasFlag('dryrun');
const BASELINE_DATE = getArg('baseline') ?? '2026-08-11';
const DEFAULT_CODE_VERSION = '2.0.0-rc.1';
const OUT_FILE = getArg('out');

if (![1, 2, 3].includes(BATCH_N)) {
  console.error('用法: --batch 1|2|3 [--dry-run] [--baseline YYYY-MM-DD]');
  process.exit(2);
}

// ============= helpers (shared with detect) =============

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  'coverage', '.venv', 'venv', '__pycache__',
  '.hf_cache',         // HuggingFace 本地模型缓存，非项目文档
  'outputs',           // 本脚本生成的报告/日志等产物，不应再进入新鲜度扫描
  '.trae',             // Trae IDE 本地记忆/cache 目录
  'deliverables',      // 对外交付物 artifact，非内部治理文档
]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

type Parsed = {
  hasFrontmatter: boolean;
  fmStart: number;
  fmEnd: number;     // index of '\n---' end sentinel (absolute offset in content)
  rawFm: string;
  fm: Record<string, string>;
  changeLogRaw: string | null;
  body: string;
};

function parseFrontmatter(content: string): Parsed {
  const noFm: Parsed = {
    hasFrontmatter: false, fmStart: 0, fmEnd: 0, rawFm: '', fm: {}, changeLogRaw: null, body: content,
  };
  if (!content.startsWith('---')) return noFm;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return noFm;
  const raw = content.slice(4, end);
  const body = content.slice(end + 4);
  const fm: Record<string, string> = {};
  let inChangeLog = false;
  let changeLogBuf: string[] = [];
  for (const line of raw.split('\n')) {
    if (inChangeLog) {
      if (/^[A-Za-z_][\w]*:\s*/.test(line)) {
        fm['change_log_raw'] = changeLogBuf.join('\n');
        inChangeLog = false;
      } else {
        changeLogBuf.push(line);
        continue;
      }
    }
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    fm[k] = v.replace(/^"|"$/g, '').trim();
    if (k === 'change_log') {
      inChangeLog = true;
      changeLogBuf = [];
    }
  }
  if (inChangeLog) fm['change_log_raw'] = changeLogBuf.join('\n');
  return {
    hasFrontmatter: true,
    fmStart: 0,
    fmEnd: end,
    rawFm: raw,
    fm,
    changeLogRaw: fm['change_log_raw'] ?? null,
    body,
  };
}

/** 将任意 YAML 行中 value 重写（基于正则定位整行） */
function rewriteFmValue(rawFm: string, key: string, newValue: string): string {
  const lines = rawFm.split('\n');
  let foundIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^${key}:\\s*`).test(lines[i])) {
      foundIdx = i;
      break;
    }
  }
  const isQuoted = /^".*"$/.test(newValue);
  const formatted = isQuoted ? newValue : (newValue.includes(':') || newValue.startsWith('{') ? `"${newValue}"` : newValue);
  if (foundIdx !== -1) {
    lines[foundIdx] = `${key}: ${formatted}`;
  } else {
    // 插入在 tier 之前或 document 结束之前
    let insertAt = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('change_log:')) {
        insertAt = i;
        break;
      }
    }
    lines.splice(insertAt, 0, `${key}: ${formatted}`);
  }
  return lines.join('\n');
}

/** 确保 change_log 存在并追加一条基准条目 */
function appendChangeLog(rawFm: string, version: string, changes: string, date: string, existingChangeLog: string | null): string {
  const lines = rawFm.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('change_log:')) {
      startIdx = i;
      break;
    }
  }
  const entryLines = [
    `  - version: ${version}`,
    `    changes: "${changes.replace(/"/g, "'")}"`,
    `    date: ${date}`,
  ].join('\n');

  if (startIdx !== -1 && existingChangeLog && existingChangeLog.trim().length > 0) {
    // 找到现有条目结束位置（下一个顶级 key）——为了简化，我们在 change_log: 后立即插入（作为最新条目）
    // 更安全的做法：找到 "change_log:" 行下一行，把新条目 + 原始 change_log_raw 合并
    // 实际：直接重建 rawFm，删除 change_log: 以下直到下一个顶级 key，再用新的 change_log block 替换
    // 为避免复杂解析，采用方案：重写整段 change_log 为 [新条目 + 原条目]
    const before: string[] = [];
    let i = 0;
    for (; i < lines.length; i++) {
      if (lines[i].startsWith('change_log:')) break;
      before.push(lines[i]);
    }
    const after: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (/^[A-Za-z_][\w]*:\s*/.test(lines[j])) break;
    }
    for (; j < lines.length; j++) after.push(lines[j]);

    const newBlock: string[] = [];
    newBlock.push('change_log:');
    // 新条目在前（change_log 最新条目的位置是头部还是尾部？
    // V9 约定：change_log 以倒序排列（最新在前）—— 参考所有现有文档
    newBlock.push(...entryLines.split('\n'));
    if (existingChangeLog && existingChangeLog.trim().length > 0) {
      for (const ln of existingChangeLog.split('\n')) {
        // 只加非空
        if (ln.trim().length > 0) newBlock.push(ln);
      }
    }
    return [...before, ...newBlock, ...after].join('\n');
  } else {
    // 不存在 change_log：新增
    const before: string[] = [];
    let i = 0;
    for (; i < lines.length; i++) {
      if (/^(tier|doc_id|related_docs|maintainer):/.test(lines[i])) {
        continue; // 保留在前面
      }
      before.push(lines[i]);
    }
    // 插入在末尾（before 已包含全部非 change_log 顶级字段）
    const newBlock: string[] = [];
    newBlock.push('change_log:');
    newBlock.push(...entryLines.split('\n'));
    return [...before.filter(l => l.length > 0), ...newBlock].join('\n');
  }
}

function extractBodyVersion(body: string): string | null {
  const patterns: RegExp[] = [
    /\*\*版本\*\*\s*[:：]\s*(v?[\d]+\.[\d]+(?:\.[\d]+)?(?:-[a-zA-Z0-9._-]+)?)/,
    /\*\*Version\*\*\s*[:：]\s*(v?[\d]+\.[\d]+(?:\.[\d]+)?(?:-[a-zA-Z0-9._-]+)?)/,
    /^\s*#.*[—\-–]\s*(v?[\d]+\.[\d]+(?:\.[\d]+)?(?:-[a-zA-Z0-9._-]+)?)\s*$/m,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[1];
  }
  return null;
}

/** 将版本号字符串分解为 [MAJOR, MINOR, PATCH, prerelease?] 数值以便比较 */
function semverParts(ver: string): [number, number, number, boolean] {
  let v = ver.trim();
  if (v.startsWith('v')) v = v.slice(1);
  const dashIdx = v.indexOf('-');
  const hasPre = dashIdx !== -1;
  const core = hasPre ? v.slice(0, dashIdx) : v;
  const parts = core.split('.');
  while (parts.length < 3) parts.push('0');
  const [a, b, c] = parts.map(p => Number(p || '0'));
  // 标准 semver：带 prerelease 后缀的 < 不带后缀的（同核心号时）
  // 所以 [a,b,c, true] < [a,b,c, false]
  return [a, b, c, !hasPre];
}
/** 返回 -1/0/1（标准 compare 返回），若 a > b 返回 1 */
function semverCmp(a: string, b: string): number {
  const pa = semverParts(a), pb = semverParts(b);
  for (let i = 0; i < 4; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}
function parseChangeLogLatest(raw: string | null): { latestVersion: string; latestDate: string | null; entriesCount: number } | null {
  if (!raw) return null;
  const versionMatches = [...raw.matchAll(/version:\s*(v?[\d]+\.[\d]+(?:\.[\d]+)?(?:-[a-zA-Z0-9._-]+)?)/g)];
  const dateMatches = [...raw.matchAll(/date:\s*(\d{4}-\d{2}-\d{2})/g)];
  if (versionMatches.length === 0) return null;
  // 不再假设任何顺序（既可能正序也可能倒序），直接按 semver 取最大版本为真值
  // 经验 949737：编号逻辑统一在一处，避免各脚本自行"扫描最新"导致错位
  let bestIdx = 0;
  let bestVer = versionMatches[0][1];
  for (let i = 1; i < versionMatches.length; i++) {
    const cur = versionMatches[i][1];
    if (semverCmp(cur, bestVer) > 0) {
      bestVer = cur;
      bestIdx = i;
    }
  }
  const lastDate = bestIdx < dateMatches.length ? dateMatches[bestIdx][1]
                  : (dateMatches.length > 0 ? dateMatches[dateMatches.length - 1][1] : null);
  return { latestVersion: bestVer, latestDate: lastDate, entriesCount: versionMatches.length };
}

function normalize(v: string | null | undefined): string {
  if (!v) return '';
  return String(v).replace(/^v/, '').toLowerCase().trim();
}

function isValidDate(s: string): boolean {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * R2: 规范化为三位 + PATCH++
 *   v1.2      → v1.2.0 → v1.2.1
 *   v2.5.0    → v2.5.0 → v2.5.1
 *   v4.8      → v4.8.0 → v4.8.1
 *   v0.1.0-proposal → v0.1.0-proposal → v0.1.1-proposal（保留 prerelease 后缀）
 *   v1        → v1.0.0 → v1.0.1  （极端情况）
 */
function normalizeAndPatch(ver: string): string {
  let v = ver.trim();
  const hasV = v.startsWith('v');
  if (hasV) v = v.slice(1);

  // 分离 pre-release 后缀（如 -proposal、-migration-implemented）
  const dashIdx = v.indexOf('-');
  let suffix = '';
  if (dashIdx !== -1) {
    suffix = v.slice(dashIdx);
    v = v.slice(0, dashIdx);
  }

  const parts = v.split('.');
  while (parts.length < 3) parts.push('0');
  parts[2] = String(Number(parts[2] || '0') + 1); // PATCH++

  return (hasV ? 'v' : '') + parts.slice(0, 3).join('.') + suffix;
}

/** R1: 取真值版本 + 给出判定依据 */
function determineTruthVersion(parsed: Parsed): { version: string; reason: string } {
  const { fm, changeLogRaw, body } = parsed;

  // P1: change_log 最新条目
  const cl = parseChangeLogLatest(changeLogRaw);
  if (cl) {
    return { version: cl.latestVersion, reason: 'P1 change_log 最新条目' };
  }

  // P2: 正文 版本 行
  const bv = extractBodyVersion(body);
  if (bv) {
    return { version: bv, reason: 'P2 正文版本声明行' };
  }

  // P3: 标题后缀
  const hm = body.match(/^\s*#.*[—\-–]\s*(v?[\d]+\.[\d]+(?:\.[\d]+)?(?:-[a-zA-Z0-9._-]+)?)\s*$/m);
  if (hm) {
    return { version: hm[1], reason: 'P3 标题后缀版本' };
  }

  // P4: frontmatter.version 裸值
  if (fm.version) {
    return { version: fm.version, reason: 'P4 frontmatter.version 裸值' };
  }

  // 完全不存在：新建
  return { version: 'v1.0.0', reason: 'P4-else 新建 v1.0.0（无任何版本信息）' };
}

// ============= issue detect + batch assignment =============

type Issues = { A: boolean; B: string | null; C: string | null };
type FileRecord = {
  file: string; rel: string;
  tier: string; docId: string;
  issues: Issues;
  truth: { version: string; reason: string };
  batch: number | null;
};

function detectIssuesAndAssign(p: Parsed, rel: string): { issues: Issues; tier: string; docId: string } {
  const fm = p.fm;
  const fmVersion = fm.version || null;
  const fmDate = fm.last_updated || null;
  const tier = (fm.tier || '(无 tier)').trim();
  const docId = (fm.doc_id || '(无 doc_id)').trim();

  const A: boolean = (() => {
    if (!fmVersion) return false;
    const bv = extractBodyVersion(p.body);
    if (!bv) return false;
    return normalize(fmVersion) !== normalize(bv);
  })();

  let B: string | null = null;
  if (!fmDate) B = '缺失 last_updated';
  else if (!isValidDate(fmDate)) B = `last_updated 格式错误 ${fmDate}`;

  let C: string | null = null;
  const hasCl = ('change_log' in fm) || !!p.changeLogRaw;
  if (!hasCl) C = '缺失 change_log 字段';
  else {
    const parsedCl = parseChangeLogLatest(p.changeLogRaw);
    if (!parsedCl) C = 'change_log 无有效条目';
    else {
      const parts: string[] = [];
      if (fmVersion && normalize(parsedCl.latestVersion) !== normalize(fmVersion)) {
        parts.push(`最新条目 ${parsedCl.latestVersion} ≠ frontmatter ${fmVersion}`);
      }
      if (fmDate && isValidDate(fmDate) && parsedCl.latestDate && parsedCl.latestDate !== fmDate) {
        parts.push(`条目日期 ${parsedCl.latestDate} ≠ last_updated ${fmDate}`);
      }
      if (parts.length) C = parts.join('；');
    }
  }
  return { issues: { A, B, C }, tier, docId };
}

function isP0Tier(tier: string): boolean {
  const t = tier.toLowerCase();
  return t === 'important' || t === 't0';
}

function assignBatch(rec: FileRecord): number | null {
  const { A, B, C } = rec.issues;
  if (!A && !B && !C) return null; // 无问题
  // Batch 1: ALL A (any tier) + B/C with P0 tier
  if (A) return 1;
  if (isP0Tier(rec.tier)) return 1;
  // Batch 2: only B (non-P0)
  if (B) return 2;
  // Batch 3: only C (non-P0) — we've filtered out A/P0, so C alone → Batch 3
  if (C) return 3;
  return null;
}

// ============= apply changes =============

type Applied = {
  rel: string;
  tier: string;
  docId: string;
  issueMark: string; // A/B/C 组合
  truthReason: string;
  before: { version: string; lastUpdated: string; codeVersion: string; hasChangeLog: boolean };
  after:  { version: string; lastUpdated: string; codeVersion: string; hasChangeLog: boolean; changeLogNewEntry: string };
  patchNote: string; // "v2.5.0 → normalize → v2.5.0 → PATCH++ → v2.5.1"
};

function buildPatchNote(truthVer: string, finalVer: string): string {
  return `${truthVer} → [R2补零/规范化] → ${normalizeAndPatch_preview(truthVer).normalized} → [PATCH++] → ${finalVer}`;
}
function normalizeAndPatch_preview(ver: string): { normalized: string; patched: string } {
  let v = ver.trim();
  const hasV = v.startsWith('v');
  if (hasV) v = v.slice(1);
  const dashIdx = v.indexOf('-');
  let suffix = '';
  if (dashIdx !== -1) { suffix = v.slice(dashIdx); v = v.slice(0, dashIdx); }
  const parts = v.split('.');
  while (parts.length < 3) parts.push('0');
  const normalized = (hasV ? 'v' : '') + parts.slice(0, 3).join('.') + suffix;
  const patchedParts = [...parts];
  patchedParts[2] = String(Number(patchedParts[2] || '0') + 1);
  const patched = (hasV ? 'v' : '') + patchedParts.slice(0, 3).join('.') + suffix;
  return { normalized, patched };
}

function applyToFile(rec: FileRecord, dryRun: boolean): Applied | null {
  const content = fs.readFileSync(rec.file, 'utf8');
  const parsed = parseFrontmatter(content);
  if (!parsed.hasFrontmatter) return null;

  const truth = determineTruthVersion(parsed);
  const { normalized: truthNormalized, patched: finalVer } = normalizeAndPatch_preview(truth.version);

  let newRawFm = parsed.rawFm;

  const beforeVer = parsed.fm.version ?? '(缺失)';
  const beforeDate = parsed.fm.last_updated ?? '(缺失)';
  const beforeCV = parsed.fm.code_version ?? '(缺失)';
  const beforeHasCl = !!parsed.changeLogRaw && parsed.changeLogRaw.trim().length > 0;

  // 1) version → finalVer (after R2 PATCH++)
  newRawFm = rewriteFmValue(newRawFm, 'version', finalVer);

  // 2) last_updated = BASELINE_DATE
  newRawFm = rewriteFmValue(newRawFm, 'last_updated', BASELINE_DATE);

  // 3) code_version = DEFAULT_CODE_VERSION (if missing)
  if (!parsed.fm.code_version) {
    newRawFm = rewriteFmValue(newRawFm, 'code_version', `"${DEFAULT_CODE_VERSION}"`);
  }

  // 4) change_log 追加基准条目
  const changesMsg = `基准日校对(${BASELINE_DATE})：R1取真值(${truth.reason}=${truth.version}) → R2 PATCH++(${finalVer}) / last_updated 刷新 / change_log 闭环`;
  // 先临时 parse 最新 changeLogRaw（它可能已被上面重写 fm 打乱？ 否，newRawFm 只改了三个顶级标量，change_log_raw 仍在末尾）
  // 为了安全：再次解析 newRawFm
  const reparsedRaw = (() => {
    const m = newRawFm.match(/change_log:\s*\n?([\s\S]*?)(?=\n[A-Za-z_][\w]*:\s*|$)/);
    return m ? m[1] : (parsed.changeLogRaw ?? null);
  })();

  newRawFm = appendChangeLog(newRawFm, finalVer, changesMsg, BASELINE_DATE, reparsedRaw);

  const hasClAfter = true; // 我们刚追加了
  const clEntryMark = `${finalVer} / "${changesMsg.slice(0, 40)}..."`;

  if (!dryRun) {
    // 实际写盘
    const newContent = '---\n' + newRawFm + '\n---' + parsed.body;
    // 确保 rawFm 末尾没有多余的空行破坏格式
    const cleanRaw = newRawFm.endsWith('\n') ? newRawFm.slice(0, -1) : newRawFm;
    const finalContent = '---\n' + cleanRaw + '\n---' + parsed.body;
    fs.writeFileSync(rec.file, finalContent, 'utf8');
  }

  const issueMark = [
    rec.issues.A ? 'A' : '',
    rec.issues.B ? 'B' : '',
    rec.issues.C ? 'C' : '',
  ].join('');

  return {
    rel: rec.rel, tier: rec.tier, docId: rec.docId,
    issueMark, truthReason: truth.reason,
    before: { version: beforeVer, lastUpdated: beforeDate, codeVersion: beforeCV, hasChangeLog: beforeHasCl },
    after: {
      version: finalVer,
      lastUpdated: BASELINE_DATE,
      codeVersion: parsed.fm.code_version || DEFAULT_CODE_VERSION,
      hasChangeLog: hasClAfter, changeLogNewEntry: clEntryMark,
    },
    patchNote: buildPatchNote(truth.version, finalVer),
  };
}

// ============= main =============

const allFiles = walk(ROOT);
console.error(`[scan] 发现 ${allFiles.length} 个 MD 文件`);

const records: FileRecord[] = [];
const stats = {
  total: 0,
  withFm: 0,
  batch1: 0, batch2: 0, batch3: 0,
  noIssue: 0,
};

for (const fp of allFiles) {
  let content: string;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { continue; }
  const parsed = parseFrontmatter(content);
  const rel = path.relative(ROOT, fp);

  if (!parsed.hasFrontmatter) continue;
  stats.withFm++;

  const { issues, tier, docId } = detectIssuesAndAssign(parsed, rel);
  const truth = determineTruthVersion(parsed);
  const rec: FileRecord = {
    file: fp, rel, tier, docId, issues, truth, batch: null,
  };
  rec.batch = assignBatch(rec);
  records.push(rec);

  if (!issues.A && !issues.B && !issues.C) stats.noIssue++;
  if (rec.batch === 1) stats.batch1++;
  if (rec.batch === 2) stats.batch2++;
  if (rec.batch === 3) stats.batch3++;
}

console.error(`[classify] withFm=${stats.withFm} | noIssue=${stats.noIssue} | batch1=${stats.batch1} | batch2=${stats.batch2} | batch3=${stats.batch3}`);

if (BATCH_N === 1 && stats.batch1 > 250) {
  console.warn(`[warn] Batch 1 文件数 ${stats.batch1} > 250 阈值`);
}
if (BATCH_N === 2 && stats.batch2 > 250) {
  console.warn(`[warn] Batch 2 文件数 ${stats.batch2} > 250 阈值`);
}
if (BATCH_N === 3 && stats.batch3 > 250) {
  console.warn(`[warn] Batch 3 文件数 ${stats.batch3} > 250 阈值`);
}

const batchRecords = records.filter(r => r.batch === BATCH_N);
console.error(`[batch ${BATCH_N}] 选中 ${batchRecords.length} 份文档`);

const applied: Applied[] = [];
for (const rec of batchRecords) {
  try {
    const res = applyToFile(rec, DRY_RUN);
    if (res) applied.push(res);
  } catch (e: any) {
    console.error(`[error] ${rec.rel}: ${e?.message ?? String(e)}`);
  }
}

console.error(`[apply] ${DRY_RUN ? '(dry-run) 预览' : '实际写入'} ${applied.length} 份`);

// ============= report =============

function mdTable(headers: string[], rows: (string | number)[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n') + '\n';
}

const report: string[] = [];
report.push(`# 文档新鲜度基准校对 — 第 ${BATCH_N} 批 ${DRY_RUN ? '（DryRun 预览）' : '（实际写入）'}`);
report.push('');
report.push(`> **基准日**：${BASELINE_DATE}  `);
report.push(`> **批次规则**（R3 用户 2026-08-11 确认）：  `);
report.push(`> - Batch 1 = 全仓 A 类（双轨不一致，any tier）+ P0 tier 的 B/C 类（本批合计 ${stats.batch1} 份）  `);
report.push(`> - Batch 2 = 非 P0 tier 的 B 类（last_updated，共 ${stats.batch2}）  `);
report.push(`> - Batch 3 = 非 P0 tier 的 C 类（change_log，共 ${stats.batch3}）  `);
report.push(`> **本批处理**：${batchRecords.length} 份文档  `);
report.push(`> **PATCH 规则（R2 强制）**：先 R1 取真值 → 规范化为三位 → PATCH++  `);
report.push(``);

report.push(`## 一、批次执行摘要`);
report.push('');
report.push(mdTable(
  ['指标', '数值'],
  [
    ['批次号', BATCH_N],
    ['模式', DRY_RUN ? 'DryRun（不写盘）' : '实际写入'],
    ['本批文档数', applied.length],
    ['其中 A 类双轨不一致', applied.filter(a => a.issueMark.includes('A')).length],
    ['其中 B 类 last_updated', applied.filter(a => a.issueMark.includes('B')).length],
    ['其中 C 类 change_log', applied.filter(a => a.issueMark.includes('C')).length],
    ['P0 tier (important/T0)', applied.filter(a => isP0Tier(a.tier)).length],
    ['非 P0 tier', applied.filter(a => !isP0Tier(a.tier)).length],
  ]
));
report.push('');

report.push('## 二、R2 PATCH++ 分布（确认规范化是否正确）');
report.push('');
const patchSamples: (string | number)[][] = applied.slice(0, 30).map(a => [
  `\`${a.rel}\``,
  a.issueMark,
  a.truthReason,
  a.before.version,
  a.patchNote.split(' → [PATCH++] → ')[0].replace(/^.*→ \[R2补零\/规范化\] → /, ''),
  a.after.version,
]);
report.push(mdTable(
  ['文档', '问题类型', '真值来源', 'frontmatter 原值', 'R2规范化后（未PATCH）', '最终 PATCH++ 结果'],
  patchSamples,
));
if (applied.length > 30) report.push(`> （另 ${applied.length - 30} 条见完整表 §三）`);
report.push('');

report.push('## 三、完整变更前后对照（4 字段 + change_log 条目）');
report.push('');
report.push(mdTable(
  ['#', '文档', 'tier', '问题', 'B:version', 'A:version', 'B:last_updated', 'A:last_updated', 'B:hasCl', 'A:hasCl'],
  applied.map((a, i) => [
    i + 1, `\`${a.rel}\``, a.tier, a.issueMark,
    a.before.version, a.after.version,
    a.before.lastUpdated, a.after.lastUpdated,
    a.before.hasChangeLog ? '✅' : '❌', a.after.hasChangeLog ? '✅' : '❌',
  ])
));
report.push('');

report.push('## 四、真值来源分布（确认 R1 优先级是否合理）');
report.push('');
const reasonCount = new Map<string, number>();
for (const a of applied) {
  reasonCount.set(a.truthReason, (reasonCount.get(a.truthReason) ?? 0) + 1);
}
report.push(mdTable(
  ['真值来源（R1 优先级）', '文档数', '占比'],
  [...reasonCount.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => [
    r, n, `${((n / applied.length) * 100).toFixed(1)}%`,
  ])
));
report.push('');

report.push('## 五、下一待办');
report.push('');
report.push(`- 若本批 DryRun 清单无异议 → 执行 \`npx tsx scripts/fix/apply-doc-freshness-batch.ts --batch ${BATCH_N}\`（去掉 --dry-run）实际写入`);
report.push(`- 写入后立即跑三门禁：\`npm run audit:docs\` → \`npx tsx scripts/audit/audit-doc-freshness.ts\` → \`npm run audit:doc-integrity\``);
report.push(`- 确认全绿后，按相同流程启动第 ${BATCH_N + 1 <= 3 ? BATCH_N + 1 : 'done'} 批`);
report.push('');

report.push('---');
report.push(``);
report.push(`*生成时间：${new Date().toISOString()}  `);
report.push(`*脚本：scripts/fix/apply-doc-freshness-batch.ts（batch=${BATCH_N}, dryRun=${DRY_RUN}, baseline=${BASELINE_DATE}）*`);

const reportContent = report.join('\n');
if (OUT_FILE) {
  fs.writeFileSync(path.resolve(OUT_FILE), reportContent, 'utf8');
  console.error(`[report] 已写入: ${path.resolve(OUT_FILE)}`);
}

// 同时也写入 outputs/ 下带日期的默认路径
const defaultReportName = `doc-freshness-batch${BATCH_N}-${DRY_RUN ? 'dryrun-' : ''}${BASELINE_DATE}.md`;
const defaultReportPath = path.join(ROOT, 'outputs', defaultReportName);
if (!OUT_FILE || path.resolve(OUT_FILE) !== defaultReportPath) {
  fs.writeFileSync(defaultReportPath, reportContent, 'utf8');
}
console.log(`[report] 默认路径: ${defaultReportPath}`);

// 控制台摘要
console.log(`\n========== Batch ${BATCH_N} ${DRY_RUN ? 'DryRun' : 'APPLY'} 摘要 ==========`);
console.log(`处理文件数: ${applied.length}`);
console.log(`A:${applied.filter(a => a.issueMark.includes('A')).length}  B:${applied.filter(a => a.issueMark.includes('B')).length}  C:${applied.filter(a => a.issueMark.includes('C')).length}`);
console.log(`P0 tier: ${applied.filter(a => isP0Tier(a.tier)).length}  非 P0: ${applied.filter(a => !isP0Tier(a.tier)).length}`);
const truthLines = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]);
console.log(`真值来源: ${truthLines.map(([r, n]) => `${r}=${n}`).join(', ')}`);
console.log(`默认报告: ${defaultReportPath}`);
