#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(process.cwd());
const args = process.argv.slice(2);
const dryRun = !args.includes('--force');

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const existingScripts = Object.keys(pkg.scripts || {});

const orphanScripts = [
  'scripts/_verify-pipeline-child.ts',
  'scripts/_audit-pipeline.ts',
  'scripts/workflow-rule-engine.ts',
  'scripts/verify-pipeline-output.ts',
  'scripts/verify-design-tokens.ts',
  'scripts/verify-all-routes.ts',
  'scripts/validate-json.ts',
  'scripts/validate-data-consistency.ts',
  'scripts/validate-data-blueprint.ts',
  'scripts/validate-acl-impact.ts',
  'scripts/translate-test-descriptions.ts',
  'scripts/token-scan.cjs',
  'scripts/token-debug.cjs',
  'scripts/token-debug-size.cjs',
  'scripts/token-debug-hex.cjs',
  'scripts/test-stock-color-debug.ts',
  'scripts/test-news-v6.cjs',
  'scripts/test-hybrid-proofread.ts',
  'scripts/system-health-dashboard.ts',
  'scripts/system-check-loop.ts',
  'scripts/split-constants.ts',
  'scripts/replace-date-now-ids.ts',
  'scripts/regression_news_v6_test.cjs',
  'scripts/regression-test.mjs',
  'scripts/quick-query.sh',
  'scripts/query-ai-memory.ts',
  'scripts/quality-config.ts',
  'scripts/pre-review-check.ts',
  'scripts/optimize-silent-fallback.ts',
  'scripts/measure-complexity-now.ts',
  'scripts/lessons-learned.ts',
  'scripts/inject-frontmatter.ts',
  'scripts/generate-tokens.ts',
  'scripts/generate-tech-debt-report.ts',
  'scripts/generate-store-graph.ts',
  'scripts/generate-pdf-report.ts',
  'scripts/fix-silent-fallback.ts',
  'scripts/fix-layer-violations.ts',
  'scripts/extract-violations.cjs',
  'scripts/extract-code-graph.ts',
  'scripts/eslint-plugin-no-hardcoded-colors.js',
  'scripts/doc-version-history.ts',
  'scripts/doc-update-trigger.ts',
  'scripts/doc-freshness-score.ts',
  'scripts/doc-cross-ref-sync.ts',
  'scripts/detect-duplicate-tests.ts',
  'scripts/dedup-jsdoc.ts',
  'scripts/daily-doc-validation.ts',
  'scripts/daily-doc-validation.mock.ts',
  'scripts/create-mcp-server.ts',
  'scripts/codeQualityAudit.cjs',
  'scripts/check-types.sh',
  'scripts/changelog-query.ts',
  'scripts/build-health-report.ts',
  'scripts/build-ai-memory-index.ts',
  'scripts/batch-test-runner.sh',
  'scripts/auto-fix-jsdoc.ts',
  'scripts/audit-visual.ts',
  'scripts/audit-typography.ts',
  'scripts/audit-token-consumption.ts',
  'scripts/audit-tests.ts',
  'scripts/audit-split-quality.ts',
  'scripts/audit-spacing.ts',
  'scripts/audit-reserved-stores.ts',
  'scripts/audit-registry.ts',
  'scripts/audit-mcp.ts',
  'scripts/audit-mapping-integrity.ts',
  'scripts/audit-layer-calls.ts',
  'scripts/audit-jsdoc.ts',
  'scripts/audit-inline-colors.ts',
  'scripts/audit-hardcode.ts',
  'scripts/audit-execution-paths.ts',
  'scripts/audit-doc-sync.ts',
  'scripts/audit-dead-code.ts',
  'scripts/audit-component-usage.ts',
  'scripts/audit-color-tokens.ts',
  'scripts/audit-batch-c-scanner.ts',
  'scripts/audit-atomic.ts',
  'scripts/anomaly-detector.ts',
  'scripts/analyze-code-graph.cjs',
  'scripts/a11y-contrast.cjs',
];

