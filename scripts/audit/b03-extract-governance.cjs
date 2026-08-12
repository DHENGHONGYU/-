#!/usr/bin/env node
/**
 * b03-extract-governance.cjs — 抽取 Step 2.6 B-03 frontmatter↔Registry 漂移项
 * 并生成《SKILL元数据一致性治理清单》的结构化数据
 *
 * 输出 JSON: outputs/b03-governance-drift.json
 * 输出 MD:   outputs/SKILL元数据一致性治理清单.md
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const SKILLS_DIR = path.join(ROOT, '.trae', 'skills');
const OUT = path.join(ROOT, 'outputs');

function readTextNormalized(p) {
  let s = fs.readFileSync(p, 'utf-8');
  if (s.charCodeAt(s.length - 1) === 0xFEFF) s = s.slice(0, -1);
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function parseCoversOrRelated(fm, key) {
  const reInline = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`);
  const mInline = fm.match(reInline);
  if (mInline) return splitArrayItems(mInline[1]);
  const reList = new RegExp(`${key}:\\s*\\n((?:\\s*-\\s*[^\\n]*\\n?)+)`, 'm');
  const mList = fm.match(reList);
  if (mList) {
    return mList[1].split('\n')
      .map(s => s.trim()).filter(s => s.startsWith('-'))
      .map(s => s.replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }
  return [];
}
function splitArrayItems(listStr) {
  const items = []; let cur = '', inQ = null, depth = 0;
  for (let i = 0; i < listStr.length; i++) {
    const c = listStr[i];
    if (inQ) { cur += c; if (c === inQ) inQ = null; continue; }
    if (c === '"' || c === "'") { inQ = c; cur += c; continue; }
    if (c === '[') { depth++; cur += c; continue; }
    if (c === ']') { depth--; cur += c; continue; }
    if (c === ',' && depth === 0) { items.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) items.push(cur.trim());
  return items.map(s => s.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
}
function getLine(fm, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, 'mi');
  const m = fm.match(re);
  return m ? m[1].trim() : '';
}
function stripQuotes(s) { return (s || '').replace(/^["']|["']$/g, '').trim(); }
function getBool(fm, key) {
  const v = getLine(fm, key).toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return '';
}
function getListStr(fm, key) {
  const inline = parseCoversOrRelated(fm, key);
  if (inline.length) return inline.map(x => String(x)).join('|');
  const v = getLine(fm, key);
  if (v.startsWith('[') || v.startsWith('{')) return v;
  return v;
}
function extractFrontmatterKeyFields(fm) {
  return {
    id: stripQuotes(getLine(fm, 'id') || getLine(fm, 'skill_id')),
    name: stripQuotes(getLine(fm, 'name')),
    category: stripQuotes(getLine(fm, 'category')),
    version: stripQuotes(getLine(fm, 'version')),
    triggersText: getListStr(fm, 'triggers'),
    gatesText: getListStr(fm, 'gates'),
    mandatory: getBool(fm, 'mandatory'),
    covers_docs: parseCoversOrRelated(fm, 'covers_docs').sort().join('|'),
    related_skills: parseCoversOrRelated(fm, 'related_skills').sort().join('|'),
    tags: parseCoversOrRelated(fm, 'tags').join('|'),
  };
}
function arrOrObjStr(a) {
  if (Array.isArray(a)) return a.map(x => (typeof x === 'string') ? x : JSON.stringify(x)).sort().join('|');
  if (a && typeof a === 'object') {
    const parts = [];
    for (const k of Object.keys(a).sort()) parts.push(`${k}:${arrOrObjStr(a[k])}`);
    return parts.join('|');
  }
  return String(a ?? '');
}
function registryKeyFields(reg) {
  return {
    id: String(reg.id ?? ''),
    name: String(reg.name ?? ''),
    category: String(reg.category ?? ''),
    version: String(reg.version ?? ''),
    triggersText: arrOrObjStr(reg.triggers),
    gatesText: arrOrObjStr(reg.gates),
    mandatory: (typeof reg.mandatory === 'boolean') ? reg.mandatory : '',
    covers_docs: (Array.isArray(reg.covers_docs) ? reg.covers_docs : []).sort().join('|'),
    related_skills: (Array.isArray(reg.related_skills) ? reg.related_skills : []).sort().join('|'),
    tags: (Array.isArray(reg.tags) ? reg.tags : []).sort().join('|'),
  };
}
function toDashName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function normStr(s) { return String(s ?? '').toLowerCase().replace(/[\s|,;]+/g, ''); }
function looseEqual(a, b) {
  return normStr(a) === normStr(b);
}
function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function driftSeverity(field, fmVal, regVal) {
  // P0: id / name 不一致（三源主键漂移，路由命中可能直接失败）
  // P1: mandatory / category / triggersText / gatesText 不一致（语义行为偏差）
  // P2: version / tags / covers_docs / related_skills（信息类不一致）
  if (['id','name'].includes(field)) return { prio: 'P0', sla: '24h', dead: '关键主键漂移会导致路由命中、注册表查询失败' };
  if (['mandatory','category','triggersText','gatesText'].includes(field)) return { prio: 'P1', sla: '7天', dead: '语义漂移：mandatory决定是否强制加载；category 影响 UI 分组；triggers/gates 直接影响路由匹配' };
  return { prio: 'P2', sla: '30天', dead: '元数据/附属引用类漂移：暂不影响功能但会造成查询结果不一致' };
}
function driftDegree(fmVal, regVal) {
  const a = normStr(fmVal), b = normStr(regVal);
  if (a === '' || b === '') return '完全缺失（一端为空）';
  const LCS = lcsLen(a, b);
  const total = Math.max(a.length, b.length, 1);
  const sim = LCS / total;
  if (sim >= 0.9) return '轻度（≥90% 相似）';
  if (sim >= 0.6) return '中度（60-90% 相似）';
  return '严重（<60% 相似）';
}
function lcsLen(a, b) {
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const dp = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = (a[i - 1] === b[j - 1]) ? (prev + 1) : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}
function fixSteps(field, fmVal, regVal) {
  const fmEdit = `.trae/skills/<skill>/SKILL.md frontmatter → ${field}`;
  const regEdit = `.trae/skills/skill-registry.json → <skill> entry.${field}`;
  switch (field) {
    case 'id':
      return [
        `1) 检查 SKILL.md 中 \`id:\` 与 Registry.json 中 \`id:\` 两值：FM="${truncate(fmVal,60)}" vs REG="${truncate(regVal,60)}"`,
        `2) 以文档 / 对外公开 ID 为权威，同步修改非权威端（${fmEdit} 或 ${regEdit}）`,
        `3) 验证：重新跑 \`npm run audit:skill-integrity\` → INFO 消失，且 AGENTS 路由表 9 场景匹配仍 100% 通过`,
      ];
    case 'name':
      return [
        `1) skill 目录名、Registry.name、SKILL.md name 三端必须严格一致（大小写+前缀）`,
        `2) 若改 name → 需同步 AGENTS.md 路由表对应行的 skill 列，并同步相关引用的 related_skills 字段`,
        `3) 验证：\`npm run audit:skill-integrity\` + \`npm run audit:skill-routes\` 全绿`,
      ];
    case 'category':
      return [
        `1) 统一枚举值参考项目内其他 SKILL 的 category（docs / devops / analysis / frontend / databridge 等）`,
        `2) 以 SKILL.md 为权威（用户编辑的分类更贴近真实语义）同步到 Registry，或反之按 Registry 的分类标准修正 SKILL.md`,
        `3) 验证：\`npm run audit:skill-integrity\` INFO 消失；前端 UI 技能分类分组显示正确`,
      ];
    case 'mandatory':
      return [
        `1) 决定该技能是否必加载（mandatory=true/false）—— 查阅项目 mandatory 策略`,
        `2) 统一两端取值为同一布尔：${fmEdit} 的 mandatory: 与 ${regEdit} 的 mandatory 字段保持一致`,
        `3) 验证：\`npm run audit:skill-integrity\` INFO 消失；前端启动时 mandatory 技能加载列表两边数量一致`,
      ];
    case 'triggersText':
    case 'gatesText':
      return [
        `1) triggers/gates 大文本漂移属于正常扩展（SKILL.md 倾向更完整描述；Registry 是最小关键字集合）`,
        `2) 核心要求：Registry 中的关键字集合必须是 SKILL.md triggers/gates 的**子集**，否则会有路由抓不到的场景`,
        `3) 操作：对比两端关键字词，将 SKILL.md 中**漏写**的关键触发词同步回 Registry 的 triggers.keywords 数组；超集（SKILL.md 比 Registry 丰富）无需回写 SKILL.md`,
        `4) 验证：\`npm run audit:skill-routes\` 9 场景仍 100% 通过；\`npm run audit:skill-error-scenarios\` E01-E05 全绿`,
      ];
    case 'version':
      return [
        `1) version 建议以 SKILL.md 中的版本号（更贴近作者自维护的真实发布版本）为权威同步回 Registry`,
        `2) 修改 ${regEdit} → version`,
        `3) 验证：再次跑本脚本，该漂移项消失`,
      ];
    case 'tags':
      return [
        `1) tags 属于检索增强字段，建议并集：两端 tag 去重后合并；同步写回 ${fmEdit} 与 ${regEdit}`,
        `2) 按业务语义剔重（如 "审计" vs "审核" 选一个规范写法）`,
        `3) 验证：前端技能检索功能输入任一标签，技能均命中显示`,
      ];
    case 'covers_docs':
      return [
        `1) covers_docs 数组漂移常见于"SKILL.md 声明覆盖某文档但 Registry 未同步注册"或反向`,
        `2) 校验每一条路径都 fs.existsSync 真实存在；自动修复未覆盖的先手动运行 \`npm run audit:skill-integrity -- --fix\``,
        `3) 然后将两边数组的路径并集（只保留真实存在的）同步写入 ${fmEdit} 和 ${regEdit}`,
        `4) 验证：\`npm run audit:skill-integrity\` 无 ERROR；INFO 消失`,
      ];
    case 'related_skills':
      return [
        `1) 核对每一个 related_skill 的 skill 名在 Registry 中确实存在；并集同步到两边`,
        `2) 避免循环引用（A→B 且 B→A 允许，但 A→A 需删除）`,
        `3) 验证：\`npm run audit:skill-integrity\` INFO 消失且无 related_skills 悬空 ERROR`,
      ];
    default:
      return [`1) 人工比对 SKILL.md ↔ Registry 字段 ${field}`, `2) 同步统一取值`, `3) 运行 integrity + routes 双门禁验证`];
  }
}
function verificationStd(field) {
  return [
    `① \`npm run audit:skill-integrity\` 输出中不再出现本项 INFO`,
    `② \`npm run audit:skill-routes\` → 9 场景路由匹配 100% 通过`,
    `③ \`npm run audit:skill-error-scenarios\` → E01-E05 全绿`,
  ];
}

// ============ MAIN ============
const registryAll = JSON.parse(readTextNormalized(REGISTRY_PATH));
const registry = new Map();
(registryAll.active || registryAll.skills || []).forEach(e => { if (e && e.name) registry.set(e.name, e); });

const skillFiles = [];
for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sm = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
  if (!fs.existsSync(sm)) continue;
  const content = readTextNormalized(sm);
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fmRaw = fmMatch ? fmMatch[1] : '';
  const fm = fmRaw.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  skillFiles.push({ name: entry.name, path: sm, front: extractFrontmatterKeyFields(fm) });
}
const skillByName = new Map(skillFiles.map(s => [s.name, s]));

const COMPARE_KEYS = [
  ['id', 'id'], ['name', 'name'], ['category', 'category'], ['version', 'version'],
  ['mandatory', 'mandatory'], ['tags', 'tags'],
  ['covers_docs', 'covers_docs'], ['related_skills', 'related_skills'],
  ['triggersText', 'triggers (关键字集合)'], ['gatesText', 'gates (关键字集合)'],
];
const driftItems = [];
for (const reg of registry.values()) {
  const skill = skillByName.get(reg.name) || skillByName.get(toDashName(reg.name));
  if (!skill) continue;
  const a = skill.front;
  const b = registryKeyFields(reg);
  for (const [prop, label] of COMPARE_KEYS) {
    const av = a[prop]; const bv = b[prop];
    if (av === '' && (bv === '' || bv === null || bv === undefined)) continue;
    if (prop === 'mandatory' && (av === '' || bv === '')) continue;
    if (prop === 'version' && (av === '' || bv === '')) continue;
    if (!looseEqual(av, bv)) {
      const sev = driftSeverity(prop, av, bv);
      driftItems.push({
        idx: driftItems.length + 1,
        skillName: reg.name,
        field: prop,
        fieldLabel: label,
        fieldPath_skillMd: `${skill.path}#frontmatter:${prop}`,
        fieldPath_registry: `${REGISTRY_PATH}#active[].name=${reg.name}.${prop}`,
        value_FM: av,
        value_Registry: bv,
        driftDegree: driftDegree(av, bv),
        priority: sev.prio,
        sla: sev.sla,
        impact: sev.dead,
        fixSteps: fixSteps(prop, av, bv),
        verification: verificationStd(prop),
        autoFixable: false,
      });
    }
  }
}

// 补充: frontmatter 必填项缺失 (gates / triggers / mandatory) — 属于 S6 的 ERROR 级也需要人工修
for (const s of skillFiles) {
  const reg = registry.get(s.name);
  if (reg) continue; // 已注册的前已覆盖
}
const s6Missing = [];
for (const s of skillFiles) {
  const fmRaw = s.path && readTextNormalized(s.path).match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  const fm = fmRaw.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  const hasGates = /gates:\s*(\[|\{|\n\s+-|\n\s+[a-zA-Z_])/.test(fm);
  const hasTriggers = /triggers:\s*(\[|\{|\n\s+-|\n\s+[a-zA-Z_])/.test(fm);
  const hasMandatory = /mandatory:\s*(true|false)/.test(fm);
  if (!hasGates || !hasTriggers || !hasMandatory) {
    const regEntry = registry.get(s.name);
    const mandatoryHint = regEntry && typeof regEntry.mandatory === 'boolean' ? String(regEntry.mandatory) : 'true/false';
    s6Missing.push({
      idx: driftItems.length + s6Missing.length + 1,
      skillName: s.name,
      field: 'frontmatter_required_missing',
      fieldLabel: 'frontmatter 必填字段缺失',
      fieldPath_skillMd: `${s.path}#frontmatter`,
      value_FM: `gates=${hasGates}, triggers=${hasTriggers}, mandatory=${hasMandatory}`,
      value_Registry: '—',
      driftDegree: '完全缺失',
      priority: hasGates && hasTriggers ? 'P1' : 'P0',
      sla: hasGates && hasTriggers ? '7天' : '24h',
      impact: '必填字段缺失会导致 S6 frontmatter 完整性 ERROR，阻断 pre-commit 与 CI 合并流',
      fixSteps: [
        `1) 打开 ${s.path}，在 frontmatter 中补齐以下字段：`,
        `   mandatory: ${mandatoryHint}  # 布尔值`,
        `   triggers: { keywords: ["关键词1", "关键词2"] }`,
        `   gates: ["run tsc", "run test", "run audit:skill-integrity"]  # 交付前必跑门禁列表`,
        `2) 参考同目录其他 SKILL.md 的 triggers/gates 写法保持格式一致`,
        `3) 验证：\`npm run audit:skill-integrity\` → 不再报该 SKILL 的 ERROR 级 "缺少 gates/triggers/mandatory"`,
      ],
      verification: [
        `① \`npm run audit:skill-integrity\` 无 ERROR`,
        `② frontmatter 三字段均存在且格式合法`,
        `③ \`npm run audit:skill-routes\` 仍全绿（若该技能已在路由表中）`,
      ],
      autoFixable: false,
    });
  }
}
const allItems = [...driftItems, ...s6Missing];
const byPrio = { P0: [], P1: [], P2: [] };
for (const it of allItems) (byPrio[it.priority] ||= []).push(it);

// 写 JSON
fs.writeFileSync(path.join(OUT, 'b03-governance-drift.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      total: allItems.length,
      b03_drift: driftItems.length,
      s6_missing: s6Missing.length,
      byPriority: { P0: byPrio.P0.length, P1: byPrio.P1.length, P2: byPrio.P2.length },
      autoFixable: allItems.filter(x => x.autoFixable).length,
      manualRequired: allItems.filter(x => !x.autoFixable).length,
    },
    items: allItems,
  }, null, 2) + '\n', 'utf-8');

// 写 MD
function esc(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>'); }
function trunc(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
const lines = [];
lines.push('# SKILL 元数据一致性治理清单（B-03 + S6）');
lines.push('');
lines.push(`> 生成时间: ${new Date().toISOString()}`);
lines.push(`> 数据源: SKILL.md frontmatter ↔ .trae/skills/skill-registry.json (Step 2.6 B-03 双向比对 + Step 6 完整性审计)`);
lines.push('');
lines.push('## 一、总览');
lines.push('');
lines.push('| 指标 | 数值 |');
lines.push('|---|---|');
lines.push(`| **待人工核对项总数** | **${allItems.length}** |`);
lines.push(`| 其中 B-03 Frontmatter↔Registry 字段漂移 | ${driftItems.length} |`);
lines.push(`| 其中 S6 frontmatter 必填字段缺失 (gates/triggers/mandatory) | ${s6Missing.length} |`);
lines.push(`| 优先级分布 | P0=${byPrio.P0.length}（阻塞级 24h 内）， P1=${byPrio.P1.length}（严重级 7 天内）， P2=${byPrio.P2.length}（优化级 30 天内） |`);
lines.push(`| 可自动修复 | ${allItems.filter(x=>x.autoFixable).length} |`);
lines.push(`| **需人工修复（本清单覆盖）** | **${allItems.filter(x=>!x.autoFixable).length}** |`);
lines.push('');
lines.push('### 优先级说明');
lines.push('');
lines.push('| 级别 | 触发条件 | 处理时限 | 影响面 |');
lines.push('|---|---|---|---|');
lines.push('| **P0 阻塞级** | id / name 主键漂移；gates/triggers/mandatory 三字段缺失导致 ERROR | 24 小时 | 路由命中失败 / 三源引用错位 / pre-commit 与 CI 阻断提交合并流 |');
lines.push('| **P1 严重级** | mandatory / category / triggers / gates 语义漂移 | 7 天 | mandatory 误判导致技能不加载；分类错误导致 UI 分组错位；triggers/gates 漂移导致抓不到场景或门禁缺失 |');
lines.push('| **P2 优化级** | version / tags / covers_docs / related_skills 元数据类漂移 | 30 天 | 不影响功能但影响文档索引、技能检索结果一致性、统计报表准确性 |');
lines.push('');
lines.push('## 二、P0 阻塞级人工核对清单（建议 24h 内修复）');
lines.push('');
lines.push(`> 共 **${byPrio.P0.length}** 项 — 直接影响 pre-commit / CI 合并流，建议优先指派专人处理。`);
lines.push('');
for (const it of byPrio.P0) {
  lines.push(`### P0-${it.idx}. ${it.skillName} — ${it.fieldLabel}`);
  lines.push('');
  lines.push(`- **字段路径（SKILL.md 端）**: \`${it.fieldPath_skillMd}\``);
  lines.push(`- **字段路径（Registry 端）**: \`${it.fieldPath_registry}\``);
  lines.push(`- **当前值（SKILL.md frontmatter）**: ${esc(trunc(it.value_FM, 200))}`);
  lines.push(`- **期望/Registry 取值**: ${esc(trunc(it.value_Registry, 200))}`);
  lines.push(`- **漂移程度**: ${it.driftDegree}`);
  lines.push(`- **影响说明**: ${it.impact}`);
  lines.push(`- **建议修复步骤**:`);
  for (const s of it.fixSteps) lines.push(`  ${s}`);
  lines.push(`- **验证修正结果的方法与标准**:`);
  for (const v of it.verification) lines.push(`  - ${v}`);
  lines.push('');
}
lines.push('## 三、P1 严重级人工核对清单（建议 7 天内修复）');
lines.push('');
lines.push(`> 共 **${byPrio.P1.length}** 项 — 虽不立即阻断提交，但会造成语义行为偏差 / 分类分组错位 / 路由匹配或门禁抓不到。`);
lines.push('');
for (const it of byPrio.P1) {
  lines.push(`### P1-${it.idx}. ${it.skillName} — ${it.fieldLabel}`);
  lines.push('');
  lines.push(`| 维度 | 信息 |`);
  lines.push('|---|---|');
  lines.push(`| 字段路径 (SKILL.md) | \`${esc(it.fieldPath_skillMd)}\` |`);
  lines.push(`| 字段路径 (Registry) | \`${esc(it.fieldPath_registry)}\` |`);
  lines.push(`| 当前值 FM | ${esc(trunc(it.value_FM, 300))} |`);
  lines.push(`| 当前值 Registry | ${esc(trunc(it.value_Registry, 300))} |`);
  lines.push(`| 漂移程度 | ${it.driftDegree} |`);
  lines.push(`| 优先级 / 时限 | ${it.priority} / ${it.sla} |`);
  lines.push(`| 影响面 | ${esc(it.impact)} |`);
  lines.push(`| 修复步骤 | ${it.fixSteps.map(x => esc(x)).join('<br>')} |`);
  lines.push(`| 验证方法与标准 | ${it.verification.map(x => esc(x)).join('<br>')} |`);
  lines.push('');
}
lines.push('## 四、P2 优化级人工核对清单（建议 30 天内清理）');
lines.push('');
lines.push(`> 共 **${byPrio.P2.length}** 项 — 元数据/引用类，纯信息一致性治理，可批量排期迭代。`);
lines.push('');
lines.push('| # | Skill 名称 | 字段 | 当前值 (FM) | 期望/Registry 值 | 漂移程度 | 处理时限 |');
lines.push('|---|---|---|---|---|---|---|');
for (const it of byPrio.P2) {
  lines.push(`| ${it.idx} | ${esc(it.skillName)} | ${esc(it.fieldLabel)} | ${esc(trunc(it.value_FM, 120))} | ${esc(trunc(it.value_Registry, 120))} | ${esc(it.driftDegree)} | ${esc(it.sla)} |`);
}
lines.push('');
lines.push('## 五、批量修复与验证操作指引（复现闭环）');
lines.push('');
lines.push('```bash');
lines.push('# —— 逐项修复后跑下列三命令闭环验证 ——');
lines.push('npm run audit:skill-integrity      # ERROR 必须为 0；INFO 列表中本清单对应项应逐一消失');
lines.push('npm run audit:skill-routes         # 9 场景路由匹配 100% 通过');
lines.push('npm run audit:skill-error-scenarios  # E01-E05 错误场景 5/5 全绿');
lines.push('');
lines.push('# 批量验证（pre-push 等价）');
lines.push('SKILL_GATE_CONFIRM=1 git push --dry-run  # 或直接走 push 门禁');
lines.push('```');
lines.push('');
lines.push('## 六、关联交付物');
lines.push('');
lines.push('| 交付物 | 路径 |');
lines.push('|---|---|');
lines.push('| 修复前后对比报告 (JSON) | `outputs/skill-fix-diff-report.json` |');
lines.push('| 修复前后对比报告 (MD)   | `outputs/skill-fix-diff-report.md` |');
lines.push('| B-03 治理结构化数据源   | `outputs/b03-governance-drift.json` |');
lines.push('| B-03 治理清单（本文件） | `outputs/SKILL元数据一致性治理清单.md` |');
lines.push('| 自动修复前快照          | `outputs/skill-snapshot-before.json` |');
lines.push('| 自动修复后快照          | `outputs/skill-snapshot-after.json`  |');
lines.push('| 备份 (fix 前)           | `_backups/skill-fix-YYYYMMDD-HHMMSS/` (Registry + SKILL.md) |');
lines.push('');
fs.writeFileSync(path.join(OUT, 'SKILL元数据一致性治理清单.md'), lines.join('\n') + '\n', 'utf-8');

console.log('B-03 Governance written:');
console.log('  JSON:', path.join(OUT,'b03-governance-drift.json'), '— total=', allItems.length, 'drift=', driftItems.length, 's6_missing=', s6Missing.length);
console.log('  MD:  ', path.join(OUT,'SKILL元数据一致性治理清单.md'), '— P0=', byPrio.P0.length, 'P1=', byPrio.P1.length, 'P2=', byPrio.P2.length);
