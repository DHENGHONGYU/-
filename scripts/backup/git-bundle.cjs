#!/usr/bin/env node
/**
 * git-bundle.cjs — V9 离线冷备脚本
 *
 * 使用 git bundle 创建包含全部分支和标签的二进制备份文件。
 * 恢复方式：git clone bundle-file.git recovered-repo
 *
 * @module scripts/backup/git-bundle
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKUP_DIR = path.join(ROOT, 'backups');

function run(cmd, label) {
  console.log(`  ▸ ${label}...`);
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out.trim();
  } catch (err) {
    console.error(`  ❌ ${label} 失败: ${err.message}`);
    throw err;
  }
}

function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  V9 离线冷备 — git-bundle.cjs                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`  ▸ 创建备份目录: ${BACKUP_DIR}`);
  }

  // 2. 获取时间戳
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bundleFile = path.join(BACKUP_DIR, `v9-backup-${ts}.bundle`);

  // 3. 获取当前分支
  const currentBranch = run('git rev-parse --abbrev-ref HEAD', '获取当前分支');
  console.log(`  ▸ 当前分支: ${currentBranch}`);

  // 4. 获取所有分支列表
  const branches = run('git branch --format=%(refname:short)', '获取分支列表');
  console.log(`  ▸ 分支: ${branches.replace(/\n/g, ', ')}`);

  // 5. 获取所有标签
  const tags = run('git tag -l', '获取标签列表');
  if (tags) {
    console.log(`  ▸ 标签: ${tags.replace(/\n/g, ', ')}`);
  }

  // 6. 创建 bundle（包含所有分支和标签）
  const bundleRefArgs = ['--all'];
  const bundleCmd = `git bundle create "${bundleFile}" ${bundleRefArgs.join(' ')}`;
  console.log('');
  console.log('  ▸ 创建 git bundle（含全部分支+标签）...');
  try {
    execSync(bundleCmd, { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error('');
    console.error('  ❌ bundle 创建失败');
    console.error(`     错误: ${err.message}`);
    process.exit(1);
  }

  // 7. 验证 bundle 完整性
  console.log('');
  console.log('  ▸ 验证 bundle 完整性...');
  try {
    execSync(`git bundle verify "${bundleFile}"`, { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error('  ❌ bundle 验证失败');
    process.exit(1);
  }

  // 8. 获取 bundle 文件大小
  const stats = fs.statSync(bundleFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
  const sizeStr = stats.size > 1024 * 1024 * 1024 ? `${sizeGB} GB` : `${sizeMB} MB`;

  // 9. 获取最新提交
  const latestCommit = run('git log --oneline -1', '获取最新提交');

  console.log('');
  console.log('═════════════════════════════════════════════════════════════');
  console.log('  ✅ 离线冷备完成');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`  📦 备份文件: ${bundleFile}`);
  console.log(`  📏 文件大小: ${sizeStr}`);
  console.log(`  📌 最新提交: ${latestCommit}`);
  console.log(`  🌿 当前分支: ${currentBranch}`);
  console.log(`  🏷️  标签数:   ${tags ? tags.split('\n').length : 0}`);
  console.log('');
  console.log('  恢复方式:');
  console.log(`    git clone "${bundleFile}" recovered-repo`);
  console.log('    或');
  console.log(`    git fetch "${bundleFile}" '*:origin/*'`);
  console.log('');
}

main();
