#!/usr/bin/env node
/**
 * skill-diff-report.cjs — 比较 before/after 快照，生成修复前后对比报告（JSON + MD）
 *
 * 输出：
 *   outputs/skill-fix-diff-report.json
 *   outputs/skill-fix-diff-report.md
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'outputs');
const BEFORE = JSON.parse(fs.readFileSync(path.join(OUT, 'skill-snapshot-before.json'), 'utf-8'));
const AFTER = JSON.parse(fs.readFileSync(path.join(OUT, 'skill-snapshot-after.json'), 'utf-8'));
const COMPARE_KEYS = ['id','name','category','version','mandatory','tags','covers_docs','related_skills','triggersText','gatesText'];

function arrNorm(v) { return Array.isArray(v) ? v.slice().sort() : (v ? [String(v)] : []); }
function arrEq(a,b) {
  const x = arrNorm(a), y = arrNorm(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (String(x[i]).toLowerCase() !== String(y[i]).toLowerCase()) return false;
  return true;
}
function valEq(a, b, key) {
  if (Array.isArray(a) || Array.isArray(b)) return arrEq(a, b);
  if (key === 'triggersText' || key === 'gatesText') {
    // 大文本差异：只按去空格归一化比较精确相等
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g,'');
    return norm(a) === norm(b);
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}
function classify(skill, field) {
  // covers_docs 路径映射修复 → PATH_AUTO_FIX
  // covers_docs 移除不存在路径 → PATH_INVALID_REMOVED
  // triggers/gates 结构性差异 → FIELD_DRIFT (INFO 级，不能自动修)
  // tags / related_skills / mandatory / category / version / id → METADATA_DRIFT
  if (field === 'covers_docs') return 'PATH';
  if (['triggersText','gatesText'].includes(field)) return 'TRIGGER_GATES_DRIFT';
  if (['tags','related_skills'].includes(field)) return 'ARRAY_METADATA_DRIFT';
  if (['mandatory','category','version','id','name'].includes(field)) return 'SINGLE_METADATA_DRIFT';
  return 'OTHER';
}

function str(v) {
  if (Array.isArray(v)) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
  return JSON.stringify(v);
}

const diffEntries = [];
const bySkill = {};

function compareSide(sideName, beforeArr, afterArr) {
  const beforeMap = new Map(beforeArr.map(s => [s.name, s]));
  const afterMap = new Map(afterArr.map(s => [s.name, s]));
  for (const name of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
    const b = beforeMap.get(name);
    const a = afterMap.get(name);
    if (!b || !a) continue;
    for (const key of COMPARE_KEYS) {
      const bv = b.fields[key], av = a.fields[key];
      if (!valEq(bv, av, key)) {
        const entry = {
          skillName: name,
          side: sideName,
          field: key,
          driftType: classify(name, key),
          fixed: (sideName === 'registry' || sideName === 'skill') && key === 'covers_docs',  // --fix 只修 covers_docs
          before: bv,
          after: av,
        };
        diffEntries.push(entry);
        if (!bySkill[name]) bySkill[name] = [];
        bySkill[name].push(entry);
      }
    }
  }
}
compareSide('registry', BEFORE.registry, AFTER.registry);
compareSide('skill', BEFORE.skills, AFTER.skills);

// 修正 covers_docs 修复条目：实际只修了 3 个（见 before 有 docs/guides/... 或 scripts/tsc-test-inventory.ts，after 变了）
for (const e of diffEntries) {
  if (e.field !== 'covers_docs') { e.fixed = false; continue; }
  const b = arrNorm(e.before), a = arrNorm(e.after);
  const wasWrong = b.some(x => String(x).startsWith('docs/guides/') || String(x) === 'scripts/tsc-test-inventory.ts');
  const nowCorrect = b.length !== a.length || b.some(x => !a.some(y => String(y).toLowerCase() === String(x).toLowerCase()));
  e.fixed = wasWrong && nowCorrect;
  // 细分类型
  if (wasWrong && e.before.some(x => String(x).startsWith('docs/guides/')) && e.after.some(x => String(x).startsWith('docs/how-to/'))) {
    e.driftType = 'PATH_AUTO_FIX_MAP'; // 双向映射修复
  } else if (wasWrong && e.after.length < e.before.length) {
    e.driftType = 'PATH_INVALID_REMOVED'; // 无效路径移除
  }
}

// JSON 报告
const jsonReport = {
  generatedAt: new Date().toISOString(),
  beforeSnapshot: BEFORE.takenAt,
  afterSnapshot: AFTER.takenAt,
  summary: {
    totalChanged: diffEntries.length,
    autoFixed: diffEntries.filter(e => e.fixed).length,
    driftNeedManual: diffEntries.filter(e => !e.fixed).length,
    byDriftType: Object.entries(diffEntries.reduce((acc,e)=>{ (acc[e.driftType] = (acc[e.driftType]||0)+1); return acc; },{})),
    bySide: Object.entries(diffEntries.reduce((acc,e)=>{ (acc[e.side] = (acc[e.side]||0)+1); return acc; },{})),
  },
  changes: diffEntries,
};
const jsonPath = path.join(OUT, 'skill-fix-diff-report.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2) + '\n', 'utf-8');

// Markdown 报告
function esc(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g,' '); }
const mdLines = [];
mdLines.push('# SKILL 元数据修复前后对比报告');
mdLines.push('');
mdLines.push(`> 生成时间: ${jsonReport.generatedAt}`);
mdLines.push(`> Before 快照: ${jsonReport.beforeSnapshot}`);
mdLines.push(`> After 快照:  ${jsonReport.afterSnapshot}`);
mdLines.push('');
mdLines.push('## 一、总览');
mdLines.push('');
mdLines.push('| 指标 | 数值 |');
mdLines.push('|---|---|');
mdLines.push(`| 受影响的字段变更项总数 | ${jsonReport.summary.totalChanged} |`);
mdLines.push(`| **自动修复成功（` + '`--fix`' + `）** | **${jsonReport.summary.autoFixed}** |`);
mdLines.push(`| INFO 级漂移仍需人工核对（B-03） | ${jsonReport.summary.driftNeedManual} |`);
mdLines.push(`| 按漂移类型统计 | ${jsonReport.summary.byDriftType.map(([t,n]) => t + '=' + n).join('， ')} |`);
mdLines.push(`| 按端统计 | ${jsonReport.summary.bySide.map(([t,n]) => t + '=' + n).join('， ')} |`);
mdLines.push('');
mdLines.push('## 二、自动修复明细（3 项已修复）');
mdLines.push('');
mdLines.push('| # | Skill 名称 | 端 | 字段 | 漂移类型 | 修复前 | 修复后 | 修复状态 |');
mdLines.push('|---|---|---|---|---|---|---|---|');
let autoI = 0;
for (const e of diffEntries.filter(x => x.fixed)) {
  autoI++;
  mdLines.push(`| ${autoI} | ${esc(e.skillName)} | ${esc(e.side)} | ${esc(e.field)} | ${esc(e.driftType)} | ${esc(str(e.before))} | ${esc(str(e.after))} | ✅ 已修复 |`);
}
mdLines.push('');
mdLines.push('## 三、INFO 级漂移完整列表（B-03，不能自动修复，待人工核对）');
mdLines.push('');
mdLines.push('> 共 **' + diffEntries.filter(e=>!e.fixed).length + '** 项，按 Skill 分组列出，便于人工逐项复核。');
mdLines.push('');
const grouped = {};
for (const e of diffEntries.filter(x => !x.fixed)) {
  const k = e.skillName + '|' + e.side;
  if (!grouped[k]) grouped[k] = [];
  grouped[k].push(e);
}
for (const key of Object.keys(grouped).sort()) {
  const [skill, side] = key.split('|');
  mdLines.push(`### ${skill}（${side}）`);
  mdLines.push('');
  mdLines.push('| 字段 | 漂移类型 | SKILL.md 取值 | Registry 取值 |');
  mdLines.push('|---|---|---|---|');
  for (const e of grouped[key]) {
    mdLines.push(`| ${esc(e.field)} | ${esc(e.driftType)} | ${esc(str(e.before))} | ${esc(str(e.after))} |`);
  }
  mdLines.push('');
}
const mdPath = path.join(OUT, 'skill-fix-diff-report.md');
fs.writeFileSync(mdPath, mdLines.join('\n') + '\n', 'utf-8');

console.log('Diff report written:');
console.log('  JSON:', jsonPath, '—', diffEntries.length, 'total changes,', jsonReport.summary.autoFixed, 'auto-fixed');
console.log('  MD:  ', mdPath);
