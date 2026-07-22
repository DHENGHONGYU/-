#!/usr/bin/env node
'use strict';
/*
 * env-path-guard.cjs
 * 扫描项目里写死的 Windows 用户目录绝对路径（C:/Users/<user>/...），
 * 使其对多用户机器可移植。挂到 husky pre-commit，任何带用户路径的提交直接拦截。
 *
 * 用法:
 *   node scripts/env-path-guard.cjs              # 本地查看报告
 *   node scripts/env-path-guard.cjs --ci         # CI/门禁模式，发现问题返回 exit 1
 *   node scripts/env-path-guard.cjs --ci --staged # 仅扫描 git 暂存区文件（推荐用于 pre-commit）
 *   node scripts/env-path-guard.cjs --json       # JSON 输出
 *   node scripts/env-path-guard.cjs --verbose    # 详细输出
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const ROOT = args.find(a => !a.startsWith('-')) || process.cwd();
const VERIFY = args.includes('--verify-current');
const JSON_OUT = args.includes('--json');
const VERBOSE = args.includes('--verbose');
const CI = args.includes('--ci');
const STAGED = args.includes('--staged');

/* ---------- Step 0: 当前用户（环境优先） ---------- */
function detectCurrentUser() {
  const candidates = [process.env.USERPROFILE, process.env.HOME, os.homedir()];
  for (const c of candidates) {
    if (!c) continue;
    const m = String(c).match(/[\\/]Users[\\/]([^\\/]+)/i);
    if (m) return m[1];
  }
  return process.env.USERNAME || process.env.USER || '(unknown)';
}
const currentUser = detectCurrentUser();

/* ---------- 扫描范围 ---------- */
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'coverage', 'archive', 'cache', 'outputs',
  'releases', 'e2e', '.git', '__pycache__', '.workbuddy-backup',
  'node_modules.bin', '.venv', 'venv', '.tox',
  // 本地运行时 / 工具目录（写死路径常见，但不在 VCS 内或属生成物）
  '.trae', '.trae-cn', '.workbuddy', '.playwright-mcp',
  // 产物输出目录
  'deliverables', 'test-results', 'e2e-test-report',
  // 自动生成索引（包含历史路径引用）
  'ai-index',
]);
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.md', '.py', '.ps1',
  '.bat', '.sh', '.yaml', '.yml', '.toml', '.txt', '.csv', '.html', '.css',
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 40000;

// 用户目录绝对路径：覆盖 单/双反斜杠 与 正斜杠
const USER_PATH_RE = /([A-Za-z]):[\\/]+Users[\\/]+([A-Za-z0-9_.\-]+)(?=[\\/]|\s|"|'|$)/g;

const findings = [];
let fileCount = 0;
let skipCount = 0;

function shouldSkip(name, relParts) {
  if (SKIP_DIRS.has(name)) return true;
  if (relParts.length) {
    const top = relParts[0];
    if (top.startsWith('_ref') || top.startsWith('docs-backup')) return true;
  }
  return false;
}

function scanFile(full, rel) {
  const ext = path.extname(full).toLowerCase();
  if (!TEXT_EXT.has(ext)) return false;
  let st;
  try { st = fs.statSync(full); } catch (_) { return false; }
  if (st.size > MAX_FILE_BYTES) return false;
  let content;
  try { content = fs.readFileSync(full, 'utf8'); } catch (_) { return false; }
  scanContent(full, rel, content);
  return true;
}

function walk(dir, relParts) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }
  for (const ent of entries) {
    if (fileCount > MAX_FILES) return;
    const full = path.join(dir, ent.name);
    const rel = relParts.concat(ent.name);
    if (ent.isDirectory()) {
      if (shouldSkip(ent.name, relParts)) { skipCount++; continue; }
      walk(full, rel);
    } else if (ent.isFile()) {
      if (scanFile(full, rel.join('/'))) fileCount++;
    }
  }
}

function scanContent(full, rel, content) {
  if (content.indexOf('Users') === -1) return;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    USER_PATH_RE.lastIndex = 0;
    while ((m = USER_PATH_RE.exec(line)) !== null) {
      const drive = m[1];
      const user = m[2];
      const raw = m[0];
      const isWbRuntime = /[\\/]\.workbuddy[\\/]/.test(line) || /binaries/.test(line);
      const inMemory = rel.includes('.workbuddy/memory');
      findings.push({
        file: rel, abs: full, line: i + 1, raw, user, drive,
        isWbRuntime, inMemory,
        isCurrentUser: user.toLowerCase() === currentUser.toLowerCase(),
      });
    }
  }
}

