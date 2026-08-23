#!/usr/bin/env node
/**
 * skill-mirror.cjs — WorkBuddy/Qoder 技能加载目录的幂等初始化契约（v2：junction 优先，cp 兜底）。
 *
 * 背景：WorkBuddy / Qoder 加载器仅扫描 `~/.workbuddy/skills/` 与 `{workspace}/.workbuddy/skills/`，
 * 不扫 `.agents/skills/`。真相源唯一：`.agents/skills/`（git 追踪）。
 *
 * v2 防多备份策略（2026-08-23 跨平台 SKILL 体系统一）：
 *   - 首选目录联接（junction）：`.workbuddy/skills` → `.agents/skills`，物理上只有一份，零漂移。
 *     Windows `mklink /J` 不需管理员权限；`.workbuddy/skills/` 已 gitignore，不影响 git。
 *   - junction 创建失败（非 Windows / 权限受限文件系统）时降级为 v1 的覆盖式 cp 镜像并告警。
 *
 * 幂等行为矩阵：
 *   目标状态                     → 动作
 *   ─────────────────────────────────────────────────────────
 *   已是 junction 且指向源       → 输出「联接复用」，跳过
 *   是 junction 但指向他处       → 移除后重建指向源
 *   不存在                       → 优先建 junction；失败降级 cp 镜像
 *   旧 cp 副本（普通目录）       → 清理后重建 junction（失败降级重新 cp）
 *
 * 新克隆机器环境搭建：跑一次 `npm run skill:mirror` 即可。
 *
 * 用法：node scripts/skill-mirror.cjs  （或 npm run skill:mirror）
 * 退出码：0 = 成功（联接复用/新建/降级镜像）；1 = 源目录缺失或同步失败。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const SRC = path.join(ROOT, '.agents', 'skills');
const DEST = path.join(ROOT, '.workbuddy', 'skills');

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/** 判断路径是否为目录联接/符号链接，返回 { is, target } */
function junctionInfo(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isSymbolicLink()) return { is: false, target: null };
    const raw = fs.readlinkSync(p);
    return { is: true, target: path.resolve(path.dirname(p), raw) };
  } catch {
    return { is: false, target: null };
  }
}

/** 尝试创建 junction；成功返回 true。仅 Windows 有效。 */
function tryCreateJunction() {
  if (process.platform !== 'win32') return false;
  try {
    execSync(`mklink /J "${DEST}" "${SRC}"`, {
      shell: process.env.ComSpec || 'cmd.exe',
      stdio: 'pipe',
    });
    const info = junctionInfo(DEST);
    return info.is && info.target === path.resolve(SRC);
  } catch {
    return false;
  }
}

/** v1 兜底：覆盖式 cp 镜像（仅镜像技能子目录）。 */
function cpMirror() {
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
  console.log(`[skill-mirror] 降级 cp 镜像：已同步 ${copied} 个技能目录 → ${DEST}（清理孤儿 ${cleaned} 个）`);
}

function main() {
  if (!isDir(SRC)) {
    console.error(`[skill-mirror] 源目录不存在: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true });

  const info = junctionInfo(DEST);

  if (info.is) {
    if (info.target === path.resolve(SRC)) {
      console.log(`[skill-mirror] 联接复用：${DEST} → ${SRC}（物理单份，零漂移）`);
      return;
    }
    console.warn(`[skill-mirror] 联接指向他处（${info.target}），移除后重建`);
    fs.unlinkSync(DEST);
  } else if (isDir(DEST)) {
    console.log('[skill-mirror] 检测到旧 cp 副本，清理后重建为联接');
    rmrf(DEST);
  }

  if (tryCreateJunction()) {
    console.log(`[skill-mirror] 已建立目录联接：${DEST} → ${SRC}（防多备份生效）`);
    return;
  }

  console.warn('[skill-mirror] junction 创建失败（非 Windows 或权限受限），降级为 cp 镜像');
  cpMirror();
}

main();
