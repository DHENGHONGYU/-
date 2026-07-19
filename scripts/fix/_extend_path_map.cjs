// 批量修复 BASENAME_UNIQUE 类的断裂引用
// 目标：1) 模板路径 2) 路径重复类 3) 路径反斜杠
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// 读取审计报告
const data = JSON.parse(fs.readFileSync('scripts/docs/reports/audit/audit-doc-code-references-2026-07-15T22-39-26-161Z.json', 'utf-8'));
const br = data.brokenReferences.filter(b => b.type === 'doc-to-doc');
console.log('Total d2d broken:', br.length);

// 加载 doc-ref-path-map.json
const mapPath = 'scripts/config/doc-ref-path-map.json';
const pathMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

// 扩展 path-map
const additions = {
  // basename-only 模板（指向prompts/）
  'prompts/system-prompt-template.md': 'prompts/system-prompt-template.md',
  'prompts/component-prompt-template.md': 'prompts/component-prompt-template.md',
  'prompts/service-prompt-template.md': 'prompts/service-prompt-template.md',
  'prompts/store-prompt-template.md': 'prompts/store-prompt-template.md',
  'prompts/types-prompt-template.md': 'prompts/types-prompt-template.md',
  // 路径重复/反斜杠类（手动指定）
  '../../reports/audit/../v9-架构缺陷与整改行动清单.md': 'docs/explanation/v9-架构缺陷与整改行动清单.md',
  'docs/cockpit/data-definition.md': 'docs/reference/cockpit/data-definition.md',
  'docs\\cockpit\\data-definition.md': 'docs/reference/cockpit/data-definition.md',
  'docs/news/data-definition.md': 'docs/reference/news-data-definition.md',
  'docs\\news\\data-definition.md': 'docs/reference/news-data-definition.md',
  // 路径错乱（带前缀）
  'ai-center-../reference/data-definition.md': 'docs/explanation/design/data-definition.md',
  'BACKTEST_../reference/data-definition.md': 'docs/explanation/design/data-definition.md',
  'dataflow-../reference/data-definition.md': 'docs/explanation/design/data-definition.md',
  'NEWS_../reference/data-definition.md': 'docs/explanation/design/data-definition.md',
  'ai-center-data-definition.md': 'docs/reference/ai-center-data-definition.md',
  'docs/cockpit/data-definition.md': 'docs/reference/cockpit/data-definition.md',
  'docs/news/data-definition.md': 'docs/reference/news-data-definition.md',
  'cockpit-data-definition.md': 'docs/reference/cockpit/data-definition.md',
  'news-data-definition.md': 'docs/reference/news-data-definition.md',
};

let added = 0;
for (const [k, v] of Object.entries(additions)) {
  if (!pathMap.docPathMap[k]) {
    pathMap.docPathMap[k] = v;
    added++;
  }
}

// 写回
fs.writeFileSync(mapPath, JSON.stringify(pathMap, null, 2), 'utf-8');
console.log('Added', added, 'new entries to docPathMap');
console.log('docPathMap total entries:', Object.keys(pathMap.docPathMap).length);
