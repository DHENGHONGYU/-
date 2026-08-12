#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const pathMod = require('node:path');
const fsMod = require('node:fs');

const ROOT_G = pathMod.resolve(__dirname, '..', '..');
const AUDIT_REGISTRY_TS = pathMod.join(ROOT_G, 'scripts', 'audit', 'audit-registry.ts');
const COMPONENT_REGISTRY_TS = pathMod.join(ROOT_G, 'src', 'components', 'componentRegistry.ts');
const SERVICE_REGISTRY_TS = pathMod.join(ROOT_G, 'src', 'services', 'serviceRegistry.ts');
const ATOM_REGISTRY_TS = pathMod.join(ROOT_G, 'src', 'components', 'registry', 'atomRegistry.ts');
const MOLECULE_REGISTRY_TS = pathMod.join(ROOT_G, 'src', 'components', 'registry', 'moleculeRegistry.ts');

const CLI = {
  json: process.argv.includes('--json'),
  strict: process.argv.includes('--strict'),
  baseline: process.argv.includes('--baseline'),
};

const BASELINE = Object.freeze({
  storeEntriesMin: 64,
  serviceEntriesMin: 62,
  // 2026-08-13 校准：删除 6 个死组件条目 + 注册 3 个真实组件后，audit:registry 验证真实组件数为 159
  componentEntriesMin: 159,
  componentSubRegistries: 4,
});

function log(msg, level) {
  if (CLI.json) return;
  const prefix =
    level === 'fail' ? '[REGRESSION-FAIL] ' :
    level === 'pass' ? '[REGRESSION-PASS] ' :
    level === 'warn' ? '[REGRESSION-WARN] ' : '[REGRESSION] ';
  console.log(prefix + msg);
}

function banner(title) {
  if (CLI.json) return;
  const sep = '='.repeat(60);
  console.log('\n' + sep);
  console.log('  ' + title);
  console.log(sep + '\n');
}

function runFullAudit() {
  const isWindows = process.platform === 'win32' || /^win\\d/.test(process.platform);
  const shellCmd = isWindows
    ? 'npx.cmd tsx "' + AUDIT_REGISTRY_TS + '"'
    : 'npx tsx "' + AUDIT_REGISTRY_TS + '"';
  const cp = spawnSync(shellCmd, {
    cwd: ROOT_G,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
    shell: true,
  });
  const stdout = (cp.stdout || '').toString();
  const counts = [];
  let m;
  const reCounts = /注册条目数:\s*(\d+)/g;
  while ((m = reCounts.exec(stdout)) !== null) counts.push(parseInt(m[1], 10));
  function grab(label) {
    const re = new RegExp(label + '[:：]\s*(\d+)');
    const hit = stdout.match(re);
    return hit ? parseInt(hit[1], 10) : 0;
  }
  return {
    exitCode: cp.status ?? 0,
    allPassed: /四层注册表一致性检查全部通过/.test(stdout),
    counts: {
      storeEntries: counts[0] ?? 0,
      serviceEntries: counts[1] ?? 0,
      componentEntries: counts[2] ?? 0,
    },
    metrics: {
      forwardProblems: grab('正向问题') || 0,
      reverseProblems: grab('反向问题') || 0,
      totalProblems: grab('问题总数') || 0,
      consumersWarn: grab('missing-consumers 警告') || 0,
      deprecationWarn: grab('incomplete-deprecation 警告') || 0,
    },
    stdout,
  };
}

