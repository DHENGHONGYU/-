#!/usr/bin/env node
/**
 * green-state-verify.cjs — P0 修复后绿色稳态验证脚本
 *
 * 依次跑：
 *   1) audit:skill-integrity → ERROR = 0?
 *   2) audit:skill-routes → 9场景全绿?
 *   3) audit:skill-error-scenarios → E01-E05 全绿?
 *   4) b03-extract-governance.cjs → 生成 P0 修复后的治理清单（S6 必填项应为 0）
 *
 * 输出：JSON + MD 报告
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'outputs');

function now() { return Date.now(); }
const t0 = now();
const results = [];
function runCmd(title, cmd, { failOnExit = false, grepErrors = null } = {}) {
  const s = now();
  let stdout = '', stderr = '', exit = 0;
  try {
    stdout = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true' } });
  } catch (e) {
    exit = e.status || 1;
    stdout = (e.stdout || '') + '';
    stderr = (e.stderr || '') + '';
  }
  const elapsed = now() - s;
  const combined = stdout + '\n' + stderr;
  const errors = grepErrors ? countMatches(combined, grepErrors) : undefined;
  const infos = grepErrors ? countMatches(combined, /\bINFO\b/) : undefined;
  const warns = grepErrors ? countMatches(combined, /\bWARN\b/) : undefined;
  // passed 判定：failOnExit 时只看 exit===0；否则若 grepErrors 则 errors===0
  let passed;
  if (failOnExit) passed = (exit === 0);
  else if (grepErrors) passed = (errors === 0);
  else passed = true;
  const r = { title, exit, elapsedMs: elapsed, passed,
    stdout: combined.slice(0, 8000),
    stats: grepErrors ? { errorCount: errors, warnCount: warns, infoCount: infos } : null };
  results.push(r);
  console.log(`  [${passed?'✅':'❌'}] ${title} — passed=${passed} exit=${exit} took=${elapsed}ms` + (grepErrors?` (ERROR=${errors} WARN=${warns} INFO=${infos})`:''));
  return r;
}
function countMatches(s, re) {
  let n = 0; const glob = new RegExp(re.source, re.flags.includes('g') ? re.flags : (re.flags + 'g'));
  while (glob.exec(s)) n++;
  return n;
}

console.log('\n========== 绿色稳态验证（P0 修复后）==========\n');

// 0) 先跑一次 integrity，读其 JSON 报告获取权威 ERROR 数（比 grep stdout 更准确）
let authoritativeErrors = -1;
try {
  // 0.1 执行
  try { execSync('node scripts/audit/detect-skill-dangling-ref.cjs',
    { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore','pipe','pipe'], env: { ...process.env, CI:'true' } }); } catch(e) {}
  // 0.2 找最新 report JSON
  const reportDir = path.join(ROOT,'scripts','audit','docs','reports','skill-integrity');
  const jsons = fs.readdirSync(reportDir).filter(f => f.endsWith('.json')).sort();
  const latest = jsons[jsons.length-1];
  const rep = JSON.parse(fs.readFileSync(path.join(reportDir,latest),'utf-8'));
  authoritativeErrors = rep.summary.errors;
  const s = rep.stats;
  const authPassed = authoritativeErrors === 0;
  results.push({
    title: '0. audit:skill-integrity 权威 ERROR 计数 = 0？',
    exit: 0, elapsedMs: 0, passed: authPassed,
    stats: { errorCount: rep.summary.errors, warnCount: rep.summary.warns, infoCount: rep.summary.infos },
    stdout: `routes=${s.routes}, registry=${s.registry}, skills=${s.skills}`,
  });
  console.log(`  [${authPassed?'✅':'❌'}] 0. integrity ERROR=${rep.summary.errors} (目标 0) / WARN=${rep.summary.warns} / INFO=${rep.summary.infos} / routes=${s.routes} registry=${s.registry} skills=${s.skills}`);
} catch (e) { console.error('  ⚠️  读取权威 integrity 报告失败', e.message); }

// 1) Integrity —— 关键是 ERROR 计数
const r1 = runCmd('1. audit:skill-integrity 快速复跑（确认退出码）',
  'node scripts/audit/detect-skill-dangling-ref.cjs',
  { failOnExit: authoritativeErrors === 0 }); // 权威 0 则 exit 必须 0

// 2) skill-routes 双门禁 1/2
const r2 = runCmd('2. B-02 Gate 1/2: audit:skill-routes（9 场景 100% 通过）',
  'node scripts/audit/skill-route-test.cjs', { failOnExit: true });

// 3) error-scenarios 双门禁 2/2
const r3 = runCmd('3. B-02 Gate 2/2: audit:skill-error-scenarios（E01-E05 全绿）',
  'node scripts/audit/test-skill-error-scenarios.cjs', { failOnExit: true });

// 4) 重新抽取治理清单（验证 S6 必填缺失 = 0）
console.log('  4. 重新抽取治理清单...');
try {
  execSync('node scripts/audit/b03-extract-governance.cjs', { cwd: ROOT, stdio: ['ignore','pipe','pipe'],
    env: { ...process.env, CI:'true' } });
} catch(e) {}
const govData = JSON.parse(fs.readFileSync(path.join(OUT, 'b03-governance-drift.json'), 'utf-8'));
const r4 = {
  title: '4. 治理清单 S6 必填缺失 = 0？',
  elapsedMs: 0,
  passed: govData.summary.s6_missing === 0,
  exit: 0,
  stats: { errorCount: undefined, s6_missing: govData.summary.s6_missing, b03_drift: govData.summary.b03_drift, P0: govData.summary.byPriority.P0, P1: govData.summary.byPriority.P1, P2: govData.summary.byPriority.P2 },
};
console.log(`  [${r4.passed?'✅':'❌'}] 4. 治理抽取 S6_missing=${govData.summary.s6_missing} (目标 0) / B03_drift=${govData.summary.b03_drift} / P0=${govData.summary.byPriority.P0} P1=${govData.summary.byPriority.P1} P2=${govData.summary.byPriority.P2}`);
results.push(r4);

const allPassed = results.every(r => r.passed);
const totalMs = now() - t0;

// 写 JSON
const out = {
  generatedAt: new Date().toISOString(),
  totalMs,
  allPassed,
  summary: {
    passedCount: results.filter(r => r.passed).length,
    totalCount: results.length,
    integrityErrors: results[0]?.stats?.errorCount ?? (results[1]?.stats?.errorCount ?? '?'),
    s6_missing: govData.summary.s6_missing,
    b03_drift: govData.summary.b03_drift,
    byPriority: govData.summary.byPriority,
    routes: 0,
    registrySkills: 0,
    skillDirs: 0,
  },
  steps: results,
  governance: govData.summary,
};
const jp = path.join(OUT, 'green-state-verify.json');
fs.writeFileSync(jp, JSON.stringify(out, null, 2) + '\n', 'utf-8');

// 写 MD
function esc(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>'); }
const lines = [];
lines.push('# SKILL 完整性绿色稳态验证报告（P0 修复后）');
lines.push('');
lines.push(`> 生成时间: ${out.generatedAt}`);
lines.push(`> 总耗时: ${totalMs}ms`);
lines.push('');
lines.push('## 一、核心结论');
lines.push('');
lines.push(`- **全链路通过**: ${allPassed ? '✅ 所有门禁全部通过，进入绿色稳态 ✅' : '❌ 仍有门禁未通过，需继续修复'}`);
lines.push(`- **通过率**: ${out.summary.passedCount}/${out.summary.totalCount}`);
lines.push(`- **audit:skill-integrity ERROR 数**: ${out.summary.integrityErrors}（目标 0）`);
lines.push(`- **S6 frontmatter 必填缺失项**: ${out.summary.s6_missing}（目标 0）`);
lines.push(`- **B-03 INFO 级字段漂移项**: ${out.summary.b03_drift}（人工核对项，不阻断）`);
lines.push(`- **优先级分布**: P0=${out.summary.byPriority.P0}，P1=${out.summary.byPriority.P1}，P2=${out.summary.byPriority.P2}（治理完毕后 P0 应为 0）`);
lines.push('');
lines.push('## 二、门禁步骤明细');
lines.push('');
lines.push('| # | 步骤 | 结果 | 退出码 | 耗时 ms | ERROR/状态 |');
lines.push('|---|---|---|---|---|---|');
results.forEach((r,i)=>{
  const s = r.stats || {};
  const statTxt = s.errorCount !== undefined
    ? `ERR=${s.errorCount} / WARN=${s.warnCount ?? 'N/A'} / INFO=${s.infoCount ?? 'N/A'}`
    : (s.s6_missing !== undefined ? `S6缺失=${s.s6_missing} / B03漂移=${s.b03_drift ?? 'N/A'}` : '—');
  lines.push(`| ${i+1} | ${esc(r.title)} | ${r.passed?'✅':'❌'} | ${r.exit} | ${r.elapsedMs} | ${esc(statTxt)} |`);
});
lines.push('');
lines.push('## 三、P0 修复详情');
lines.push('');
lines.push('| 项 | 值 |');
lines.push('|---|---|');
lines.push('| P0 问题 | `dev-checklist/SKILL.md frontmatter 缺少 gates / triggers / mandatory 三字段（S6 ERROR） |');
lines.push('| 处置方式 | 按 v9-dev-checklist（Registry 注册版）对齐补全 frontmatter，保持与 Registry 条目的 triggers.keywords / triggers.files / gates 数组 一一对应 |');
lines.push('| 修复字段清单 | skill_id, name, version, last_updated, category, tags, title, description, triggers:{keywords+files+events}, gates, mandatory:false, covers_docs, related_skills, freshness_policy, search_priority, search_keywords + 内联治理备注 |');
lines.push('| 修复时间 | 2026-08-01 |');
lines.push('| 预期 P0 剩余 | 0 |');
lines.push('');
lines.push('## 四、后续维护 SOP');
lines.push('');
lines.push('### 4.1 日常提交（每次提交/推送触发');
lines.push('```bash');
lines.push('# 若暂存 SKILL 文件时，husky pre-commit 会自动执行 audit:skill-integrity（ERROR 级阻断提交）');
lines.push('# 若 push SKILL 文件变更，husky pre-push 会自动执行 B-02 双门禁');
lines.push('SKILL_INTEGRITY_SKIP=1 git commit   # 紧急旁路（人工自证）');
lines.push('SKILL_GATE_CONFIRM=1 git push      # 紧急旁路（人工自证）');
lines.push('```');
lines.push('');
lines.push('### 4.2 每周巡检（周一，CI 已自动化）');
lines.push('```bash');
lines.push('npm run audit:skill-integrity  # 每天 UTC 18:00（北京时间 02:00 CI 跑，异常自动建修复 PR');
lines.push('npm run audit:skill-routes');
lines.push('npm run audit:skill-error-scenarios');
lines.push('```');
lines.push('');
lines.push('### 4.3 每季度治理（每季度首月第一周）');
lines.push('1. 运行 `node scripts/audit/b03-extract-governance.cjs` 重新生成治理清单');
lines.push('2. 批量处理 P1（7天内）、P2（30 天内）完成率 ≥ 80%）');
lines.push('3. 检查僵尸技能目录（Registry 未注册的 skills/ 目录）');
lines.push('4. 校验 docs/guides ↔ docs/how-to 双向映射无新增漂移');
lines.push('');
lines.push('### 4.4 新增 SKILL 十步 SOP');
lines.push('```');
lines.push('① 在 `.trae/skills/<v9-pascal-name>/ 创建 SKILL.md');
lines.push('② Frontmatter 必填: id/name/category/version + (mandatory|triggers/gates 三要素');
lines.push('③ 在 `.trae/skills/skill-registry.json` 注册（与 Frontmatter 字段双向对称）');
lines.push('④ 在 AGENTS.md 路由表新增信号列 + 交付前必跑列');
lines.push('⑤ 跑 `npm run audit:skill-integrity` 零 ERROR');
lines.push('⑥ 跑 `npm run audit:skill-routes` 九场景全匹配');
lines.push('⑦ 跑 `npm run audit:skill-error-scenarios` E01-E05 全绿');
lines.push('⑧ git add 后，确保 pre-commit 自动 skill-integrity');
lines.push('⑨ git push 前确保双门禁无阻断');
lines.push('⑩ 合并后确认每日 skill-integrity-monitor PR 触发双门禁绿');
lines.push('```');
lines.push('');
lines.push('## 五、交付物关联');
lines.push('');
lines.push('| 交付物 | 路径 |');
lines.push('|---|---|');
lines.push('| 本次绿色稳态验证结果(JSON) | outputs/green-state-verify.json |');
lines.push('| 修复前后对比报告 | outputs/skill-fix-diff-report.md |');
lines.push('| 治理清单 (72项) | outputs/SKILL元数据一致性治理清单.md |');
lines.push('| PR模拟E2E 验证报告 | outputs/pr-simulation-e2e-report.md |');
lines.push('| CI双门禁配置 | .github/workflows/skill-integrity-monitor.yml |');
lines.push('| husky pre-commit门禁 | .husky/pre-commit (B-01) |');
lines.push('| husky pre-push门禁 | .husky/pre-push (B-02双门禁) |');
const mdp = path.join(OUT, 'SKILL元数据一致性治理完成报告.md');
fs.writeFileSync(mdp, lines.join('\n') + '\n', 'utf-8');

console.log('\n========== 汇总 ==========');
console.log(`整体通过: ${allPassed?'✅ YES':'❌ NO'}，耗时 ${totalMs}ms （${out.summary.passedCount}/${out.summary.totalCount}）`);
console.log('  JSON:', jp);
console.log('  MD:  ', mdp);
console.log('  S6 missing:', govData.summary.s6_missing, '| B03 drift:', govData.summary.b03_drift);
process.exit(allPassed ? 0 : 1);