/* ---------- 暂存区模式：只扫描 git staged 文件 ---------- */
let stagedFiles = [];
if (STAGED) {
  try {
    const stdout = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    stagedFiles = stdout.split('\n').map(s => s.trim()).filter(Boolean);
    if (VERBOSE) console.log(`[env-path-guard] 暂存区文件数: ${stagedFiles.length}`);
  } catch (e) {
    console.warn('[env-path-guard] 无法获取暂存区文件列表，回退到全目录扫描');
  }
}

if (STAGED && stagedFiles.length > 0) {
  for (const rel of stagedFiles) {
    if (fileCount > MAX_FILES) break;
    const full = path.join(ROOT, rel);
    const parts = rel.split(/[\\/]/);
    // 检查路径中是否有被跳过的目录
    let shouldSkipFile = false;
    for (let i = 0; i < parts.length - 1; i++) {
      if (shouldSkip(parts[i], parts.slice(0, i))) { shouldSkipFile = true; break; }
    }
    if (shouldSkipFile) continue;
    if (scanFile(full, rel)) fileCount++;
  }
} else {
  walk(ROOT, []);
}

/* ---------- 分类 ---------- */
const legitRuntime = findings.filter(f => f.isWbRuntime && f.isCurrentUser);
const crossUser = findings.filter(f => !f.inMemory && !f.isCurrentUser);
const sameUserHardcode = findings.filter(f => !f.inMemory && f.isCurrentUser && !f.isWbRuntime);
const memoryNarrative = findings.filter(f => f.inMemory);

/* ---------- --verify-current ---------- */
let verify = null;
if (VERIFY) {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const wbBin = path.join(home, '.workbuddy', 'binaries');
  const nodeVer = process.versions.node;
  let pyVer = '(n/a)';
  try { pyVer = execSync('python --version 2>&1', { encoding: 'utf8' }).trim(); }
  catch (_) { try { pyVer = execSync('py --version 2>&1', { encoding: 'utf8' }).trim(); } catch (_) {} }
  verify = {
    currentUser,
    home,
    workbuddyBinariesExists: fs.existsSync(wbBin),
    nodeVersion: nodeVer,
    pythonProbe: pyVer,
  };
}

/* ---------- 输出 ---------- */
const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  currentUser,
  scannedFiles: fileCount,
  skippedDirs: skipCount,
  stagedOnly: STAGED,
  summary: {
    crossUserStale: crossUser.length,        // P0：指向不存在用户
    sameUserHardcode: sameUserHardcode.length, // P1：本机可跑换机即断
    workbuddyRuntime: legitRuntime.length,     // 合法：harness 解析（仅当前用户）
    memoryNarrative: memoryNarrative.length,  // 病史叙述：忽略
  },
  portable: crossUser.length === 0 && sameUserHardcode.length === 0,
  verify,
  details: { crossUser, sameUserHardcode },
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const modeLabel = STAGED ? '（暂存区模式）' : '';
  console.log(`=== env-path-guard 扫描报告 ${modeLabel}===`);
  console.log(`当前用户(currentUser): ${currentUser}`);
  console.log(`扫描根: ${ROOT}`);
  console.log(`扫描文件数: ${fileCount} | 跳过目录数: ${skipCount}`);
  console.log('');
  console.log(`【P0 跨用户残留(指向不存在用户)】: ${crossUser.length} 处`);
  crossUser.slice(0, 30).forEach(f => console.log(`  - ${f.file}:${f.line}  ${f.raw}`));
  console.log(`【P1 本机可跑/换机即断(写死当前用户目录)】: ${sameUserHardcode.length} 处`);
  sameUserHardcode.slice(0, 30).forEach(f => console.log(`  - ${f.file}:${f.line}  ${f.raw}`));
  console.log(`【合法:WorkBuddy 运行时路径(仅当前用户,跳过)】: ${legitRuntime.length} 处`);
  console.log(`【忽略:记忆文件病史叙述】: ${memoryNarrative.length} 处`);
  console.log('');
  if (report.portable) {
    console.log('✅ 结论: 项目源码已环境可移植（无跨用户残留、无写死当前用户目录）。');
  } else {
    console.log('⚠️  结论: 存在需修复的写死用户路径，见上方明细。');
  }
  if (VERIFY && verify) {
    console.log('');
    console.log('=== --verify-current 工具链正向校验 ===');
    console.log(`home: ${verify.home}`);
    console.log(`WorkBuddy 运行时目录存在: ${verify.workbuddyBinariesExists}`);
    console.log(`node: ${verify.nodeVersion}`);
    console.log(`python 探测: ${verify.pythonProbe}`);
  }
}

/* ---------- CI 模式：发现问题返回非零退出码 ---------- */
if (CI) {
  if (!report.portable) {
    const total = crossUser.length + sameUserHardcode.length;
    console.log('');
    console.log(`❌ env-path-guard (CI模式): 发现 ${total} 处写死用户路径，提交被拦截。`);
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ env-path-guard (CI模式): 无写死用户路径，通过。');
    process.exit(0);
  }
}
