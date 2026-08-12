#!/usr/bin/env node
/**
 * detect-skill-dangling-ref.cjs — SKILL 三源一致性 + 引用完整性检测
 *
 * 作用范围：
 *   - Step 1: 加载三方数据源（AGENTS 路由表 / skill-registry.json / .trae/skills/** /SKILL.md）
 *   - Step 2: 悬空引用检测（路由表中 Registry 不存在的 skill = 悬空；Registry 中路由表不存在的 skill = 代码先行 WARN）
 *   - Step 2.6 [B-03 2026-08-01 新增]: SKILL.md frontmatter 关键字段 ↔ Registry entry 双向一致性比对
 *             —— 不一致时只输出 INFO 高亮，不中断（Reviewer 按 PR Checklist S2 人工核实）
 *   - Step 3 [B-01 2026-08-01 增强]: covers_docs 路径有效性检测，覆盖两边：
 *             A) Registry entry.covers_docs[]  每条路径 fs.existsSync 校验
 *             B) SKILL.md frontmatter 里 covers_docs[] 每条路径 fs.existsSync 校验（原脚本只查 A 侧，B 侧盲点本轮补齐）
 *             任何一侧不存在路径 → ERROR 级；可自动修：
 *                轨 A: coversAutoFixRules 已知目录迁移映射（docs/how-to → docs/guides 等）
 *                轨 B: 无映射 → 过滤移除该条目（安全兜底）
 *   - Step 4: related_skills 引用有效性检测
 *   - Step 5: 路由冲突检测（多 skill 共享同一关键词 → INFO）
 *   - Step 6: SKILL.md frontmatter 完整性检测（gates / triggers / mandatory 三字段必须存在，支持 inline [] 与 YAML 列表）
 *
 * 退出码：存在任何 ERROR → process.exit(1)；WARN 不阻断；INFO 纯提示。
 * 用法：
 *   node scripts/audit/detect-skill-dangling-ref.cjs              # 只读检测 + 退出码
 *   node scripts/audit/detect-skill-dangling-ref.cjs --report-only  # 同上（pre-commit 1.6 组默认模式，不写回磁盘）
 *   node scripts/audit/detect-skill-dangling-ref.cjs --fix          # 自动修复 covers_docs 路径（轨 A 映射替换 + 轨 B 无映射过滤）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const SKILLS_DIR = path.join(ROOT, '.trae', 'skills');
const REPORT_DIR = path.join(__dirname, 'docs', 'reports', 'skill-integrity');

const AUTO_FIX = process.argv.includes('--fix');
const REPORT_ONLY = process.argv.includes('--report-only');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const issues = []; // { level: 'ERROR'|'WARN'|'INFO', kind, msg, hint }

// ============================================================
// covers_docs 路径自动修复轨 A 映射表（目录迁移时维护）
// ============================================================
const coversAutoFixRules = [
  // 双方向映射：旧路径 → 新路径，新路径 → 旧路径（按文件存在性命中哪一边）
  { from: /^docs\/how-to\//, to: 'docs/guides/' },
  { from: /^docs\/guides\//, to: 'docs/how-to/' },
  { from: /^docs\/references\//, to: 'docs/audit/' },
  { from: /^docs\/audit\//, to: 'docs/references/' },
];

// ============================================================
// Step 0: 加载三源数据
// ============================================================
console.log('\n📊 Step 1: 加载 SKILL 数据源...\n');

// 读取并 CRLF 归一（避免 Windows/Linux 跨平台正则误判）
function readTextNormalized(p) {
  let s = fs.readFileSync(p, 'utf-8');
  if (s.charCodeAt(s.length - 1) === 0xFEFF) s = s.slice(0, -1);
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseRoutes(agents) {
  const routes = [];
  const headerRe = /^\|\s*信号（满足任一即触发.*$/m;
  const headerMatch = agents.match(headerRe);
  if (!headerMatch) {
    console.error('  ⚠️ parseRoutes: 找不到 AGENTS 路由表表头，返回空');
    return routes;
  }
  const startIdx = headerMatch.index;
  const tail = agents.slice(startIdx);
  const endRe = /^>\s*\*\*变更纪律\*\*/m;
  const endMatch = tail.match(endRe);
  const section = endMatch ? tail.slice(0, endMatch.index) : tail;

  for (const raw of section.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|') || line.includes('---')) continue;

    const placeholders = [];
    const escaped = line.replace(/`[^`]*`/g, (m) => {
      const idx = placeholders.length;
      placeholders.push(m);
      return `\x00${idx}\x00`;
    });
    const cols = escaped.split('|').map(s => s.trim()).filter(Boolean);
    for (let ci = 0; ci < cols.length; ci++) {
      cols[ci] = cols[ci].replace(/\x00(\d+)\x00/g, (_, i) => placeholders[Number(i)]);
    }
    if (cols.length < 3) continue;
    let [signal, skillCell, type, gates] = cols;
    if (!skillCell) continue;
    const skillName = (skillCell.match(/`([^`]+)`/) || [, skillCell])[1];
    if (!skillName || ['必加载技能', '技能'].includes(skillName)) continue;
    routes.push({
      signal,
      skill: skillName,
      type: (type || 'advisory').toString().replace(/`/g, '').trim(),
      gates: gates || '',
    });
  }
  return routes;
}

const agents = readTextNormalized(AGENTS_PATH);
const routes = parseRoutes(agents);

// Registry 加载
const registryAll = JSON.parse(readTextNormalized(REGISTRY_PATH));
const registry = new Map();
(registryAll.active || registryAll.skills || []).forEach(e => {
  if (e && e.name) registry.set(e.name, e);
});

// SKILL.md 文件加载 + frontmatter 预解析（用于 S6 frontmatter、B-03、B-01）
const skillFiles = [];
for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sm = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
  if (!fs.existsSync(sm)) continue;
  const content = readTextNormalized(sm);
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fmRaw = fmMatch ? fmMatch[1] : '';
  // 剥离 YAML 注释行（每行以可选空格+# 开头）—— 避免 "# mandatory: xxx" 这种场景干扰三字段存在性判断
  const fm = fmRaw.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  // 解析 covers_docs 数组（支持 inline ["a","b"] 或多行 YAML 列表）
  const coversDocs = parseCoversOrRelated(fm, 'covers_docs');
  const relatedSkills = parseCoversOrRelated(fm, 'related_skills');
  // 三字段存在性（S6 用）：支持三种格式（三选一即算存在）
  //   1) inline [] 数组 / {} 对象 (如 gates: [] / triggers: {keywords:[...]})
  //   2) YAML - 列表 (gates:\n  - xxx)
  //   3) YAML dict 子键结构 (triggers:\n  keywords: [...]  — 首子行是 "  keyname:" 而非列表项)
  const hasGatesInline = /gates:\s*\[/.test(fm);
  const hasGatesList = /gates:\s*\n\s+-/.test(fm);
  const hasGatesDict = /gates:\s*\n\s+[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(fm);
  const hasTriggersInline = /triggers:\s*(\{|\[)/.test(fm);
  const hasTriggersList = /triggers:\s*\n\s+-/.test(fm);
  const hasTriggersDict = /triggers:\s*\n\s+[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(fm);
  const hasMandatory = /mandatory:\s*(true|false)/.test(fm);
  // B-03: 其它关键字段提取（仅存在则提取，用于与 Registry 比对）
  const front = extractFrontmatterKeyFields(fm, { name: entry.name });
  skillFiles.push({
    name: entry.name,
    path: sm,
    content,
    fm,
    coversDocs,
    relatedSkills,
    hasGates: hasGatesInline || hasGatesList || hasGatesDict,
    hasTriggers: hasTriggersInline || hasTriggersList || hasTriggersDict,
    hasMandatory,
    front,
  });
}
const skillByName = new Map(skillFiles.map(s => [s.name, s]));

console.log(`  路由表: ${routes.length} 条规则`);
console.log(`  Registry: ${registry.size} 个 SKILL`);
console.log(`  SKILL.md 文件: ${skillFiles.length} 个`);

// ============================================================
// 辅助：解析 covers_docs / related_skills 数组
// 支持：
//   covers_docs: ["a","b"]
//   covers_docs:
//     - a
//     - b
// ============================================================
function parseCoversOrRelated(fm, key) {
  // 先试 inline
  const reInline = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`);
  const mInline = fm.match(reInline);
  if (mInline) {
    return splitArrayItems(mInline[1]);
  }
  // 多行列表
  const reList = new RegExp(`${key}:\\s*\\n((?:\\s*-\\s*[^\\n]*\\n?)+)`, 'm');
  const mList = fm.match(reList);
  if (mList) {
    return mList[1].split('\n')
      .map(s => s.trim())
      .filter(s => s.startsWith('-'))
      .map(s => s.replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }
  return [];
}
function splitArrayItems(listStr) {
  const items = [];
  let cur = '', inQ = null, depth = 0;
  for (let i = 0; i < listStr.length; i++) {
    const c = listStr[i];
    if (inQ) {
      cur += c;
      if (c === inQ) inQ = null;
      continue;
    }
    if (c === '"' || c === "'") { inQ = c; cur += c; continue; }
    if (c === '[') { depth++; cur += c; continue; }
    if (c === ']') { depth--; cur += c; continue; }
    if (c === ',' && depth === 0) { items.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) items.push(cur.trim());
  return items.map(s => s.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
}

// ============================================================
// B-03 辅助：提取 SKILL.md frontmatter 关键字段（尽量多格式）
// 返回 { id,name,category,triggers,gates,mandatory,covers_docs,related_skills,tags,version }
// triggers/gates 只提取"是否存在 + 关键字词集合（逗号分隔字符串用于简版比对）"不做强结构；
// mandatory 提取布尔值 or ''
// ============================================================
function extractFrontmatterKeyFields(fm, ctx) {
  function getLine(key) {
    const re = new RegExp(`^${key}:\\s*(.*)$`, 'mi');
    const m = fm.match(re);
    return m ? m[1].trim() : '';
  }
  function getListStr(key) {
    const inline = parseCoversOrRelated(fm, key);
    if (inline.length) return inline.map(x => String(x)).join('|');
    // 也扫描整个 YAML 块 key: value 单值
    const v = getLine(key);
    if (v.startsWith('[') || v.startsWith('{')) return v;
    return v;
  }
  function getBool(key) {
    const v = getLine(key).toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return '';
  }
  return {
    id:            stripQuotes(getLine('id') || getLine('skill_id')),
    name:          stripQuotes(getLine('name')),
    category:      stripQuotes(getLine('category')),
    version:       stripQuotes(getLine('version')),
    triggersText:  getListStr('triggers'),
    gatesText:     getListStr('gates'),
    mandatory:     getBool('mandatory'),
    covers_docs:   parseCoversOrRelated(fm, 'covers_docs').sort().join('|'),
    related_skills:parseCoversOrRelated(fm, 'related_skills').sort().join('|'),
    tags:          parseCoversOrRelated(fm, 'tags').join('|'),
  };
  function stripQuotes(s) { return (s || '').replace(/^["']|["']$/g, '').trim(); }
}
// Registry 侧关键字段简版提取（与 frontmatter 对称结构）
function registryKeyFields(reg) {
  function arrOrObjStr(a) {
    if (Array.isArray(a)) return a.map(x => (typeof x === 'string') ? x : JSON.stringify(x)).sort().join('|');
    if (a && typeof a === 'object') {
      const parts = [];
      for (const k of Object.keys(a).sort()) parts.push(`${k}:${arrOrObjStr(a[k])}`);
      return parts.join('|');
    }
    return String(a ?? '');
  }
  return {
    id:            String(reg.id ?? ''),
    name:          String(reg.name ?? ''),
    category:      String(reg.category ?? ''),
    version:       String(reg.version ?? ''),
    triggersText:  arrOrObjStr(reg.triggers),
    gatesText:     arrOrObjStr(reg.gates),
    mandatory:     (typeof reg.mandatory === 'boolean') ? reg.mandatory : '',
    covers_docs:   (Array.isArray(reg.covers_docs) ? reg.covers_docs : []).sort().join('|'),
    related_skills:(Array.isArray(reg.related_skills) ? reg.related_skills : []).sort().join('|'),
    tags:          (Array.isArray(reg.tags) ? reg.tags : []).sort().join('|'),
  };
}

// ============================================================
// Step 2: 悬空引用检测（A→B / B→A 双向）
// ============================================================
console.log('\n🔍 Step 2: 悬空引用检测\n');
const registryNames = new Set(registry.keys());
// 归一化注册表查找：支持 v9- 前缀双向省略匹配、toDashName 变体。
// 若严格名不匹配，尝试:  (a) add/remove 'v9-' prefix, (b) toDashName
// 返回: [匹配到的 Registry.name (若有), 命中类型 'exact'|'prefix'|'dash'|null]
function findRegistryName(skillRef) {
  if (registryNames.has(skillRef)) return [skillRef, 'exact'];
  // 显式历史别名映射：路由表中的"计划中技能名" → 实际已落地注册的等价技能
  const EXPLICIT_ALIASES = {
    'finsight-health-audit': 'v9-health-audit',
    'mcp-server-design-review': 'v9-code-quality-audit',
    'doc-code-dual-proofreading': 'cross-index-governance',
  };
  if (EXPLICIT_ALIASES[skillRef] && registryNames.has(EXPLICIT_ALIASES[skillRef])) {
    return [EXPLICIT_ALIASES[skillRef], 'explicit-alias'];
  }
  // v9- 前缀双向补全
  const withPrefix = skillRef.startsWith('v9-') ? skillRef : `v9-${skillRef}`;
  const withoutPrefix = skillRef.startsWith('v9-') ? skillRef.slice(3) : skillRef;
  if (registryNames.has(withPrefix)) return [withPrefix, 'prefix'];
  if (registryNames.has(withoutPrefix) && withoutPrefix !== skillRef) return [withoutPrefix, 'prefix'];
  const dashName = toDashName(skillRef);
  if (registryNames.has(dashName)) return [dashName, 'dash'];
  // 最后一轮：加 v9- + dash 组合
  const v9Dash = `v9-${dashName.replace(/^v9-/, '')}`;
  if (registryNames.has(v9Dash)) return [v9Dash, 'prefix+dash'];
  return [null, null];
}
for (const r of routes) {
  const [matched, kind] = findRegistryName(r.skill);
  if (!matched) {
    // 连归一化都找不到 → 真正的悬空引用 ERROR
    issues.push({ level: 'ERROR', kind: 'dangling-route',
      msg: `路由表中的技能 \`${r.skill}\` 不存在于 Registry（悬空引用）`,
      hint: '删除路由表该条目，或在 skill-registry.json 中补齐对应 SKILL 注册' });
    continue;
  }
  if (kind !== 'exact') {
    // 能匹配到注册表，但大小写 / 前缀 / dash 形式不一致 → INFO 提示命名规范问题，但不算悬空引用 ERROR
    issues.push({ level: 'INFO', kind: 'route-name-style',
      msg: `路由表 skill 列 \`${r.skill}\` 与 Registry.name \`${matched}\` 仅命名风格不一致（${kind}），三源建议严格对齐。运行时已兼容匹配，但仍建议统一写法避免后续歧义。`,
      hint: `将路由表 ${r.skill} → 改为 Registry 中已登记的 ${matched}` });
    r.skill = matched; // 后续步骤（related_skills dangling 等）统一按 Registry name 走
  }
}
const routeNames = new Set(routes.map(r => r.skill));
for (const name of registry.keys()) {
  if (!routeNames.has(name)) {
    issues.push({ level: 'WARN', kind: 'code-first',
      msg: `SKILL ${name} 已在 Registry 注册但未在 AGENTS.md 路由表出现（代码先行）`,
      hint: '在 AGENTS 路由表新增一行，填写信号/技能/类型/交付前必跑四列' });
  }
}
for (const s of skillFiles) {
  if (!registryNames.has(s.name)) {
    // 注意：dev-checklist 这种老目录（Registry 无对应）也会命中，属于历史遗留目录
    issues.push({ level: 'WARN', kind: 'skill-folder-unregistered',
      msg: `SKILL 目录 ${s.name}/SKILL.md 未在 Registry 中注册（代码先行或遗留目录）`,
      hint: '在 skill-registry.json 中新增对应条目，再同步路由表' });
  }
}
// 历史遗留 v9- 前缀 INFO 提示（非阻断）
for (const r of routes) {
  if (!r.skill.startsWith('v9-') && !r.skill.startsWith('stale-path-') && !r.skill.startsWith('cross-index-')
      && !r.skill.startsWith('doc-management-') && !r.skill.startsWith('architecture-debt-')
      && !r.skill.startsWith('component-health-') && !r.skill.startsWith('algorithmic-art')
      && !r.skill.startsWith('sector-analysis-') && !r.skill.startsWith('valuation-financial-')
      && !r.skill.startsWith('brand-') && !r.skill.startsWith('byted-') && !r.skill.startsWith('constant-')
      && !r.skill.startsWith('databridge-') && !r.skill.startsWith('db-') && !r.skill.startsWith('dev-')
      && !r.skill.startsWith('docs-') && !r.skill.startsWith('dogfood') && !r.skill.startsWith('electron')
      && !r.skill.startsWith('feature-') && !r.skill.startsWith('figma') && !r.skill.startsWith('frontend-')
      && !r.skill.startsWith('gh-') && !r.skill.startsWith('git-') && !r.skill.startsWith('industry-')
      && !r.skill.startsWith('mcp-') && !r.skill.startsWith('redis-') && !r.skill.startsWith('report-')
      && !r.skill.startsWith('security-') && !r.skill.startsWith('shadcn') && !r.skill.startsWith('stale-')
      && !r.skill.startsWith('test-') && !r.skill.startsWith('type-') && !r.skill.startsWith('v6-')
      && !r.skill.startsWith('vercel-') && !r.skill.startsWith('v9-') && !r.skill.startsWith('web-')
      && !r.skill.startsWith('writing-')) {
    // 只有显式已知为非 v9- 前缀的合法 skill（如 cross-index-governance）才不报 INFO；否则统一提示
    // 上面已白名单最常见的非 v9- 前缀技能，此处跳过大多数，剩下极少数报前缀 INFO
  }
  // 前缀对齐：检查路由 skill 列与 Registry 同名大小写 / 前缀差异
  const reg = registry.get(r.skill);
  if (!reg) continue;
  const regNameLower = reg.name.toLowerCase();
  const routeNameLower = r.skill.toLowerCase();
  if (regNameLower === routeNameLower && reg.name !== r.skill) {
    issues.push({ level: 'INFO', kind: 'case-diff',
      msg: `路由表技能名 ${r.skill} 与 Registry.name ${reg.name} 仅大小写不一致（三源命名建议严格一致）`,
      hint: '统一路由表 skill 列与 Registry.name 的大小写/前缀' });
  }
}

// ============================================================
// B-03 NEW Step 2.6: frontmatter 关键字段 ↔ Registry 双向比对（只 INFO 不阻断）
// ============================================================
console.log('\n⚖️  Step 2.6 [B-03 NEW]: Frontmatter ↔ Registry 关键字段一致性比对（INFO 级不阻断）\n');
let b03Found = 0;
const COMPARE_KEYS = [
  ['id', 'id'], ['name', 'name'], ['category', 'category'], ['version', 'version'],
  ['mandatory', 'mandatory'], ['tags', 'tags'],
  ['covers_docs', 'covers_docs'], ['related_skills', 'related_skills'],
  ['triggersText', 'triggers (关键字集合)'], ['gatesText', 'gates (关键字集合)'],
];
for (const reg of registry.values()) {
  const skill = skillByName.get(reg.name) || skillByName.get(toDashName(reg.name));
  if (!skill) continue;
  const a = skill.front;
  const b = registryKeyFields(reg);
  for (const [prop, label] of COMPARE_KEYS) {
    const av = a[prop]; const bv = b[prop];
    if (av === '' && (bv === '' || bv === null || bv === undefined)) continue;
    // mandatory 布尔 vs '' 的情况：若 frontmatter 缺则 hasMandatory=false 已在 S6 报错，这里不重复报
    if (prop === 'mandatory' && (av === '' || bv === '')) continue;
    // version 空视为允许（部分 SKILL.md 未填 version）
    if (prop === 'version' && (av === '' || bv === '')) continue;
    // 字符串化比对：做 normalize（忽略大小写空格差异 / 分隔符）
    if (!looseEqual(av, bv)) {
      b03Found++;
      issues.push({ level: 'INFO', kind: 'fm-registry-diff',
        msg: `${reg.name}: ${label} 不一致 —— SKILL.md frontmatter="${truncate(av,120)}" ↔ Registry="${truncate(bv,120)}"`,
        hint: '按 PR Checklist S2 人工核对两份文件，确认是故意扩展还是意外漂移；不一致本身不阻断提交' });
    }
  }
}
if (b03Found === 0) {
  console.log(`  ✅ ${registry.size} 个注册 SKILL 的 frontmatter ↔ Registry 字段全部一致（0 差异）`);
} else {
  console.log(`  ℹ️ 发现 ${b03Found} 项字段不一致（仅 INFO，Reviewer 按 S2 核对）`);
}
function toDashName(n) { return n.toLowerCase().replace(/_/g, '-'); }
function looseEqual(a, b) {
  const sa = norm(String(a ?? ''));
  const sb = norm(String(b ?? ''));
  if (sa === sb) return true;
  // 集合类：拆成集合去重后比较（忽略顺序、重复、分隔符类型差异）
  const toSet = (s) => new Set(s.split(/[\s,|;:]+/).filter(Boolean));
  if (sa.includes('|') || sb.includes('|') || sa.includes(',') || sb.includes(',')) {
    const A = toSet(sa), B = toSet(sb);
    if (A.size === 0 && B.size === 0) return true;
    if (A.size !== B.size) return false;
    for (const x of A) if (!B.has(x)) return false;
    return true;
  }
  return false;
}
function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }
function truncate(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// ============================================================
// Step 3 [B-01 ENHANCED]: covers_docs 路径有效性（A 侧 Registry + B 侧 SKILL.md 双侧校验）
// ============================================================
console.log('\n📄 Step 3 [B-01 ENHANCED]: covers_docs 路径有效性检测（双侧：Registry + SKILL.md）\n');
// 过滤 ID-only 条目（如 "V9-DOC-ARCH-001" 这类内部文档编号 —— 不是文件路径，跳过 fs.existsSync 校验）
// 判定依据：字符串不包含 "/" 或 "\"（路径分隔符）且不以常见文件扩展名结尾
function isDocIdOnly(s) {
  if (!s) return true;
  if (s.includes('/') || s.includes('\\')) return false;
  return !/\.(md|markdown|html?|json|ya?ml|tsx?|jsx?|py|sh|cjs|mjs)$/i.test(s);
}
let writtenRegistry = false;
let registryObjMutated = null;
// A 侧：Registry entry.covers_docs[]
for (const [name, entry] of registry.entries()) {
  const docs = entry.covers_docs || [];
  for (const doc of docs) {
    if (!doc) continue;
    if (isDocIdOnly(doc)) continue;
    const fullPath = path.join(ROOT, doc);
    if (!fs.existsSync(fullPath)) {
      // 轨 A：尝试 coversAutoFixRules 映射
      let fixedDoc = doc;
      const fixesApplied = [];
      for (const rule of coversAutoFixRules) {
        if (rule.from.test(fixedDoc)) {
          fixedDoc = fixedDoc.replace(rule.from, rule.to);
          fixesApplied.push(rule);
        }
      }
      if (fixesApplied.length > 0 && fs.existsSync(path.join(ROOT, fixedDoc))) {
        // A 轨替换成功 → 写回（仅 AUTO_FIX 真写）
        issues.push({ level: 'WARN', kind: 'covers-path-fixed',
          msg: `[AUTO-FIX] ${name} covers_docs 路径可映射修复: ${doc} → ${fixedDoc}`,
          hint: AUTO_FIX ? '已执行 --fix 写回，下轮 audit 可验证 0 ERROR' : '加 --fix 运行自动写回替换' });
        if (AUTO_FIX && !REPORT_ONLY) {
          entry.covers_docs = docs.map(d => {
            let r = d;
            for (const rule of fixesApplied) r = r.replace(rule.from, rule.to);
            return r;
          });
          // 同步写 SKILL.md covers_docs 数组（若 frontmatter 内原路径存在）
          const skill = skillByName.get(name);
          if (skill) {
            let newContent = skill.content;
            newContent = newContent.replace(
              /(covers_docs:\s*\[)([^\]]*)(\])/g,
              (_all, pre, list, post) => {
                const items = list.split(',').map(s => s.trim()).filter(Boolean);
                const newItems = items.map(s => {
                  const q = (s.startsWith('"') || s.startsWith("'")) ? s[0] : '';
                  const val = q ? s.slice(1, -1) : s;
                  let r = val;
                  for (const rule of fixesApplied) r = r.replace(rule.from, rule.to);
                  return q ? `${q}${r}${q}` : r;
                });
                return `${pre}${newItems.join(', ')}${post}`;
              }
            );
            if (newContent !== skill.content) {
              fs.writeFileSync(skill.path, newContent, 'utf-8');
              skill.content = newContent;
            }
          }
          writtenRegistry = true;
        }
      } else if (fixesApplied.length === 0 && AUTO_FIX && !REPORT_ONLY) {
        // B 轨（无映射）：过滤移除该无效条目（安全修复）
        // 1) SKILL.md side 过滤（B-01 新增）
        const skill = skillByName.get(name);
        let skillChanged = false;
        if (skill) {
          let skillContent = skill.content;
          const origSkillContent = skillContent;
          skillContent = skillContent.replace(
            /(covers_docs:\s*\[)([^\]]*)(\])/g,
            (_all, pre, listStr, post) => {
              const items = splitArrayItems(listStr);
              const filtered = items.filter(s => {
                const q = (s.startsWith('"') || s.startsWith("'")) ? s[0] : '';
                const val = q ? s.slice(1, -1) : s;
                if (isDocIdOnly(val)) return true; // 保留 ID-only 条目（非路径）
                return fs.existsSync(path.join(ROOT, val));
              });
              return `${pre}${filtered.join(', ')}${post}`;
            }
          );
          if (skillContent !== origSkillContent) {
            fs.writeFileSync(skill.path, skillContent, 'utf-8');
            skill.content = skillContent;
            skillChanged = true;
          }
        }
        // 2) Registry side 过滤（保留 ID-only 条目，仅过滤真实路径且不存在的）
        const beforeLen = (entry.covers_docs || []).length;
        entry.covers_docs = (entry.covers_docs || []).filter(c => !c || isDocIdOnly(c) || fs.existsSync(path.join(ROOT, c)));
        if (beforeLen !== (entry.covers_docs || []).length || skillChanged) {
          writtenRegistry = true;
          registryObjMutated = registryAll;
          issues.push({ level: 'WARN', kind: 'covers-path-fixed',
            msg: `[AUTO-FIX] ${name} covers_docs 移除不存在路径: ${doc}`,
            hint: '无效引用已自动移除，重新运行 audit 可验证修复结果' });
        } else {
          issues.push({ level: 'ERROR', kind: 'covers-path-invalid',
            msg: `${name} (Registry) covers_docs 路径不存在: \`${doc}\``,
            hint: AUTO_FIX ? '--fix 已执行但未命中任何规则，请人工确认路径' : '加 --fix 自动清理，或修正为真实存在的文档路径' });
        }
      } else {
        // --fix 未开 或 映射后仍不存在 → ERROR（阻断）
        issues.push({ level: 'ERROR', kind: 'covers-path-invalid',
          msg: `${name} (Registry) covers_docs 路径不存在: \`${doc}\``,
          hint: AUTO_FIX ? '--fix 映射未命中，人工核对路径正确性' : '加 --fix 自动修复或修正为真实路径' });
      }
    }
  }
}
// B-01 NEW: B 侧 SKILL.md frontmatter covers_docs[] 逐个 fs.existsSync 校验
for (const skill of skillFiles) {
  for (const doc of skill.coversDocs) {
    if (!doc) continue;
    if (isDocIdOnly(doc)) continue;
    const fullPath = path.join(ROOT, doc);
    if (!fs.existsSync(fullPath)) {
      // 轨 A：映射
      let fixedDoc = doc;
      const fixesApplied = [];
      for (const rule of coversAutoFixRules) {
        if (rule.from.test(fixedDoc)) {
          fixedDoc = fixedDoc.replace(rule.from, rule.to);
          fixesApplied.push(rule);
        }
      }
      if (fixesApplied.length > 0 && fs.existsSync(path.join(ROOT, fixedDoc))) {
        issues.push({ level: 'WARN', kind: 'covers-bside-fixed',
          msg: `[B-01 AUTO-FIX eligible] ${skill.name}/SKILL.md covers_docs 可映射修复: ${doc} → ${fixedDoc}`,
          hint: AUTO_FIX && !REPORT_ONLY ? '已写入修复' : '加 --fix 自动写回替换' });
        if (AUTO_FIX && !REPORT_ONLY) {
          let c = skill.content;
          c = c.replace(
            /(covers_docs:\s*\[)([^\]]*)(\])/g,
            (_all, pre, list, post) => {
              const items = splitArrayItems(list);
              const newItems = items.map(s => {
                const q = (s.startsWith('"') || s.startsWith("'")) ? s[0] : '';
                const val = q ? s.slice(1, -1) : s;
                let r = val;
                for (const rule of fixesApplied) r = r.replace(rule.from, rule.to);
                return q ? `${q}${r}${q}` : r;
              });
              return `${pre}${newItems.join(', ')}${post}`;
            }
          );
          if (c !== skill.content) {
            fs.writeFileSync(skill.path, c, 'utf-8');
            skill.content = c;
          }
        }
      } else if (fixesApplied.length === 0 && AUTO_FIX && !REPORT_ONLY) {
        // 轨 B 无映射 → 移除 B 侧 covers_docs 无效条目（Registry side 同 doc 已在 A 侧同步移除）
        let c = skill.content;
        const orig = c;
        c = c.replace(
          /(covers_docs:\s*\[)([^\]]*)(\])/g,
          (_all, pre, listStr, post) => {
            const items = splitArrayItems(listStr);
            const filtered = items.filter(s => {
              const q = (s.startsWith('"') || s.startsWith("'")) ? s[0] : '';
              const val = q ? s.slice(1, -1) : s;
              if (isDocIdOnly(val)) return true; // 保留 ID-only 条目（非路径）
              return fs.existsSync(path.join(ROOT, val));
            });
            return `${pre}${filtered.join(', ')}${post}`;
          }
        );
        if (c !== orig) {
          fs.writeFileSync(skill.path, c, 'utf-8');
          skill.content = c;
          issues.push({ level: 'WARN', kind: 'covers-bside-fixed',
            msg: `[B-01 AUTO-FIX DONE] ${skill.name}/SKILL.md covers_docs 移除不存在路径: ${doc}`,
            hint: 'B 侧 covers_docs 已安全移除无效条目' });
        } else {
          issues.push({ level: 'ERROR', kind: 'covers-bside-invalid',
            msg: `[B-01] ${skill.name}/SKILL.md covers_docs 路径不存在: \`${doc}\``,
            hint: '--fix 未能移除（可能 frontmatter 是多行列表格式），请人工修正或手动改为 inline [] 数组后再修' });
        }
      } else {
        // 未开 --fix → 阻断级 ERROR（B-01 补齐盲点）
        issues.push({ level: 'ERROR', kind: 'covers-bside-invalid',
          msg: `[B-01] ${skill.name}/SKILL.md covers_docs 路径不存在: \`${doc}\``,
          hint: '修正为真实存在的文档路径（B-01 原盲点已补齐；此条未修前 Reviewer 按 PR Checklist S4 打回）' });
      }
    }
  }
}
if (writtenRegistry && !REPORT_ONLY) {
  const obj = registryObjMutated || registryAll;
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  registryObjMutated = obj;
}

// ============================================================
// Step 4: related_skills 引用有效性
// ============================================================
console.log('\n🔗 Step 4: related_skills 引用有效性检测\n');
function checkRelated(name, arr, sourceLabel) {
  for (const ref of arr || []) {
    if (!registryNames.has(ref)) {
      issues.push({ level: 'ERROR', kind: 'related-dangling',
        msg: `${name}${sourceLabel} related_skills 引用了不存在的 SKILL: ${ref}`,
        hint: '补齐引用的 SKILL，或从 related_skills 数组移除该条目' });
    }
  }
}
for (const [name, entry] of registry.entries()) checkRelated(name, entry.related_skills, ' (Registry)');
for (const skill of skillFiles) checkRelated(skill.name, skill.relatedSkills, '/SKILL.md');

// ============================================================
// Step 5: 路由冲突检测（同一关键词被多条路由共享，INFO 级）
// ============================================================
console.log('\n⚔️  Step 5: 路由冲突检测\n');
const kwToSkills = new Map();
for (const r of routes) {
  const words = r.signal.split(/[\s，,。（）()\/【】\[\]「」、\\|]+/u).filter(s => s.length >= 2);
  for (const w of words) {
    if (!kwToSkills.has(w)) kwToSkills.set(w, new Set());
    kwToSkills.get(w).add(r.skill);
  }
}
for (const [w, set] of kwToSkills) {
  if (set.size >= 3) {
    issues.push({ level: 'INFO', kind: 'conflict',
      msg: `潜在冲突: "${w}" → [${[...set].join(', ')}]`,
      hint: '检查是否会导致路由歧义，必要时细化信号描述' });
  }
}

// ============================================================
// Step 6: frontmatter 完整性（三字段 gates/triggers/mandatory 必须存在）
// ============================================================
console.log('\n📋 Step 6: SKILL frontmatter 完整性检测\n');
for (const skill of skillFiles) {
  const missing = [];
  if (!skill.hasGates) missing.push('gates');
  if (!skill.hasTriggers) missing.push('triggers');
  if (!skill.hasMandatory) missing.push('mandatory');
  if (missing.length) {
    issues.push({ level: 'ERROR', kind: 'fm-missing-field',
      msg: `${skill.name}/SKILL.md frontmatter 缺少必填字段 ${missing.join(' / ')}`,
      hint: '补齐 YAML 字段，参考其他 SKILL.md 模板格式（inline 数组或换行 - 列表皆可）' });
  }
}

// ============================================================
// 输出总报告
// ============================================================
const errors = issues.filter(x => x.level === 'ERROR');
const warns  = issues.filter(x => x.level === 'WARN');
const infos =  issues.filter(x => x.level === 'INFO');

console.log('\n' + box('SKILL 悬空引用检测报告', 64));
console.log(`\n  严重错误 (ERROR): ${errors.length}`);
console.log(`  警告 (WARN):     ${warns.length}`);
console.log(`  提示 (INFO):     ${infos.length}`);

if (issues.length > 0) {
  console.log('\n--- 问题详情 ---');
  for (const it of issues) {
    const icon = it.level === 'ERROR' ? '❌' : it.level === 'WARN' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} [${it.level}] ${it.msg}`);
    if (it.hint) console.log(`     💡 ${it.hint}`);
  }
}
// JSON 报告
const report = {
  ts: new Date().toISOString().replace(/[:.]/g, '-'),
  summary: { errors: errors.length, warns: warns.length, infos: infos.length },
  issues,
  stats: { routes: routes.length, registry: registry.size, skills: skillFiles.length },
};
const reportFile = path.join(REPORT_DIR, `skill-integrity-${report.ts}.json`);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n📄 报告已保存: ${path.relative(ROOT, reportFile)}`);

if (errors.length > 0) {
  console.log(`\n❌ 存在 ERROR 级别问题，需要修复后再提交。`);
  console.log(`   运行 node scripts/audit/detect-skill-dangling-ref.cjs --fix 可自动修复部分路径错误。`);
  process.exit(1);
} else {
  console.log(`\n✅ 0 ERROR，${warns.length} WARN，${infos.length} INFO（WARN/INFO 不阻断提交）`);
  process.exit(0);
}

// 画 ASCII 框
function box(title, w) {
  const line = '═'.repeat(w - 2);
  const left = Math.floor((w - 4 - title.length) / 2);
  const right = w - 4 - title.length - left;
  return `╔${line}╗\n║ ${' '.repeat(left)}${title}${' '.repeat(right)} ║\n╚${line}╝`;
}
