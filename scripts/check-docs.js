// scripts/check-docs.js
// 检查文件系统规范：根目录白名单、docs/ 结构、测试文件位置

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const violations = [];

// 根目录白名单（允许存在的文件）
const ROOT_WHITELIST = new Set([
  'README.md', 'AGENTS.md', 'CHANGELOG.md', '.gitignore',
  'package.json', 'package-lock.json', 'index.html',
  'tsconfig.json', 'tsconfig.api.json', 'tsconfig.scripts.json', 'tsconfig.test.json',
  'vite.config.ts', 'playwright.config.ts',
  'eslint.config.js', 'eslint.colors.config.js',
  'postcss.config.js', 'tailwind.config.js',
  'api-extractor.json', 'cspell.json',
  '.npmrc', '.nvmrc', 'pip.conf',
  '.env.local', '.env.local.example', '.env.development.local',
  '.cursorrules', '.complexity-baseline.json', '.token-baseline.json',
  '.dependency-cruiser.js',
]);

// 根目录白名单目录（允许存在的目录）
const ROOT_DIR_WHITELIST = new Set([
  'src', 'tests', 'e2e', 'docs', 'scripts', 'public', 'packages',
  'plugins', 'prompts', 'python', 'temp', 'build-artifacts', 'releases',
  'outputs', 'coverage', 'dist', 'node_modules',
  '.git', '.github', '.husky', '.vscode',
  '.agents', '.trae', '.trae-cn', '.workbuddy', '.dbg', '.codebuddy',
  '.playwright-mcp', '.venv',
  'archive', 'code-quality-compliance', 'design-tokens', 'eslint-rules',
  'test-results', 'toolkit', 'tools',
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
    '00-meta', '01-requirements', '02-design', '03-development',
    '04-testing', '05-deployment', '06-project-management', '07-archive',
    'assets', 'playground', 'reports',
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
