#!/usr/bin/env node
/**
 * skill-router.test.cjs — 技能路由匹配回归测试（技能评估体系 L2 层，零依赖）
 *
 * 复用 scripts/skill-router.cjs 的匹配内核（matchSkills），以
 * scripts/test/skill-router-fixtures.json 的「信号 → 期望命中」语料做回归断言，
 * 防止 registry 触发词改动造成路由漂移（该触发对 / 不该触发却触发）。
 *
 * 断言语义：
 *   - expect 中每个技能必须出现在实际命中集合中（实际命中允许是超集，
 *     因一条信号可同时命中多技能，如改动 src/config/** 同时触发迁移类技能）
 *   - exclude 中每个技能禁止出现在实际命中集合中
 *
 * 用法：node scripts/test/skill-router.test.cjs
 * 退出码：0 = 全部用例通过；1 = 存在失败用例；2 = 运行错误。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const FIXTURES_PATH = path.join(__dirname, 'skill-router-fixtures.json');

const { matchSkills } = require('../skill-router.cjs');

function main() {
  let registry, fixtures;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'));
  } catch (e) {
    console.error(`[skill-router.test] 读取输入失败: ${e.message}`);
    process.exit(2);
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  技能路由匹配回归 — skill-router.test.cjs v1.0             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  let failed = 0;
  for (const c of fixtures.cases || []) {
    const hits = matchSkills(registry, c.files || [], c.prompt || null);
    const hitNames = new Set(hits.map(h => h.skill.name));

    const missing = (c.expect || []).filter(n => !hitNames.has(n));
    const forbidden = (c.exclude || []).filter(n => hitNames.has(n));

    if (missing.length === 0 && forbidden.length === 0) {
      console.log(`  ✓ ${c.name}`);
      console.log(`      实际命中: ${[...hitNames].join(', ') || '（无）'}`);
    } else {
      failed++;
      console.error(`  ✗ ${c.name}`);
      if (missing.length > 0) console.error(`      漏命中: ${missing.join(', ')}`);
      if (forbidden.length > 0) console.error(`      误命中: ${forbidden.join(', ')}`);
      console.error(`      实际命中: ${[...hitNames].join(', ') || '（无）'}`);
    }
  }

  console.log('');
  const total = (fixtures.cases || []).length;
  if (failed === 0) {
    console.log(`✅ 全部 ${total} 条路由回归用例通过（信号→命中 与语料一致）。`);
    process.exit(0);
  }
  console.error(`🔴 ${failed}/${total} 条用例失败 —— 请核对 registry 触发词与 fixture 语料后修复。`);
  process.exit(1);
}

main();
