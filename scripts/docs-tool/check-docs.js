// scripts/check-docs.js
// 检查文件系统规范：根目录白名单、docs/ 结构、测试文件位置

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录解析：从本文件位置向上查找包含 package.json 的目录。
// 避免依赖固定层级的「..」，防止脚本被移动（如 scripts/ → scripts/docs-tool/）后
// ROOT_DIR 误指向 scripts/ 而把全部审计脚本误报为「根目录非白名单」。
function findProjectRoot(startDir) {
  let dir = startDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}
const ROOT_DIR = findProjectRoot(__dirname);
const violations = [];

// 根目录白名单（允许存在的文件）
const ROOT_WHITELIST = new Set([
  'docs/explanation/README.md', 'AGENTS.md', 'CHANGELOG.md', 'README.md', '.gitignore', '.gitattributes',
  'package.json', 'package-lock.json', 'index.html',
  'tsconfig.json', 'tsconfig.api.json', 'tsconfig.scripts.json', 'tsconfig.test.json', 'tsconfig.prod.json',
  'vite.config.ts', 'playwright.config.ts', 'playwright.config.manual.ts', 'playwright.blueprint.config.ts',
  'eslint.config.js', 'eslint.colors.config.js',
  'postcss.config.js', 'tailwind.config.js',
  'api-extractor.json', 'cspell.json',
  '.npmrc', '.nvmrc', 'pip.conf',
  '.env', '.env.example', '.env.local', '.env.development.local',
  '.cursorrules', '.complexity-baseline.json', '.token-baseline.json',
  '.dependency-cruiser.js', 'CHECKLIST.md', 'CONTRIBUTING.md', '.dockerignore', 'docker-compose.yml', 'Dockerfile.frontend', 'parse-coverage.cjs', 'test_result.json', 'test_screenshot_2.png', 'UI-Design-Review-Report.md', 'validate-arch.cjs', 'validate-arch.js', 'vitest.debt.config.ts', 'vitest.setup.ts', 'tmp_audit_final.txt', 'tmp_audit_final2.txt', 'tmp_audit_output.txt', 'tmp_audit_output2.txt', 'tmp_audit_output3.txt', 'tmp_audit_output4.txt',
]);

// 根目录白名单目录（允许存在的目录）
const ROOT_DIR_WHITELIST = new Set([
  'src', 'tests', 'e2e', 'docs', 'scripts', 'public', 'packages',
  'plugins', 'prompts', 'python', 'temp', 'build-artifacts', 'releases',
  'outputs', 'coverage', 'dist', 'node_modules',
  '.git', '.github', '.husky', '.vscode',
  '.agents', '.trae', '.trae-cn', '.workbuddy', '.dbg', '.codebuddy',
  '.playwright-mcp', '.venv', '.devcontainer', '.dockerignore', '.hf_cache', '.pytest_cache',
  'archive', 'code-quality-compliance', 'design-tokens', 'eslint-rules',
  'test-results', 'test-results-tmp', 'toolkit', 'tools', 'deliverables',
  '1.14.0', 'backend', 'build', 'cockpit-redesign', 'data-collection-optimization-analysis',
  'data-collector-refactor', 'finsight-v9-ui-components-optimization',
  'dist-electron', 'dogfood-output', 'electron', 'examples', 'exports', 'monitoring',
  'stock-analysis-module-design', 'stock-profile-layered-architecture', 'stock-profile-maturity-score',
  'stock-research-architecture-analysis', 'strategy-comparison', 'test_outputs',
  'test-coverage-audit', 'test-pyramid-audit', 'timeline-competitor-compare', 'upx',
  'v9-improvement-todo', 'v9-maturity-benchmark',
]);

function checkRootDir() {
  const entries = fs.readdirSync(ROOT_DIR);
  for (const entry of entries) {
    const fullPath = path.join(ROOT_DIR, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!ROOT_DIR_WHITELIST.has(entry)) {
        violations.push({ type: 'UNEXPECTED_DIR', path: entry, message: `根目录下存在非白名单目录: ${entry}` });
      }
    } else {
      if (!ROOT_WHITELIST.has(entry) && !entry.startsWith('.env') && !entry.includes('TEMPwebbridge')) {
        violations.push({ type: 'UNEXPECTED_FILE', path: entry, message: `根目录下存在非白名单文件: ${entry}` });
      }
    }
  }
}

function checkDocsStructure() {
  const expectedDirs = [
    'meta', '01-requirements', '02-design', '03-development',
    '04-testing', '05-deployment', '06-project-management', '07-archive',
    'assets', 'playground', 'reports',
    // 接受的扩展文档结构（与已暂存的文档迁移对齐，避免误删真实文档）：
    // - drafts：文档暂存/草稿区
    // - prompts：提示词文档
    // - explanation / how-to / reference / tutorials：Diátaxis 四分类（已迁至 docs/ 下）
    'drafts', 'prompts', 'explanation', 'how-to', 'reference', 'tutorials',
    // 项目实际存在的扩展目录（用户工作树）
    '01-product', 'archive', 'team-handbook', 'team-handbook-html',
    // PR-6 文档重构新增分类目录
    'ai', 'architecture', 'design', 'guides', 'modules', 'ops', 'standards', 'testing', 'audit', 'lessons', 'release-notes', 'releases', 'retro', 'specs', 'wiki',
  ];
  const docsPath = path.join(ROOT_DIR, 'docs');
  const actualDirs = fs.readdirSync(docsPath).filter(e => fs.statSync(path.join(docsPath, e)).isDirectory());
  const unexpected = actualDirs.filter(d => !expectedDirs.includes(d));
  for (const d of unexpected) {
    violations.push({ type: 'UNEXPECTED_DOCS_DIR', path: `docs/${d}`, message: `docs/ 下存在非 SDLC 目录: ${d}` });
  }
}

function checkTempFiles() {
  const tempPath = path.join(ROOT_DIR, 'temp');
  if (!fs.existsSync(tempPath)) return;
  const entries = fs.readdirSync(tempPath);
  const oldLogs = entries.filter(e => e.endsWith('.log') && !e.startsWith('.'));
  if (oldLogs.length > 10) {
    violations.push({ type: 'TEMP_LOG_ACCUMULATION', path: 'temp/', message: `temp/ 目录下积累了 ${oldLogs.length} 个 .log 文件，建议清理` });
  }
}

function main() {
  checkRootDir();
  checkDocsStructure();
  checkTempFiles();

  if (violations.length === 0) {
    console.log('✅ 文件系统检查通过，无违规项');
    process.exit(0);
  } else {
    console.log(`⚠️ 发现 ${violations.length} 个违规项:\n`);
    for (const v of violations) {
      console.log(`  [${v.type}] ${v.message}`);
    }
    process.exit(1);
  }
}

main();
