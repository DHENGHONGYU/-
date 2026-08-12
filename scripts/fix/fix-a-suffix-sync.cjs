/**
 * A 类后缀/简写版本同步治理
 *
 * 背景：现有 fix-closure-true-value.cjs 的 semverCmp 仅比较数字部分，忽略后缀，
 *       导致两类 A 类双轨不一致无法处理：
 *   (1) FM `v0.9.0` vs 正文带阶段后缀 `v0.9.0-docs-review` / `-migration-implemented`
 *       / `-strategy-review` —— 正文后缀标识了文档真实所处阶段，FM 丢失该信息。
 *   (2) FM `v1.0.0` vs 正文简写 `v1.0` —— 仅格式简写差异，语义等价。
 *
 * 治理原则（仅升不降、保留语义）：
 *   - (1) 后缀类：FM version 同步为正文完整版本（含后缀）。
 *   - (2) 简写类：正文 `vX.Y` 规范化为 `vX.Y.0`（以 FM 三位格式为准）。
 *
 * 用法：
 *   node scripts/fix/fix-a-suffix-sync.cjs --dry-run
 *   node scripts/fix/fix-a-suffix-sync.cjs
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');
const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '.venv', 'venv', '__pycache__', '.hf_cache', 'outputs', '.trae', 'deliverables']);

// 只处理当前 detect 报告的 25 份 A 类（精确定位，避免误改其他文档）
const TARGETS = [
  'docs/explanation/2026-06-24-pool-screening-signal-persistence-review-engine.md',
  'docs/explanation/design/color-token-consolidation-feasibility.md',
  'docs/explanation/design/implementation-governance.md',
  'docs/explanation/implementation/adr/2026-06-20-indexeddb-over-localstorage.md',
  'docs/explanation/implementation/adr/2026-06-20-pure-frontend-architecture.md',
  'docs/explanation/implementation/adr/2026-06-21-databridge-over-direct-datalayer.md',
  'docs/explanation/implementation/adr/2026-06-21-hashrouter-for-static-hosting.md',
  'docs/explanation/implementation/adr/2026-06-23-portalshell-dark-kimi-layout.md',
  'docs/explanation/implementation/adr/2026-06-24-input-cabin-subpages.md',
  'docs/explanation/implementation/adr/2026-06-24-pool-screening-signal-persistence-review-engine.md',
  'docs/explanation/implementation/adr/2026-06-25-v6-migration.md',
  'docs/explanation/implementation/agent-runtime-spec.md',
  'docs/explanation/implementation/data-collection-architecture.md',
  'docs/explanation/implementation/data-interaction-protocols.md',
  'docs/explanation/implementation/dataflow-engine-spec.md',
  'docs/explanation/implementation/implementation-governance.md',
  'docs/explanation/implementation/input-cabin-spec.md',
  'docs/explanation/implementation/quality-gates-baseline.md',
  'docs/explanation/implementation/rotation-score-spec.md',
  'docs/reference/2026-06-21-hashrouter-for-static-hosting.md',
  'docs/reference/agent-runtime-spec.md',
  'docs/reference/fourth-industrial-revolution-core-resource-strategy.md',
  'docs/reference/ui-remediation-tracker.md',
  'docs/reference/v9-input-cabin-strategy-report.md',
  'docs/reports/release-management/buildscoredocdiff-rollback-plan_release-management.md',
];

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

// 提取正文版本声明（兼容带后缀 / 无 v 前缀 / 两位版号）
function extractBodyVersion(body) {
  const patterns = [
    /^\s*>\s*\*\*(?:版本|Version)\*\*\s*[:：]\s*((?:v)?\d+(?:\.\d+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m,
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
  const re = /(^>\s*\*\*(?:版本|Version)\*\*\s*[:：]\s*)((?:v)?\d+(?:\.\d+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m;
  if (re.test(body)) return body.replace(re, `$1${newVer}`);
  return null;
}

// 规范化：`vX.Y` → `vX.Y.0`；`X.Y.Z` → 补 v 前缀
function normalizeVersion(raw) {
  let v = raw.trim();
  if (!/^v/i.test(v)) v = 'v' + v;
  const m = v.match(/^v(\d+)\.(\d+)(?:\.(\d+))?(.*)$/);
  if (!m) return v;
  const [, maj, min, patch, suffix] = m;
  const p = patch || '0';
  return `v${maj}.${min}.${p}${suffix || ''}`;
}

let changed = 0;
const changedFiles = [];

for (const rel of TARGETS) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log(`[skip] 不存在: ${rel}`); continue; }
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { console.log(`[skip] 读取失败: ${rel}`); continue; }
  const parsed = parseFrontmatter(content);
  if (!parsed) { console.log(`[skip] 无 frontmatter: ${rel}`); continue; }

  const fmVer = parsed.fm.version;
  const bodyVer = extractBodyVersion(parsed.body);
  if (!bodyVer) { console.log(`[skip] 正文无版本声明: ${rel}`); continue; }

  const bodyNorm = normalizeVersion(bodyVer);
  const fmNorm = normalizeVersion(fmVer);
  const bodyCore = bodyNorm.split('-')[0];
  const fmCore = fmNorm.split('-')[0];

  let newFm = parsed.rawFm;
  let newBody = parsed.body;
  let action = null;

  if (bodyCore === fmCore && bodyNorm === fmNorm && bodyVer !== bodyNorm) {
    // 简写差异：正文 `v1.0` vs FM `v1.0.0` → 正文规范化为三位
    const r = rewriteBodyVersion(newBody, bodyNorm);
    if (r) newBody = r;
    action = `正文 ${bodyVer} → ${bodyNorm}（简写规范化，FM=${fmVer} 保持不变）`;
  } else if (bodyCore === fmCore && bodyNorm !== fmNorm) {
    // 后缀类：核心数字相同但正文带阶段后缀 → FM 升为正文完整版本
    newFm = rewriteFmVersion(newFm, bodyNorm);
    action = `FM ${fmVer} → ${bodyNorm} (正文 ${bodyVer} 规范化${bodyVer === bodyNorm ? '' : '→' + bodyNorm})`;
  } else {
    // 无法自动归约（真值模糊），跳过待人工
    action = `[人工] FM ${fmVer} vs 正文 ${bodyVer}：核心版本不同，跳过`;
  }

  if (!action || action.startsWith('[人工]')) {
    if (action) console.log(`[${action}]: ${rel}`);
    continue;
  }

  const newContent = '---\n' + newFm + '\n---' + newBody;
  changed++;
  changedFiles.push({ rel, fmVer, bodyVer, bodyNorm, action });

  if (DRY_RUN) {
    console.log(`[dry] ${rel}: ${action}`);
  } else {
    fs.writeFileSync(fp, newContent);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`需同步 ${changed} 份`);
for (const f of changedFiles) console.log(`  - ${f.rel}: ${f.action}`);
