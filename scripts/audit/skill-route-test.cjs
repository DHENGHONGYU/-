#!/usr/bin/env node
/**
 * skill-route-test.cjs — SKILL 路由信号匹配测试（9 场景）
 *
 * 评分算法（四档 + 守卫）：
 *   1) 精确匹配 kw === matchValue → ×1000
 *   2) 子串匹配 kw ⊂ matchValue（双向）→ ×10
 *   3) 位置加分 entry.signal.indexOf(matchValue) 越靠前越高(0..100)
 *   4) 决胜加分（关键词数/1000）
 *      守卫 exactMatches+substringMatches>0 才加，完全无关技能直接 score=0 出局
 *      （防重演「查前置门禁误中 Mock 诊断」假阳性 bug）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');

function read(p) {
  let s = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s;
}
function parseRoutes(agents) {
  const routes = [];
  const headerRe = /^\|\s*信号（满足任一即触发.*$/m;
  const hm = agents.match(headerRe);
  if (!hm) return routes;
  const section = agents.slice(hm.index);
  const endRe = /^>\s*\*\*变更纪律\*\*/m;
  const em = section.match(endRe);
  const body = em ? section.slice(0, em.index) : section;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|') || line.includes('---')) continue;
    const placeholders = [];
    const escaped = line.replace(/`[^`]*`/g, (m) => {
      const i = placeholders.length; placeholders.push(m); return `\x00${i}\x00`;
    });
    const cols = escaped.split('|').map(s => s.trim()).filter(Boolean);
    for (let ci = 0; ci < cols.length; ci++)
      cols[ci] = cols[ci].replace(/\x00(\d+)\x00/g, (_, idx) => placeholders[Number(idx)]);
    if (cols.length < 3) continue;
    const [signal, skillCell] = cols;
    if (!skillCell) continue;
    const skillName = (skillCell.match(/`([^`]+)`/) || [, skillCell])[1];
    if (!skillName || ['必加载技能', '技能'].includes(skillName)) continue;
    routes.push({ signal, skill: skillName });
  }
  return routes;
}
function extractKeywords(signalText, skillName) {
  const keywordList = [
    // 关键词表覆盖 AGENTS 路由表 15 项的信号触发词（按 AGENTS.md signal 原文逐段摘取）
    // collection-pipeline-testing
    'data-collector', 'sevenDimConfigStore', 'vitest 失败', 'collection.types.ts',
    // data-flow
    'EnvelopeAction', 'databridge', 'dbConfig.ts', '按钮无响应', '假绿灯', '跨板块数据异常',
    '数据联动',
    // mock-data
    'Mock 残留', 'Mock', '假数据', '信息孤岛', '上线前 Mock 清理',
    // devops
    '定时备份', '批量部署', '注册周期任务', '部署失败', '备份失败', '周期任务',
    // windows
    '环境迁移', '换电脑', '用户目录绝对路径硬编码', 'C:/Users', 'DELL↔Huawei', '路径静默失效',
    // bash
    'Bash', 'bash', 'Bash 命令', 'shell', '终端操作', 'npm run', '路径转换',
    // module-sync
    '任何代码改动交付前', 'src/services|store|core', '模块改动', '模块同步',
    '重构/接口变更/重命名', '新增 skill', '注册表变更',
    // doc-encoding
    '文档乱码', '中文变问号', '中文乱码', 'GBK 二次损坏', 'fix-doc-refs',
    // stale-path
    '文件重命名', '迁移后残留失效链接', '僵尸路径', '僵尸路径扫描', 'move 操作退回',
    'FILE-MANAGEMENT-GUIDE', 'doc-refs 修复前置',
    // tsc-gate-scope
    'tsconfig', 'tsconfig.prod', 'tsconfig.test', 'tsc:prod', 'husky', 'test.ts',
    // tsc-test-error
    'tsc:test', '测试文件类型错误', 'TS2305', 'vi.mock', '契约漂移', '严格空检暴露',
    // mcp-server
    'MCP Server', 'MCP', 'mcp/**', 'Tool', '零调用 server',
    // color-token
    '颜色令牌', 'HEX', '裸色类', 'theme.tokens', 'chartColors', '令牌硬编码',
    // doc-code-dual
    '文档-代码一致性', '文档链接修复前置', '文件迁移后残留扫描', '交叉验证目标文件存在性',
    // finsight-health
    '二次开发前体检', '开发进度', '健康度复检', '门禁回归定位', '状态失准',
    '文档vs现实矛盾核对', '检查进度/健康度',
    // 通用触发
    '改动', '新增', '排查', '修复', '重构',
  ];
  const exacts = [];
  for (const kw of keywordList) if (signalText.includes(kw)) exacts.push(kw);
  // 路径/技能名额外加入 exacts（不区分大小写）
  for (const pathTok of signalText.match(/[A-Za-z0-9_.*\-\/]+\/[A-Za-z0-9_.*\-\/]+/g) || [])
    exacts.push(pathTok);
  // 技能名本身和非 v9 形式都加入，确保自身可命中
  if (skillName) {
    exacts.push(skillName);
    if (skillName.startsWith('v9-')) exacts.push(skillName.slice(3));
  }
  return { keywordList, exacts };
}
// 大小写不敏感比较（保留精确匹配优先级）
function ciEqual(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
function ciIncludes(a, b) { return String(a).toLowerCase().includes(String(b).toLowerCase()); }
// 已知重命名别名映射（AGENTS 用了历史短名，Registry 用了新规范名的情况）
const KNOWN_RENAMES = new Map([
  ['finsight-health-audit', 'v9-health-audit'],
  ['doc-code-dual-proofreading', 'v9-doc-management-principles'],
]);
// 构建 registry name 短名 <-> 长名双向映射（用于期望比对，忽略 v9- 前缀差异）
function loadRegistryNameMap() {
  const regPath = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
  const mapShortToLong = new Map();
  try {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
    for (const s of (reg.skills || [])) {
      if (s.name && s.name.startsWith('v9-')) {
        mapShortToLong.set(s.name.slice(3).toLowerCase(), s.name);
      }
      mapShortToLong.set(s.name.toLowerCase(), s.name);
      // path 末尾目录作为别名
      if (s.path) {
        const m = s.path.match(/\/([^\/]+)\/SKILL\.md$/);
        if (m) {
          mapShortToLong.set(m[1].toLowerCase(), s.name);
          if (m[1].startsWith('v9-')) mapShortToLong.set(m[1].slice(3).toLowerCase(), s.name);
        }
      }
    }
  } catch (e) { /* fallback */ }
  // 合并已知重命名别名
  for (const [from, to] of KNOWN_RENAMES) {
    mapShortToLong.set(from.toLowerCase(), to);
    mapShortToLong.set(to.toLowerCase(), to);
    mapShortToLong.set(to.toLowerCase().replace(/^v9-/, ''), to);
  }
  return mapShortToLong;
}
const nameMap = loadRegistryNameMap();
const routes = parseRoutes(read(AGENTS_PATH));
const routeLookup = routes.map(r => ({
  signal: r.signal,
  skill: r.skill,
  keywords: extractKeywords(r.signal, r.skill),
}));

function findSkillBySignal(_type, matchValue) {
  const candidates = [];
  for (const entry of routeLookup) {
    let exactMatches = 0, substringMatches = 0;
    for (const kw of entry.keywords.exacts) {
      if (ciEqual(kw, matchValue)) exactMatches++;
      else if (ciIncludes(kw, matchValue) || ciIncludes(matchValue, kw)) substringMatches++;
    }
    if (exactMatches === 0 && substringMatches === 0) continue; // 守卫
    let score = exactMatches * 1000 + substringMatches * 10;
    const pos = entry.signal.toLowerCase().indexOf(matchValue.toLowerCase());
    if (pos >= 0) score += Math.max(0, 100 - Math.min(100, pos));
    score += (entry.keywords.exacts.length || 0) / 1000; // 决胜加分（受守卫保护）
    candidates.push({ skill: entry.skill, score, exactMatches, substringMatches });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

// 名字归一化：忽略 v9- 前缀差异，找不到映射则取原值小写
function normName(n) {
  if (!n) return '';
  const key = n.toLowerCase();
  if (nameMap.has(key)) return nameMap.get(key).toLowerCase();
  // 兜底：尝试 strip/add v9-
  if (key.startsWith('v9-') && nameMap.has(key.slice(3))) return nameMap.get(key.slice(3)).toLowerCase();
  if (nameMap.has('v9-' + key)) return nameMap.get('v9-' + key).toLowerCase();
  return key;
}

const scenarios = [
  // 9 场景：matchValue 取 AGENTS 信号列原文真实存在的关键词/术语
  // 技巧：extractKeywords 会把技能名本身和其短名加入 exacts，所以用技能名也能可靠命中
  { name: 'Bash 命令约定',           matchType: 'exact', matchValue: 'Bash 命令',              expected: 'v9-bash-conventions',            reason: '命中 bash 信号列关键字' },
  { name: '模块改动十域同步',         matchType: 'exact', matchValue: '任何代码改动交付前',       expected: 'v9-module-sync-checklist',       reason: 'mandatory 闸口 - 模块改动' },
  { name: '采集链路测试',             matchType: 'exact', matchValue: 'sevenDimConfigStore',       expected: 'v9-collection-pipeline-testing', reason: '数据采集链路七维配置修改' },
  { name: '跨板块数据异常',           matchType: 'exact', matchValue: '跨板块数据异常',           expected: 'v9-data-flow-integrity-audit',   reason: 'DataBridge + 跨板块数据异常' },
  { name: 'Mock 残留诊断',            matchType: 'exact', matchValue: 'Mock 残留',                expected: 'v9-mock-data-diagnosis',         reason: 'Mock→真实切换前的残留扫描' },
  { name: '周期任务注册',             matchType: 'exact', matchValue: '注册周期任务',             expected: 'v9-devops-automation',           reason: '批量部署 / 定时备份 / 周期任务' },
  { name: '文档乱码修复前置',         matchType: 'exact', matchValue: '文档乱码',                 expected: 'v9-doc-encoding-remediation',    reason: 'GBK 二次损坏风险预检' },
  { name: '健康度复检（旧→新名映射）',matchType: 'exact', matchValue: '二次开发前体检',           expected: 'v9-health-audit',                reason: 'finsight-health-audit → v9-health-audit 别名映射' },
  { name: '换电脑环境迁移',           matchType: 'exact', matchValue: '环境迁移',                 expected: 'v9-windows-env-path-doctor',     reason: '用户目录硬编码 / C:/Users 扫描' },
];
function box(title) {
  const w = 64;
  const line = '═'.repeat(w - 2);
  const L = Math.floor((w - 4 - title.length) / 2);
  const R = w - 4 - title.length - L;
  return `╔${line}╗\n║ ${' '.repeat(L)}${title}${' '.repeat(R)} ║\n╚${line}╝`;
}
console.log('\n' + box('SKILL 路由信号匹配测试（9 场景）'));
let pass = 0, fail = 0;
for (let i = 0; i < scenarios.length; i++) {
  const sc = scenarios[i];
  const result = findSkillBySignal(sc.matchType, sc.matchValue);
  const hit = result ? result.skill : '(空)';
  if (!result) {
    console.log(`  ❌ ${i+1}. [${sc.name}] → (空)  期望: ${sc.expected}  (${sc.reason})`);
    fail++;
  } else if (normName(result.skill) === normName(sc.expected)) {
    console.log(`  ✅ ${i+1}. [${sc.name}] → ${hit}  (期望: ${sc.expected}, ${sc.reason})`);
    pass++;
  } else {
    console.log(`  ❌ ${i+1}. [${sc.name}] → ${hit}  期望: ${sc.expected}  (${sc.reason})`);
    console.log(`       - ${hit}  score=${result.score.toFixed(3)}  exact=${result.exactMatches} sub=${result.substringMatches}`);
    fail++;
  }
}
console.log(`\n结果: ${pass} passed / ${fail} failed / 总 ${scenarios.length}`);
if (fail > 0) process.exit(1);
