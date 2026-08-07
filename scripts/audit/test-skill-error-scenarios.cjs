#!/usr/bin/env node
/**
 * test-skill-error-scenarios.cjs — SKILL 引用错误场景自动化测试（5 条）
 *
 * E-01 悬空引用（路由表加假 skill → 未注册 → detect 报 ERROR）
 * E-02 covers_docs 假路径 + --fix 自动修复（轨 A/轨 B 验证）
 * E-03 related_skills 引用不存在 skill
 * E-04 frontmatter 三字段缺失
 * E-05 未来新增悬空引用（回归测试占位）
 *
 * 每个场景结束恢复原文件；所有断言通过返回 0。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const BASH_SKILL_PATH = path.join(ROOT, '.trae', 'skills', 'v9-bash-conventions', 'SKILL.md');
const DETECT = path.join(ROOT, 'scripts', 'audit', 'detect-skill-dangling-ref.cjs');

const AGENTS_ORIG = fs.readFileSync(AGENTS_PATH, 'utf-8');
const REG_ORIG = fs.readFileSync(REGISTRY_PATH, 'utf-8');
const BASH_ORIG = fs.readFileSync(BASH_SKILL_PATH, 'utf-8');
const REG_JSON_ORIG = JSON.parse(REG_ORIG);
let passCount = 0;

function restore() {
  fs.writeFileSync(AGENTS_PATH, AGENTS_ORIG, 'utf-8');
  fs.writeFileSync(REGISTRY_PATH, REG_ORIG, 'utf-8');
  fs.writeFileSync(BASH_SKILL_PATH, BASH_ORIG, 'utf-8');
}
process.on('exit', restore);

function assert(cond, title, resultText) {
  if (cond) {
    console.log('   ✅ ' + (resultText || title));
    passCount++;
  } else {
    console.log('   ❌ 断言失败: ' + title);
    process.exitCode = 1;
    throw new Error('AssertionFailed: ' + title);
  }
}
function run(args) {
  const argv = ['node', DETECT, ...(args || [])];
  try {
    const result = spawnSync(argv[0], argv.slice(1), {
      cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024, timeout: 10 * 60 * 1000, windowsHide: true,
    });
    if (result.status === 0) return result.stdout || '';
    return String(result.stdout || '') + String(result.stderr || (result.error ? result.error.message : ''));
  } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
}
function box(title) {
  const w = 72;
  const line = '═'.repeat(w - 2);
  const L = Math.floor((w - 4 - title.length) / 2);
  const R = w - 4 - title.length - L;
  return `╔${line}╗\n║ ${' '.repeat(L)}${title}${' '.repeat(R)} ║\n╚${line}╝`;
}

console.log('\n' + box('SKILL 引用错误场景自动化测试（4 指南案例 + 1 未来回归）'));

// ============================================================
// E-01 悬空引用
// ============================================================
console.log('\n=== 场景 1: 悬空引用 ===');
console.log('  模拟: 在 AGENTS 路由表新增 fake-skill-test-12345 但不在 Registry 注册');
const fakeRow = '| 假悬空引用占位 | `fake-skill-test-12345` | `mandatory` | fake-skill-test-12345 必加载 |';
fs.writeFileSync(AGENTS_PATH, AGENTS_ORIG.replace('> **变更纪律**', fakeRow + '\n> **变更纪律**'), 'utf-8');
assert(
  (run(['--report-only']).includes('fake-skill-test-12345')),
  '1.1 fake-skill-test-12345 悬空被检测到',
  '成功检测到 fake-skill-test-12345 悬空引用'
);
restore();

// ============================================================
// E-02 covers_docs 假路径 + --fix
// ============================================================
console.log('\n=== 场景 2: covers_docs 路径错误 + --fix 自动修复 ===');
console.log('  模拟: 在 v9-bash-conventions/SKILL.md + Registry 同时注入 docs/nonexistent-fake-doc.md');
const FAKE_DOC = 'docs/nonexistent-fake-doc.md';
// 注入 SKILL.md covers_docs 数组
let bashInjected = BASH_ORIG.replace(/(covers_docs:\s*\[)([^\]]*)(\])/g, function(_, pre, list, post) {
  const items = list ? list.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
  items.push('"' + FAKE_DOC + '"');
  return pre + items.join(', ') + post;
});
fs.writeFileSync(BASH_SKILL_PATH, bashInjected, 'utf-8');
// 注入 Registry
const reg = JSON.parse(REG_ORIG);
const entries = (reg.active || reg.skills || []);
const bashEntry = entries.find(function(e) { return e.name && e.name.indexOf('bash-conventions') >= 0; }) || entries[0];
if (!Array.isArray(bashEntry.covers_docs)) bashEntry.covers_docs = [];
bashEntry.covers_docs.push(FAKE_DOC);
fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + '\n', 'utf-8');
const out2a = run(['--report-only']);
assert(
  out2a.includes(FAKE_DOC) && (out2a.indexOf('ERROR') >= 0 || out2a.indexOf('路径不存在') >= 0 || out2a.indexOf('covers-path-invalid') >= 0 || out2a.indexOf('covers-bside-invalid') >= 0),
  '2.1 检测到 docs/nonexistent-fake-doc.md 错路径',
  '检测到 ' + FAKE_DOC + ' 错路径'
);
// 执行 --fix
run(['--fix']);
const regAfter = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
const bashAfter = (regAfter.active || regAfter.skills || []).find(function(e) { return e.name && e.name.indexOf('bash-conventions') >= 0; }) || bashEntry;
assert(
  (!bashAfter.covers_docs || bashAfter.covers_docs.indexOf(FAKE_DOC) < 0),
  '2.2 Registry covers_docs 已移除 ' + FAKE_DOC,
  'Registry covers_docs 已移除 nonexistent-fake-doc'
);
const bashSkillAfter = fs.readFileSync(BASH_SKILL_PATH, 'utf-8');
assert(
  bashSkillAfter.indexOf(FAKE_DOC) < 0,
  '2.3 SKILL.md covers_docs 已移除不存在路径',
  'SKILL.md covers_docs 已移除不存在路径'
);
const out2b = run(['--report-only']);
assert(
  out2b.indexOf(FAKE_DOC) < 0,
  '2.4 修复后重跑检测无残余 ' + FAKE_DOC + ' 错误',
  '修复后重跑检测无残余 nonexistent-fake-doc 错误'
);
restore();

// ============================================================
// E-03 related_skills 悬空引用
// ============================================================
console.log('\n=== 场景 3: related_skills 引用不存在 SKILL ===');
console.log('  模拟: 在 v9-bash-conventions/SKILL.md related_skills 里加 v9-never-existed-abcdefg-99999');
const FAKE_REL = 'v9-never-existed-abcdefg-99999';
const bashRelInjected = BASH_ORIG.replace(/(related_skills:\s*\[)([^\]]*)(\])/, function(_, pre, list, post) {
  const arr = list ? list.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
  arr.push(FAKE_REL);
  return pre + arr.join(', ') + post;
});
fs.writeFileSync(BASH_SKILL_PATH, bashRelInjected, 'utf-8');
const out3 = run(['--report-only']);
assert(
  out3.indexOf(FAKE_REL) >= 0 && (out3.indexOf('related_skills 引用了不存在的') >= 0 || out3.indexOf('不存在的 SKILL') >= 0),
  '3.1 related_skills 悬空被抓',
  '成功检测到 related_skills 悬空引用'
);
restore();

// ============================================================
// E-04 frontmatter 三字段缺失
// ============================================================
console.log('\n=== 场景 4: frontmatter 三字段缺失（triggers / gates / mandatory）===');
console.log('  模拟: 把 v9-bash-conventions/SKILL.md frontmatter 里三字段替换为注释');
let broken = BASH_ORIG;
broken = broken.replace(/gates:\s*(\[[^\]]*\]|[\s\S]*?(?=\n[a-z#]|\n---|$))/gim, '# gates: (removed for test)');
broken = broken.replace(/triggers:\s*(\[[^\]]*\]|[\s\S]*?(?=\n[a-z#]|\n---|$))/gim, '# triggers: (removed for test)');
broken = broken.replace(/mandatory:\s*(true|false)/gim, '# mandatory: (removed for test)');
fs.writeFileSync(BASH_SKILL_PATH, broken, 'utf-8');
const out4 = run(['--report-only']);
// 字段缺失可能是合并消息 "缺少必填字段 gates / triggers / mandatory"，也可能是分三条（只要三段都出现过即算通过）
const missingFieldMsgMatches = Array.from(out4.matchAll(/缺少必填字段\s+([^\n]+)/g));
const seenFields = new Set();
for (const m of missingFieldMsgMatches) m[1].split('/').forEach(s => seenFields.add(s.trim()));
assert(
  seenFields.has('gates') && seenFields.has('triggers') && seenFields.has('mandatory'),
  '4.1 三字段缺失均报错',
  `成功检测到 frontmatter 字段缺失（命中字段集合：${[...seenFields].join(',')}）`
);
restore();

// ============================================================
// E-05 未来新增悬空引用回归
// ============================================================
console.log('\n=== 场景 5: 未来新增悬空引用场景（回归测试）===');
console.log('  模拟: 未来开发者新增了 v9-future-dangling-skill 路由但忘了在 Registry 注册');
const futureRow = '| 未来功能回归占位 | `v9-future-dangling-skill` | `mandatory` | v9-future-dangling-skill 必加载 |';
fs.writeFileSync(AGENTS_PATH, AGENTS_ORIG.replace('> **变更纪律**', futureRow + '\n> **变更纪律**'), 'utf-8');
const out5 = run(['--report-only']);
assert(
  out5.indexOf('v9-future-dangling-skill') >= 0 && (out5.indexOf('悬空引用') >= 0 || out5.indexOf('不存在于 Registry') >= 0),
  '5.1 未来新增路由 v9-future-dangling-skill 未注册时可第一时间自动抓取',
  '成功检测到未来新增的悬空引用 v9-future-dangling-skill'
);
restore();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试结果: ' + passCount + ' 通过 / ' + (5 - passCount) + ' 失败 / 5 个场景');
console.log('所有场景已自动恢复原始文件，没有副作用残留 ✓');
if (passCount < 5) process.exitCode = 1;
