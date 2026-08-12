/**
 * P0 阻断级文档三件套补全（version + last_updated + change_log）
 *
 * 针对 19 份 P0 文档：FM 极简型（无 version/last_updated/change_log，或部分缺失）。
 * 补全规则：
 *   - version：取 body 版本声明（**Version/版本**）为真值；无则用 FM 现有；再无则 v1.0.0
 *   - last_updated：取 body **Last Updated/日期**；无则 change_log 日期；再无则基准日
 *   - change_log：若无有效条目，补一条当前版本条目
 *
 * 用法：
 *   node scripts/fix/fix-p0-trio.cjs --dry-run
 *   node scripts/fix/fix-p0-trio.cjs
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');
const BASELINE_DATE = '2026-08-11';
const ROOT = process.cwd();

const TARGETS = [
  'docs/guides/08-implementation-plan.md',
  'docs/guides/how-to/COLOR-TOKEN-GUIDE.md',
  'docs/guides/how-to/FILE-MANAGEMENT-GUIDE.md',
  'docs/guides/how-to/mcp-acl-guide.md',
  'docs/guides/how-to/MCP-LIFECYCLE-GUIDE.md',
  'docs/guides/how-to/testing/completeness-profile-batch2.md',
  'docs/guides/how-to/visual-regression-guide.md',
  'docs/reference/design-tokens.md',
  'docs/reference/prompts/autonomous-workflow-user-guide.md',
  'docs/reference/scoring-contract.md',
  'docs/release-notes/RELEASE-NOTES-dark-mode-optimization.md',
  'docs/reports/CHANGELOG.md',
  'docs/reports/testing/e2e-test-expansion-plan.md',
  'docs/reports/testing/performance-baseline.md',
  'docs/reports/testing/unit-test-repair-roadmap.md',
  'docs/specs/architecture/adr-010-cockpit-command-cross-layout.md',
  'docs/specs/architecture/cockpit-command-blueprint.md',
  'docs/specs/product/competitive-analysis.md',
  'docs/specs/product/data-security-and-privacy.md',
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

function extractBodyVersion(body) {
  let m = body.match(/^\s*>\s*\*\*(?:版本|Version)\*\*\s*[:：]\s*(v?[\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m);
  if (m) return m[1];
  m = body.match(/^\s*>\s*\*\*(?:版本|Version)\*\*\s*[:：]\s*([\d]+(?:\.[\d]+){1,2}(?:-[a-zA-Z0-9._-]+)?)/m);
  if (m) return m[1];
  return null;
}

function extractBodyDate(body) {
  let m = body.match(/^\s*>\s*\*\*(?:Last Updated|最新更新|最后更新|日期)\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/m);
  if (m) return m[1];
  return null;
}

function parseChangeLogDate(raw) {
  if (!raw) return null;
  const m = raw.match(/date:\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
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
    // 插在 change_log 之前
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
  let clStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^change_log:\s*$/.test(lines[i])) { clStart = i; break; }
    if (lines[i].startsWith('change_log:')) { clStart = i; break; }
  }
  const entry = [
    `change_log:`,
    `  - version: ${version}`,
    `    changes: "P0 版本闭环(${BASELINE_DATE})：补全 change_log 初始条目"`,
    `    date: ${date}`,
  ];
  if (clStart === -1) {
    const clean = lines.filter(l => l.trim().length > 0);
    return clean.concat(entry).join('\n');
  }
  // 已有 change_log 行：若为有效块则跳过（此处仅补缺失）
  return lines.join('\n');
}

let changed = 0;
for (const rel of TARGETS) {
  const fp = path.join(ROOT, rel);
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { console.log(`[skip-missing] ${rel}`); continue; }
  const parsed = parseFrontmatter(content);
  if (!parsed) { console.log(`[skip-nofm] ${rel}`); continue; }

  const bodyVer = extractBodyVersion(parsed.body);
  const bodyDate = extractBodyDate(parsed.body);
  const clDate = parseChangeLogDate(parsed.fm.change_log_raw);

  // 真值版本
  let ver = parsed.fm.version;
  if (!ver && bodyVer) ver = bodyVer;
  if (!ver) ver = 'v1.0.0';
  // 归一：若无 v 前缀补 v
  if (!/^v/i.test(ver)) ver = 'v' + ver;

  // 日期
  let date = parsed.fm.last_updated;
  if (!date && bodyDate) date = bodyDate;
  if (!date && clDate) date = clDate;
  if (!date) date = BASELINE_DATE;

  let rawFm = parsed.rawFm;
  // 补 version
  if (!parsed.fm.version) rawFm = upsertField(rawFm, 'version', ver);
  // 补 last_updated
  if (!parsed.fm.last_updated) rawFm = upsertField(rawFm, 'last_updated', date);
  // 补 change_log
  if (!hasValidChangeLog(parsed.fm.change_log_raw)) rawFm = appendChangeLogBlock(rawFm, ver, date);

  changed++;
  if (DRY_RUN) {
    console.log(`[dry] ${rel}: +version=${ver} +last_updated=${date} +change_log`);
  } else {
    fs.writeFileSync(fp, '---\n' + rawFm + '\n---' + parsed.body);
  }
}
console.log(`\n========== 摘要 ==========`);
console.log(`${DRY_RUN ? '预览' : '写入'} P0 三件套补全: ${changed} 份`);