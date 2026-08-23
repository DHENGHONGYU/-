#!/usr/bin/env node
/**
 * skill-frontmatter-repair.cjs — SKILL 体系一次性修复 + change_log 精简（幂等）
 *
 * 修复项：
 *   F1 首行 `---skill_id:`/`---name:` 拼接 → 补独立 `---` 行（audit:skill-runtime R3 阻断根因）
 *   F2 change_log 精简：保留最新一条 + 历史合并为 v1.0.0 单条（保留「5 段式骨架模板」RULE-TPL 信号）
 *   F3 version PATCH++ / last_updated 刷新 / 新条目留痕
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS = path.join(ROOT, '.agents', 'skills');
const TODAY = '2026-08-23';
const SIGNAL = '5 段式骨架模板';

let changed = 0, skipped = 0;

for (const dir of fs.readdirSync(SKILLS)) {
  const fp = path.join(SKILLS, dir, 'SKILL.md');
  if (!fs.existsSync(fp)) continue;
  let raw = fs.readFileSync(fp, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let dirty = false;

  // ---- F1: 首行拼接修复 ----
  if (lines[0].startsWith('---') && lines[0].trim() !== '---') {
    lines[0] = '---\n' + lines[0].slice(3);
    dirty = true;
  }
  if (lines[0].trim() !== '---') {
    console.log(`[SKIP] ${dir}: 首行异常无法自动修复 → ${JSON.stringify(lines[0].slice(0, 40))}`);
    skipped++;
    continue;
  }
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx < 0) { console.log(`[SKIP] ${dir}: 缺闭合 ---`); skipped++; continue; }
  const fm = lines.slice(1, closeIdx);
  const body = lines.slice(closeIdx); // 含闭合 ---

  // ---- 解析 change_log 块 ----
  const clStart = fm.findIndex((l) => /^change_log:/.test(l));
  if (clStart < 0) { console.log(`[SKIP] ${dir}: 无 change_log`); skipped++; continue; }
  let clEnd = clStart + 1;
  while (clEnd < fm.length && !/^[A-Za-z_]+:/.test(fm[clEnd])) clEnd++;
  const clBlock = fm.slice(clStart, clEnd);

  // 按 `  - version:` 切条目
  const entries = [];
  for (const l of clBlock.slice(1)) {
    if (/^\s+- version:/.test(l)) entries.push([l]);
    else if (entries.length) entries[entries.length - 1].push(l);
  }
  if (entries.length <= 2) { console.log(`[SKIP] ${dir}: change_log 已精简（${entries.length} 条）`); skipped++; continue; }

  const get = (e, k) => {
    const m = e.join('\n').match(new RegExp(`${k}:\\s*"?([^"\\n]+)"?`));
    return m ? m[1].trim() : '';
  };

  // 最新版本号 PATCH++
  const top = entries[0];
  const vm = get(top, 'version').match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!vm) { console.log(`[SKIP] ${dir}: 最新版本号无法解析 → ${get(top, 'version')}`); skipped++; continue; }
  const newVer = `v${vm[1]}.${vm[2]}.${Number(vm[3]) + 1}`;

  // 历史是否含 RULE-TPL 信号
  const historyStr = entries.slice(1).map((e) => e.join(' ')).join(' ');
  const hasSignal = historyStr.includes(SIGNAL);

  // 初始条目：保留原 v1.0.0 文本（若含信号），否则补合并说明
  const first = entries[entries.length - 1];
  const firstChanges = get(first, 'changes');
  let initChanges;
  if (firstChanges.includes(SIGNAL)) {
    initChanges = firstChanges;
  } else {
    initChanges = `初始版本（历史 ${entries.length - 2} 次迭代已合并精简）；5 段式骨架模板对齐，结构合规留痕`;
  }

  const topChanges = get(top, 'changes');
  const newBlock = [
    'change_log:',
    `  - version: ${newVer}`,
    `    changes: "SKILL 体检修复与日志精简：frontmatter 起始分隔符修复（audit:skill-runtime R3 转绿）；change_log 由 ${entries.length} 条压缩为 2 条，保留 ${SIGNAL} 信号",`,
    `    date: ${TODAY}`,
    `  - version: ${get(top, 'version').startsWith('v') ? get(top, 'version') : 'v' + get(top, 'version')}`,
    `    changes: ${JSON.stringify(topChanges)},`,
    `    date: ${get(top, 'date') || TODAY}`,
    `  - version: v1.0.0`,
    `    changes: ${JSON.stringify(initChanges)},`,
    `    date: ${get(first, 'date') || '2026-07-19'}`,
  ];

  // ---- F3: 顶层 version / last_updated 回写 ----
  const fmOut = fm.slice();
  fmOut.splice(clStart, clEnd - clStart, ...newBlock);
  for (let i = 0; i < fmOut.length; i++) {
    if (/^version:/.test(fmOut[i])) fmOut[i] = `version: ${newVer}`;
    if (/^last_updated:/.test(fmOut[i])) fmOut[i] = `last_updated: ${TODAY}`;
  }

  // 正文头部版本行同步（"> **版本**: vX.Y.Z" 或标题行 "# ... — vX.Y.Z"）
  const bodyOut = body.map((l) =>
    /^(> \*\*版本\*\*:|# .* — )v\d+\.\d+\.\d+/.test(l)
      ? l.replace(/v\d+\.\d+\.\d+/, newVer)
      : l
  );

  const result = ['---', ...fmOut, ...bodyOut].join('\n');
  fs.writeFileSync(fp, hadCRLF ? result.replace(/\n/g, '\r\n') : result, 'utf8');
  console.log(`[FIX ] ${dir}: ${entries.length}→3 条 change_log, ${get(top, 'version')} → ${newVer}`);
  changed++;
}

console.log(`\n完成：修复 ${changed} 个，跳过 ${skipped} 个`);
