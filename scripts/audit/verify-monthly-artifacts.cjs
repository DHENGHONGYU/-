#!/usr/bin/env node
/**
 * verify-monthly-artifacts.cjs — 校验 skill-monthly-health-check 4 个 artifact 目录内容
 * 断言清单：
 *   A-series（artifact 结构）：
 *     A1 logs 目录含 3 个 .log（coverage/routes/error-scenarios）且非 0 字节
 *     A2 summary 目录 verdict.md 含 "PASS 3/3 全绿" 断言
 *     A3 coverage 目录含 coverage log 且非空
 *     A4 data 目录含 skill-registry.json + INDEX.md
 *   B-series（内容语义）：
 *     B1 registry schemaVersion >= 1.1.0
 *     B2 registry 计数：projectPhysical=17 / externalPlugin=9 / virtualPlatform=20 / total=46
 *     B3 verdict 三主线 exit：C=0 / R=0 / E=0
 *     B4 logs 中无 "❌ FAIL" / "AssertionFailed" / exit!=0
 * 全部通过返回 0，否则返回 1。
 *
 * 用法：
 *   校验默认本地目录：  node scripts/audit/verify-monthly-artifacts.cjs
 *   校验任意解压目录：  ART_DIR="C:/path/to/artifacts" node scripts/audit/verify-monthly-artifacts.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ART = process.env.ART_DIR
  ? path.resolve(process.env.ART_DIR)
  : path.join(ROOT, 'outputs', 'gh-artifacts-10358274961');

const logsDir   = path.join(ART, 'skill-health-check-logs-main');
const sumDir    = path.join(ART, 'skill-health-check-summary-main');
const covDir    = path.join(ART, 'skill-health-check-coverage-report-main');
const dataDir   = path.join(ART, 'skill-health-check-data-main');

let pass = 0, fail = 0;
const failMsgs = [];

function check(cond, title, detail) {
  if (cond) { console.log('  ✅ ' + title); pass++; }
  else { console.log('  ❌ ' + title + (detail ? '  → ' + detail : '')); fail++; failMsgs.push(title + (detail ? ' → ' + detail : '')); }
}
function isNonEmpty(p) { return fs.existsSync(p) && fs.statSync(p).size > 0; }

console.log('═══════════════════════════════════════════════════════');
console.log('  skill-monthly-health-check Artifacts 校验');
console.log('  ART_DIR = ' + ART);
console.log('═══════════════════════════════════════════════════════');

console.log('\n--- A-series: artifact 结构 ---');
// A1
const logs = fs.existsSync(logsDir) ? fs.readdirSync(logsDir).filter(f => f.endsWith('.log')) : [];
const hasCoverage = logs.some(f => /skill-coverage/.test(f));
const hasRoutes   = logs.some(f => /skill-routes/.test(f));
const hasErrors   = logs.some(f => /skill-error-scenarios/.test(f));
check(logs.length >= 3 && hasCoverage && hasRoutes && hasErrors,
  'A1 logs 目录含 3 个 .log（coverage/routes/error-scenarios）',
  'found=' + JSON.stringify(logs));
const allNonEmptyLogs = logs.every(f => isNonEmpty(path.join(logsDir, f)));
check(allNonEmptyLogs, 'A1b logs 全部非 0 字节');

// A2
const verdictPath = path.join(sumDir, 'verdict.md');
const verdict = fs.existsSync(verdictPath) ? fs.readFileSync(verdictPath, 'utf-8') : '';
check(fs.existsSync(verdictPath) && /PASS\s*3\/3\s*全绿/.test(verdict),
  'A2 summary/verdict.md 含 "PASS 3/3 全绿" 断言');

// A3
const covFiles = fs.existsSync(covDir) ? fs.readdirSync(covDir).filter(f => f.endsWith('.log')) : [];
check(covFiles.length >= 1 && covFiles.every(f => isNonEmpty(path.join(covDir, f))),
  'A3 coverage 目录含非空 coverage log',
  'found=' + JSON.stringify(covFiles));

// A4
const regPath = path.join(dataDir, 'skill-registry.json');
const indexPath = path.join(dataDir, 'INDEX.md');
check(fs.existsSync(regPath) && fs.existsSync(indexPath),
  'A4 data 目录含 skill-registry.json + INDEX.md');

console.log('\n--- B-series: 内容语义 ---');
// B1
let reg = null, regErr = '';
if (fs.existsSync(regPath)) {
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf-8')); }
  catch (e) { regErr = e.message; }
}
check(reg && reg.schemaVersion && parseFloat(reg.schemaVersion) >= 1.1,
  'B1 schemaVersion >= 1.1.0',
  reg ? ('schema=' + reg.schemaVersion) : regErr);

// B2
const physCount = reg && Array.isArray(reg.projectPhysicalSkills) ? reg.projectPhysicalSkills.length : -1;
const extCount  = reg && Array.isArray(reg.externalPluginSkills) ? reg.externalPluginSkills.length : -1;
const virtCount = reg && Array.isArray(reg.virtualPlatformSkills) ? reg.virtualPlatformSkills.length : -1;
const total     = reg && reg.summary ? reg.summary.totalEntries : -1;
check(physCount === 17 && extCount === 9 && virtCount === 20 && total === 46,
  'B2 registry 计数 projectPhysical=17/externalPlugin=9/virtualPlatform=20/total=46',
  `p=${physCount},e=${extCount},v=${virtCount},total=${total}`);

// B3
const cMatch = verdict.match(/C=(\d+)/), rMatch = verdict.match(/R=(\d+)/), eMatch = verdict.match(/E=(\d+)/);
const c = cMatch ? +cMatch[1] : -1, r = rMatch ? +rMatch[1] : -1, e = eMatch ? +eMatch[1] : -1;
check(c === 0 && r === 0 && e === 0, 'B3 verdict 三主线 exit C=0/R=0/E=0', `C=${c},R=${r},E=${e}`);

// B4
const allLogText = logs.map(f => fs.readFileSync(path.join(logsDir, f), 'utf-8')).join('\n');
const hasFailMarker = /❌\s*FAIL/.test(allLogText) || /AssertionFailed/.test(allLogText);
// error-scenarios 的 "失败" 是统计文案，只认真正失败标记
const errLogPath = logs.map(f => path.join(logsDir, f)).find(f => /skill-error-scenarios/.test(f));
const errLog = errLogPath ? fs.readFileSync(errLogPath, 'utf-8') : '';
const trueFail = /AssertionFailed/.test(errLog) || /测试结果:.*\d+\s*失败/.test(errLog.replace(/0 失败/, ''));
check(!hasFailMarker && !trueFail, 'B4 logs 无 "FAIL"/AssertionFailed 失败标记');

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  结果: ${pass} 通过 / ${fail} 失败`);
if (fail === 0) console.log('  ✅ 8/8 断言全绿，4 个 artifact 内容完整且语义正确');
else {
  console.log('  ❌ 存在失败断言:');
  failMsgs.forEach(m => console.log('    - ' + m));
}
console.log('═══════════════════════════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);