function staticThinEntryCheck() {
  const errors = [];
  const warnings = [];
  try {
    const thinEntry = fsMod.readFileSync(COMPONENT_REGISTRY_TS, 'utf8');
    const importRe = /^\s*import\s*\{\s*(\w+_REGISTRY)\s*\}\s*from\s*['"]\.\/registry\/([^'"]+)['"]/gm;
    const imports = [];
    let m;
    while ((m = importRe.exec(thinEntry)) !== null) imports.push({ constName: m[1], file: m[2].replace(/\.ts$/, '') });
    if (imports.length !== BASELINE.componentSubRegistries) {
      errors.push('薄入口 static 检查失败：应有 ' + BASELINE.componentSubRegistries + ' 条 import，实际 ' + imports.length);
    }
    const uncommented = thinEntry
      .split(/\r?\n/)
      .map((l) => { const idx = l.indexOf('//'); return idx >= 0 ? l.slice(0, idx) : l; })
      .join('\n');
    const spreads = [...uncommented.matchAll(/\.\.\.(\w+_REGISTRY)/g)].map((x) => x[1]);
    if (spreads.length !== BASELINE.componentSubRegistries) {
      errors.push('薄入口 static 检查失败：应有 ' + BASELINE.componentSubRegistries + ' 个 ...Xxx_REGISTRY 展开，实际 ' + spreads.length);
    }
    const header = thinEntry.split(/\r?\n/).slice(0, 40).join('\n');
    const declaredTally = header.match(/\b(?:Atom|Molecule|Organism|Template)\b/g);
    if (!declaredTally || declaredTally.length !== imports.length) {
      warnings.push('薄入口头注释 4 层级声明数量(' + (declaredTally?.length ?? 0) + ') ≠ import 数量(' + imports.length + ')，注释可能过时');
    }
  } catch (e) {
    errors.push('薄入口文件读取失败：' + COMPONENT_REGISTRY_TS + ' — ' + (e && e.message));
  }
  return { errors, warnings };
}

