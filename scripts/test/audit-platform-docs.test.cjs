#!/usr/bin/env node
/**
 * audit-platform-docs.test.cjs — 跨平台 WIKI 契约防漂移审计回归测试（零依赖）
 *
 * 对 scripts/audit/audit-platform-docs.cjs 做三场景契约断言：
 *   1. 正向（真实仓库）      → exit 0 且输出 PASS
 *   2. 反向（临时沙箱）      → 注册表登记的目录缺失 → exit 1 且报 registry-vs-physical
 *   3. 致命（临时沙箱）      → 注册表文件缺失 → exit 2
 *
 * 沙箱原理：审计脚本以自身位置推导仓库根（path.resolve(__dirname, '..', '..')），
 * 因此把脚本副本放到 <tmp>/scripts/audit/ 下，其根即指向 <tmp>，与真实仓库完全隔离。
 *
 * 用法：node scripts/test/audit-platform-docs.test.cjs
 * 退出码：0 = 全部用例通过；1 = 存在失败用例；2 = 运行错误。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'audit', 'audit-platform-docs.cjs');

function runAudit(scriptPath) {
  try {
    const out = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    return { code: 0, output: out };
  } catch (e) {
    return {
      code: e.status === null ? 2 : e.status,
      output: `${e.stdout || ''}${e.stderr || ''}`,
    };
  }
}

function makeSandbox(withRegistry) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-audit-test-'));
  const auditDir = path.join(tmp, 'scripts', 'audit');
  fs.mkdirSync(auditDir, { recursive: true });
  fs.copyFileSync(AUDIT_SCRIPT, path.join(auditDir, 'audit-platform-docs.cjs'));
  if (withRegistry) {
    fs.mkdirSync(path.join(tmp, 'wiki'), { recursive: true });
    // 注册表登记一个物理上不存在的目录 → 必触发 registry-vs-physical 违规
    const registry = {
      platforms: [{ id: 'broken-platform', dirs: ['not-exist-dir'] }],
    };
    fs.writeFileSync(
      path.join(tmp, 'wiki', 'platform-config.registry.json'),
      JSON.stringify(registry, null, 2),
      'utf8'
    );
  }
  return tmp;
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // 清理失败不阻断测试结果
  }
}

function main() {
  if (!fs.existsSync(AUDIT_SCRIPT)) {
    console.error('[audit-platform-docs.test] 被测脚本不存在: ' + AUDIT_SCRIPT);
    process.exit(2);
  }

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  WIKI 契约审计回归 — audit-platform-docs.test.cjs v1.0     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  let failed = 0;
  const check = (name, cond, detail) => {
    if (cond) {
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.error(`  ✗ ${name}`);
      if (detail) console.error(`      ${detail}`);
    }
  };

  // 场景 1：正向 —— 真实仓库全绿
  const real = runAudit(AUDIT_SCRIPT);
  check(
    '场景1 真实仓库审计 exit 0',
    real.code === 0,
    `实际 exit=${real.code}，输出: ${real.output.slice(0, 200)}`
  );
  check('场景1 输出含 PASS 标记', /PASS/.test(real.output));

  // 场景 2：反向 —— 注册表登记的目录缺失必须报违规
  const sb1 = makeSandbox(true);
  try {
    const neg = runAudit(path.join(sb1, 'scripts', 'audit', 'audit-platform-docs.cjs'));
    check(
      '场景2 目录缺失时 exit 1',
      neg.code === 1,
      `实际 exit=${neg.code}，输出: ${neg.output.slice(0, 200)}`
    );
    check(
      '场景2 违规归因到 registry-vs-physical',
      /registry-vs-physical/.test(neg.output),
      `输出: ${neg.output.slice(0, 200)}`
    );
  } finally {
    cleanup(sb1);
  }

  // 场景 3：致命 —— 注册表文件缺失必须报执行错误
  const sb2 = makeSandbox(false);
  try {
    const fatal = runAudit(path.join(sb2, 'scripts', 'audit', 'audit-platform-docs.cjs'));
    check(
      '场景3 注册表缺失时 exit 2',
      fatal.code === 2,
      `实际 exit=${fatal.code}，输出: ${fatal.output.slice(0, 200)}`
    );
  } finally {
    cleanup(sb2);
  }

  console.log('');
  const total = 5;
  if (failed === 0) {
    console.log(`✅ 全部 ${total} 条审计契约断言通过（正向/反向/致命三场景）。`);
    process.exit(0);
  }
  console.error(`🔴 ${failed}/${total} 条断言失败 —— 请核对 audit-platform-docs.cjs 退出码契约。`);
  process.exit(1);
}

main();
