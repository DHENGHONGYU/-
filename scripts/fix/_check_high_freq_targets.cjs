// 分析doc-to-doc断裂引用高频目标
const fs = require('fs');
const path = require('path');

const ROOT = 'g:\\FinSightV9';
const targets = [
  'NewsPage-迁移事项确认.md',
  'NewsPage-PoC验证报告.md',
  'DECISIONS.md',
  'V6Pro_整体架构梳理_v3.md',
  'dual-strategy-divergence-list.md',
  'V6-V9迁移最佳实践指南.md',
  'ui-module-alignment.md',
  'v9-issue-resolution-schedule.md',
  'trade_review_ai_report.md',
  'report-1-architecture-health.md',
  'v6-news-page-assets.md',
  '01-intro.md',
  'redundant-stores-supplementary-verification.md',
  'v9核心数据字典与类型定义（整合版）.md',
  'silent-fallback-fix-report.md',
  '.github/pull_request_template.md',
  'how-to-add-page.md',
  'type-evolution-guide.md',
  'react-lifecycle-patterns.md',
  'service-subdomain-overview.md',
  'v9-issue-execution-board.md',
  'V6Pro_整体架构梳理_v3.md',
  'NewsPage-迁移事项确认.md',
  'docs/reference/v9核心数据字典与类型定义(整合版).md',
];

function walk(dir, res = []) {
  if (!fs.existsSync(dir)) return res;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'coverage', '.husky'].includes(e.name)) continue;
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

const map = new Map();
all.forEach(f => {
  const b = path.basename(f);
  if (!map.has(b)) map.set(b, []);
  map.get(b).push(f.replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/') + '/', ''));
});

targets.forEach(t => {
  const m = map.get(t);
  if (m) console.log(`✓ ${t}: ${m.length}  [${m.slice(0, 3).join(', ')}]`);
  else console.log(`✗ ${t}: NOT FOUND`);
});