function historicalRegressionCheck() {
  const errors = [];
  const warnings = [];
  try {
    const srv = fsMod.readFileSync(SERVICE_REGISTRY_TS, 'utf8');
    const portfolioHits = [...srv.matchAll(/id:\s*['"](PortfolioService|TradingPortfolioService)['"]/g)];
    const portfolioIds = portfolioHits.map((x) => x[1]);
    if (portfolioHits.length === 0) {
      errors.push('[Service] 未找到 PortfolioService 或 TradingPortfolioService id 声明');
    } else if (portfolioHits.length !== 2) {
      errors.push('[Service] Portfolio 条目数异常：期望 2 条(PortfolioService+TradingPortfolioService)，实际 ' + portfolioHits.length);
    } else {
      const uniq = new Set(portfolioIds);
      if (uniq.size !== 2) errors.push('[Service] PortfolioService/TradingPortfolioService id 回退（发生重名，本轮 Dedup 1 修复被 revert）');
    }
  } catch (e) {
    errors.push('Service 注册表读取失败：' + SERVICE_REGISTRY_TS + ' — ' + (e && e.message));
  }
  try {
    const atom = fsMod.readFileSync(ATOM_REGISTRY_TS, 'utf8');
    const mol = fsMod.readFileSync(MOLECULE_REGISTRY_TS, 'utf8');
    const atomSkeletons = [...atom.matchAll(/name:\s*['"](Skeleton|SkeletonLegacy)['"]/g)].map((x) => x[1]);
    const molSkeletons = [...mol.matchAll(/name:\s*['"](Skeleton|SkeletonLegacy)['"]/g)].map((x) => x[1]);
    if (atomSkeletons.length !== 1 || atomSkeletons[0] !== 'SkeletonLegacy') {
      errors.push('[Dedup2] Atom 层 Skeleton 条目异常：期望仅 1 条 SkeletonLegacy，实际 [' + atomSkeletons.join(', ') + ']');
    }
    if (molSkeletons.length !== 1 || molSkeletons[0] !== 'Skeleton') {
      errors.push('[Dedup2] Molecule 层 Skeleton 条目异常：期望仅 1 条 Skeleton(active)，实际 [' + molSkeletons.join(', ') + ']');
    }
    const legacyBlockMatch = atom.match(/name:\s*['"]SkeletonLegacy['"][\s\S]{0,1200}/);
    if (!legacyBlockMatch) {
      errors.push('[Atom] SkeletonLegacy 条目块未找到（可能被误删）');
    } else {
      const block = legacyBlockMatch[0];
      if (!/supersededBy\s*:\s*['"][^'"]+['"]/.test(block)) {
        errors.push('[Atom] SkeletonLegacy.deprecationMeta.supersededBy 缺失（本轮 DeprecationMeta 修复被 revert）');
      }
      if (!/deprecatedSince\s*:\s*['"][0-9]{4}-[0-9]{2}-[0-9]{2}['"]/.test(block)) {
        errors.push('[Atom] SkeletonLegacy.deprecationMeta.deprecatedSince 字段缺失或格式非 YYYY-MM-DD');
      }
      if (!/removalTarget\s*:\s*['"][0-9]{4}-[0-9]{2}-[0-9]{2}['"]/.test(block)) {
        warnings.push('[Atom] SkeletonLegacy.deprecationMeta.removalTarget 字段缺失或格式非 YYYY-MM-DD');
      }
      if (!/status:\s*['"]deprecated['"]/.test(block)) {
        errors.push('[Atom] SkeletonLegacy status 非 deprecated');
      }
    }
  } catch (e) {
    errors.push('Component 注册表读取失败：' + (e && e.message));
  }
  return { errors, warnings };
}

function main() {
  if (CLI.baseline) {
    console.log(JSON.stringify({
      baseline: BASELINE,
      generatedAt: new Date().toISOString(),
      note: '条目数 min 基线；若新增层/组件使条目数增加，应同步上调本基线。',
    }, null, 2));
    return 0;
  }
  banner('四层注册表治理 · 自动化回归守护 v1.0  (registry-governance-guardian.cjs)');
  const fullAudit = runFullAudit();
  const thinCheck = staticThinEntryCheck();
  const histCheck = historicalRegressionCheck();
  const failures = [];
  const warnings = [];
  if (fullAudit.exitCode !== 0 || !fullAudit.allPassed) {
    failures.push('audit-registry.ts exit=' + fullAudit.exitCode + ', allPassed=' + fullAudit.allPassed);
  }
  const { storeEntries, serviceEntries, componentEntries } = fullAudit.counts;
  if (storeEntries < BASELINE.storeEntriesMin) failures.push('Store 条目数基线失守：' + storeEntries + ' < ' + BASELINE.storeEntriesMin);
  if (serviceEntries < BASELINE.serviceEntriesMin) failures.push('Service 条目数基线失守：' + serviceEntries + ' < ' + BASELINE.serviceEntriesMin);
  if (componentEntries < BASELINE.componentEntriesMin) failures.push('Component 条目数基线失守：' + componentEntries + ' < ' + BASELINE.componentEntriesMin);
  failures.push(...thinCheck.errors.map((x) => '[ThinEntry] ' + x));
  warnings.push(...thinCheck.warnings.map((x) => '[ThinEntry] ' + x));
  failures.push(...histCheck.errors.map((x) => '[History] ' + x));
  warnings.push(...histCheck.warnings.map((x) => '[History] ' + x));
  const { consumersWarn, deprecationWarn } = fullAudit.metrics;
  if (consumersWarn > 0) warnings.push('consumers 警告 ' + consumersWarn + ' 条，请在合并前补齐');
  if (deprecationWarn > 0) warnings.push('deprecated 完整性警告 ' + deprecationWarn + ' 条，请在合并前补齐');
  log('主审计通过：' + fullAudit.allPassed + '（exit=' + fullAudit.exitCode + '）', fullAudit.allPassed ? 'pass' : 'fail');
  log('条目数：Store=' + storeEntries + ' / Service=' + serviceEntries + ' / Component=' + componentEntries, 'info');
  if (failures.length === 0) log('5 类回归项 + 2 条基线护栏 + 3 条历史回退守卫 = 全部通过', 'pass');
  else { log('发现 ' + failures.length + ' 条阻塞级回归：', 'fail'); failures.forEach((f) => log('  - ' + f, 'fail')); }
  if (warnings.length > 0) { log('发现 ' + warnings.length + ' 条非阻塞警告：', 'warn'); warnings.forEach((w) => log('  - ' + w, 'warn')); }
  const exitFail = failures.length > 0 || (CLI.strict && warnings.length > 0);
  if (CLI.json) {
    console.log(JSON.stringify({
      tool: 'registry-governance-guardian', version: '1.0',
      generatedAt: new Date().toISOString(),
      baseline: BASELINE, counts: fullAudit.counts, metrics: fullAudit.metrics,
      allPassed: fullAudit.allPassed, failures, warnings,
      exitCode: exitFail ? 1 : 0,
    }, null, 2));
  }
  banner(exitFail ? 'REGRESSION FAILED' : 'REGRESSION PASSED');
  return exitFail ? 1 : 0;
}

if (require.main === module) process.exit(main());
module.exports = { main, runFullAudit, staticThinEntryCheck, historicalRegressionCheck, BASELINE };
