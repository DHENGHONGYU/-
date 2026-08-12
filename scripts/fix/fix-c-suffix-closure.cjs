/**
 * A 类后缀同步后，change_log 闭环修复
 *
 * 背景：fix-a-suffix-sync.cjs 将 22 份文档的 FM version 升为带阶段后缀版本
 *       （如 v0.9.0 → v0.9.0-docs-review），但 change_log 最新条目仍是 v0.9.0，
 *       导致 detect 报 C 类闭环失败。
 *
 * 处理：将这 22 份文档 change_log 中的版本条目同步为 FM 当前版本（仅更新
 *       version 字段，保留原 changes/date），实现闭环。
 *
 * 用法：
 *   node scripts/fix/fix-c-suffix-closure.cjs --dry-run
 *   node scripts/fix/fix-c-suffix-closure.cjs
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');
const ROOT = process.cwd();

// 与 fix-a-suffix-sync.cjs 的 22 份后缀类完全对应（不含 3 份简写类）
const TARGETS = [
  'docs/explanation/2026-06-24-pool-screening-signal-persistence-review-engine.md',
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
  'docs/reference/v9-input-cabin-strategy-report.md',
];

function getFmVersion(content) {
  const m = content.match(/^version:\s*([^\n]+)/m);
  return m ? m[1].trim() : null;
}

// 更新 change_log 内首个 version 条目为 fmVersion（保留 changes/date）
function syncChangeLog(content, fmVersion) {
  const lines = content.split('\n');
  let inCl = false;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inCl) {
      // change_log 条目内首个 version 行
      if (/^\s*-?\s*version:\s*/i.test(line) && !replaced) {
        lines[i] = line.replace(/version:\s*.*/i, `version: ${fmVersion}`);
        replaced = true;
      }
      // 遇到新的顶层字段，退出 change_log
      if (/^[A-Za-z_][\w]*:\s*/.test(line) && !/^(\s*-|version:|changes:|date:)/.test(line)) break;
    }
    if (/^change_log:\s*/.test(line)) inCl = true;
  }
  return replaced ? lines.join('\n') : null;
}

let changed = 0;
const changedFiles = [];

for (const rel of TARGETS) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.log(`[skip] 不存在: ${rel}`); continue; }
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { continue; }
  const fmVersion = getFmVersion(content);
  if (!fmVersion) { console.log(`[skip] 无 FM version: ${rel}`); continue; }

  const newContent = syncChangeLog(content, fmVersion);
  if (!newContent) { console.log(`[skip] change_log 无 version 条目: ${rel}`); continue; }

  changed++;
  changedFiles.push({ rel, fmVersion });

  if (DRY_RUN) {
    console.log(`[dry] ${rel}: change_log → ${fmVersion}`);
  } else {
    fs.writeFileSync(fp, newContent);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`同步 ${changed} 份`);
for (const f of changedFiles) console.log(`  - ${f.rel}: change_log → ${f.fmVersion}`);
