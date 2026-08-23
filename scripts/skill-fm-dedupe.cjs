#!/usr/bin/env node
/**
 * skill-fm-dedupe.cjs — frontmatter 重复顶层键去重（幂等）
 * 背景：历史 freshness 脚本曾重复注入 change_log 块，导致 YAML 双份键。
 * 策略：保留首个 change_log 块，删除其后所有重复 change_log 块；其他重复顶层键仅报告。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS = path.join(ROOT, '.agents', 'skills');
let changed = 0;

for (const dir of fs.readdirSync(SKILLS)) {
  const fp = path.join(SKILLS, dir, 'SKILL.md');
  if (!fs.existsSync(fp)) continue;
  const raw = fs.readFileSync(fp, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') { console.log(`[SKIP] ${dir}: 首行非 ---`); continue; }
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx < 0) { console.log(`[SKIP] ${dir}: 缺闭合 ---`); continue; }
  const fm = lines.slice(1, closeIdx);

  // 找全部顶层键及其块范围
  const keyIdx = [];
  fm.forEach((l, i) => {
    const m = l.match(/^([A-Za-z_]+):/);
    if (m) keyIdx.push({ key: m[1], start: i });
  });
  // 重复键报告（change_log 除外，单独处理）
  const seen = new Set();
  const dups = new Set();
  for (const k of keyIdx) {
    if (seen.has(k.key)) dups.add(k.key);
    seen.add(k.key);
  }
  const nonClDups = [...dups].filter((k) => k !== 'change_log');
  if (nonClDups.length) console.log(`[WARN] ${dir}: 非 change_log 重复键 → ${nonClDups.join(', ')}`);

  const clStarts = keyIdx.filter((k) => k.key === 'change_log').map((k) => k.start);
  if (clStarts.length <= 1) continue;

  // 块范围：从键行到下一个顶层键（或 fm 末尾）
  const blockEnd = (start) => {
    const next = keyIdx.find((k) => k.start > start);
    return next ? next.start : fm.length;
  };
  const removeRanges = clStarts.slice(1).map((s) => [s, blockEnd(s)]);
  const removeSet = new Set();
  for (const [s, e] of removeRanges) for (let i = s; i < e; i++) removeSet.add(i);

  const fmOut = fm.filter((_, i) => !removeSet.has(i));
  const out = ['---', ...fmOut, ...lines.slice(closeIdx)].join('\n');
  fs.writeFileSync(fp, hadCRLF ? out.replace(/\n/g, '\r\n') : out, 'utf8');
  console.log(`[FIX ] ${dir}: 删除 ${clStarts.length - 1} 个重复 change_log 块`);
  changed++;
}
console.log(`\n完成：清理 ${changed} 个文件`);
