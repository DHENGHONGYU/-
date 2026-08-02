#!/usr/bin/env node
/**
 * 可移植的受管 Python venv 启动器。
 *
 * 通过 USERPROFILE / HOME 动态解析 WorkBuddy 受管 Python 解释器，
 * 使 npm 脚本不再硬编码每个用户的绝对路径（避免 DELL<->Huawei 漂移）。
 *
 * 用法:
 *   node scripts/run-venv-python.cjs [--venv <name>] <script.py> [args...]
 *     --venv <name>  .../python/envs/ 下的 venv 目录名（默认 "default"）
 *
 * 示例:
 *   node scripts/run-venv-python.cjs generate-stock-dict.py
 *   node scripts/run-venv-python.cjs --venv akshare generate-hk-industry.py
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const argv = process.argv.slice(2);
let venvName = 'default';
const passthrough = [];
let i = 0;
while (i < argv.length) {
  const a = argv[i];
  if (a === '--venv') {
    venvName = argv[i + 1];
    i += 2;
    continue;
  }
  passthrough.push(a);
  i += 1;
}

const scriptName = passthrough[0];
if (!scriptName) {
  console.error('Usage: node scripts/run-venv-python.cjs [--venv <name>] <script.py> [args...]');
  process.exit(1);
}

const base = process.env.USERPROFILE || process.env.HOME;
if (!base) {
  console.error('ERROR: USERPROFILE/HOME environment variable is not set.');
  process.exit(1);
}

const pythonExe = path.join(
  base,
  '.workbuddy',
  'binaries',
  'python',
  'envs',
  venvName,
  'Scripts',
  'python.exe'
);
const scriptPath = path.resolve(__dirname, scriptName);

const result = spawnSync(pythonExe, [scriptPath, ...passthrough.slice(1)], {
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error(`Failed to launch ${pythonExe}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