function generateScriptName(filePath) {
  const basename = path.basename(filePath);
  const nameWithoutExt = basename.replace(/\.(ts|js|cjs|mjs|sh)$/, '');
  
  const prefixMap = {
    'audit-': 'audit:',
    'verify-': 'verify:',
    'validate-': 'validate:',
    'generate-': 'generate:',
    'build-': 'build:',
    'fix-': 'fix:',
    'extract-': 'extract:',
    'detect-': 'detect:',
    'auto-fix-': 'auto:',
    'test-': 'test:',
    'system-': 'system:',
    'doc-': 'doc:',
    'daily-doc-': 'daily-doc:',
    'codeQuality': 'audit:code-quality',
    'query-': 'query:',
    'create-': 'create:',
    'changelog-': 'changelog:',
    'lessons-': 'lessons:',
    'pre-review': 'pre-review',
    'optimize-': 'optimize:',
    'measure-': 'measure:',
    'inject-': 'inject:',
    'split-': 'split:',
    'replace-': 'replace:',
    'regression': 'regression:',
    'translate-': 'translate:',
    'quality-': 'quality:',
    'token-': 'token:',
    'a11y-': 'a11y:',
    'dedup-': 'dedup:',
    'analyze-': 'analyze:',
    '_verify-pipeline-child': 'pipeline:verify-child',
    '_audit-pipeline': 'pipeline:audit',
  };

  for (const [prefix, mappedPrefix] of Object.entries(prefixMap)) {
    if (nameWithoutExt.startsWith(prefix)) {
      const suffix = nameWithoutExt.slice(prefix.length);
      const camelCase = suffix.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return `${mappedPrefix}${camelCase}`;
    }
  }

  const camelCase = nameWithoutExt.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return `script:${camelCase}`;
}

function generateCommand(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.ts') {
    return `tsx ${filePath}`;
  } else if (ext === '.cjs') {
    return `node ${filePath}`;
  } else if (ext === '.mjs') {
    return `node ${filePath}`;
  } else if (ext === '.js') {
    return `node ${filePath}`;
  } else if (ext === '.sh') {
    return `bash ${filePath}`;
  }
  return `tsx ${filePath}`;
}

console.log(`========================================`);
console.log(`         📝 自动注册脚本工具`);
console.log(`========================================`);
console.log(`模式: ${dryRun ? '🔍 预览模式 (--force 强制执行)' : '✅ 执行模式'}`);
console.log(`\n--- 分析未注册脚本 ---`);

const newScripts = {};
let skippedCount = 0;

orphanScripts.forEach(file => {
  const scriptName = generateScriptName(file);
  
  if (existingScripts.includes(scriptName)) {
    skippedCount++;
    return;
  }
  
  const command = generateCommand(file);
  newScripts[scriptName] = command;
});

console.log(`📊 未注册脚本总数: ${orphanScripts.length}`);
console.log(`📊 已存在脚本: ${skippedCount}`);
console.log(`📊 将新增脚本: ${Object.keys(newScripts).length}`);

if (Object.keys(newScripts).length > 0) {
  console.log(`\n--- 新增脚本清单 ---`);
  Object.entries(newScripts).forEach(([name, cmd]) => {
    console.log(`  ${name}: ${cmd}`);
  });
}

if (!dryRun) {
  console.log(`\n--- 写入 package.json ---`);
  
  Object.entries(newScripts).forEach(([name, cmd]) => {
    pkg.scripts[name] = cmd;
  });
  
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  console.log(`✅ 成功新增 ${Object.keys(newScripts).length} 个脚本`);
  console.log(`\n📊 更新后脚本总数: ${Object.keys(pkg.scripts).length}`);
} else {
  console.log(`\n💡 使用 --force 参数执行实际注册:`);
  console.log(`   node file-management-system/scripts/auto-register-scripts.js --force`);
}

console.log(`\n========================================`);
process.exit(0);