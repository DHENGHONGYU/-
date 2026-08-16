#!/usr/bin/env node
/**
 * skill-mirror.cjs — 将项目 L1 物理技能镜像至 WorkBuddy 加载目录。
 *
 * 背景：WorkBuddy 加载器仅扫描 `~/.workbuddy/skills/` 与 `{workspace}/.workbuddy/skills/`，
 * 不扫 `.agents/skills/`。P2 将该目录 cp 至 `.workbuddy/skills/` 使 WorkBuddy 可经 Skill() 加载。
 * 本脚本是 P2 的自愈机制，避免两侧因手动编辑而漂移：
 *   - 源目录（.agents/skills 下的子目录）全量同步到目标目录（覆盖式拷贝）
 *   - 目标目录中已不存在于源的孤儿目录将被清理
 *   - 仅镜像子目录，跳过 README.md 等非技能文件
 *
 * 用法：node scripts/skill-mirror.cjs  （或 npm run skill:mirror）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, '.agents', 'skills');
const DEST = path.join(ROOT, '.workbuddy', 'skills');

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function main() {
  if (!isDir(SRC)) {
    console.error(`[skill-mirror] 源目录不存在: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(DEST, { recursive: true });

  const srcDirs = fs.readdirSync(SRC).filter((n) => isDir(path.join(SRC, n)));
  const destDirs = fs.readdirSync(DEST).filter((n) => isDir(path.join(DEST, n)));

  let copied = 0;
  let cleaned = 0;

  for (const name of srcDirs) {
    const from = path.join(SRC, name);
    const to = path.join(DEST, name);
    rmrf(to); // 先清再拷，保证完全镜像（含删除源中已移除的文件）
    fs.cpSync(from, to, { recursive: true });
    copied++;
  }

  // 清理目标中源已不存在的孤儿目录
  for (const name of destDirs) {
    if (!srcDirs.includes(name)) {
      rmrf(path.join(DEST, name));
      cleaned++;
    }
  }

  console.log(`[skill-mirror] 已同步 ${copied} 个技能目录 → ${DEST}（清理孤儿 ${cleaned} 个）`);
}

main();
