#!/usr/bin/env node
'use strict';
/*
 * windows-env-path-doctor :: scan.cjs
 * 扫描项目里写死的 Windows 用户目录绝对路径（C:/Users/<user>/...），
 * 使其对 DELL↔Huawei 等多用户机器可移植。
 *
 * 设计要点（对应 SKILL.md 铁律）：
 *  - 环境优先：currentUser 从 process.env.USERPROFILE / HOME / os.homedir() 取，绝不写死。
 *  - 修正 Grep 假阴性：Node 原生读取 + 正则覆盖 单/双反斜杠 与 正斜杠。
 *  - 自带 --verify-current 正向校验工具链。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = process.argv[2] || process.cwd();
const args = process.argv.slice(2);
const VERIFY = args.includes('--verify-current');
const JSON_OUT = args.includes('--json');
const VERBOSE = args.includes('--verbose');

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
      const ext = path.extname(ent.name).toLowerCase();
      if (!TEXT_EXT.has(ext)) continue;
      let st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      if (st.size > MAX_FILE_BYTES) continue;
      let content;
      try { content = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
      scanContent(full, rel.join('/'), content);
      fileCount++;
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

walk(ROOT, []);

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
  console.log('=== windows-env-path-doctor 扫描报告 ===');
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
