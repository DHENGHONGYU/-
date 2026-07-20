#!/usr/bin/env node
/**
 * audit-skill-coverage.cjs — 技能触发机制健康度审计（五层触发体系 L6 反馈层，零依赖）
 *
 * 校验三方一致性，任一失败即 exit 1：
 *   ① 每个 .workbuddy/skills/<name>/SKILL.md 的 frontmatter 结构完整
 *     （单一 YAML 块 + 必备字段 skill_id/name/description/triggers/gates/mandatory）
 *   ② skill-registry.json ↔ SKILL.md 目录 一一对应（name/path 无缺失无多余）
 *   ③ registry 与 frontmatter 内容一致（mandatory / triggers.files / gates 集合相等）
 *   ④ AGENTS.md 索引与路由表覆盖全部技能（每个技能名至少出现 2 次）
 *   ⑤ 每个技能至少一条触发路径（keywords/files/events 三者至少其一非空）
 *
 * 用法：node scripts/audit/audit-skill-coverage.cjs
 * 退出码：0 = 全绿；1 = 存在违规；2 = 运行错误。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, '.workbuddy', 'skills');
const REGISTRY_PATH = path.join(SKILLS_DIR, 'skill-registry.json');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');

const violations = [];
const v = (msg) => violations.push(msg);

// ---------- 极简 frontmatter 解析（仅支持本项目受控格式） ----------
function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return { error: '缺少起始 ---' };
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx < 0) return { error: '缺少闭合 ---' };
  if (/^---\S/m.test(text)) return { error: '存在损坏的 ---X 拼接行' };
  const body = lines.slice(closeIdx + 1).join('\n');
  if (/^(skill_id|triggers|covers_docs):/m.test(body)) return { error: '正文残留重复 YAML 块' };

  const fm = { triggers: { keywords: [], files: [], events: [] }, gates: [] };
  let currentList = null; // 'triggers.keywords' | 'triggers.files' | 'triggers.events' | 'gates'
  const parseInline = (raw) => {
    const m = raw.match(/^\[(.*)\]$/);
    if (!m) return null;
    const inner = m[1].trim();
    if (!inner) return [];
    return inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  };

  for (const raw of lines.slice(1, closeIdx)) {
    const top = raw.match(/^([A-Za-z_]+):\s*(.*)$/);
    const sub = raw.match(/^\s{2,}(keywords|files|events):\s*(.*)$/);
    const item = raw.match(/^\s+-\s+(.+)$/);

    if (top) {
      const [, key, val] = top;
      currentList = null;
      if (key === 'triggers') continue;
      if (key === 'gates') { currentList = 'gates'; continue; }
      if (key === 'mandatory') { fm.mandatory = val.trim() === 'true'; continue; }
      fm[key] = val.trim().replace(/^["']|["']$/g, '');
      continue;
    }
    if (sub) {
      const [, key, val] = sub;
      const inline = parseInline(val.trim());
      if (inline) fm.triggers[key] = inline;
      else currentList = 'triggers.' + key;
      continue;
    }
    if (item && currentList) {
      const val = item[1].trim().replace(/^["']|["']$/g, '');
      if (currentList === 'gates') fm.gates.push(val);
      else {
        const [, key] = currentList.split('.');
        fm.triggers[key].push(val);
      }
    }
  }
  return fm;
}

// ---------- 主流程 ----------
function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  技能触发机制健康度审计 — audit-skill-coverage.cjs v1.0    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // 读取 registry
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch (e) {
    console.error(`🔴 无法读取 ${REGISTRY_PATH}: ${e.message}`);
    process.exit(2);
  }
  const regByName = new Map(registry.skills.map(s => [s.name, s]));

  // 扫描 SKILL.md 目录
  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')));

  console.log(`扫描技能目录: ${skillDirs.length} 个，registry 登记: ${registry.skills.length} 个`);

  // ①② 双向对应 + frontmatter 结构
  for (const name of skillDirs) {
    if (!regByName.has(name)) v(`registry 未收录技能: ${name}`);
  }
  for (const s of registry.skills) {
    if (!skillDirs.includes(s.name)) v(`registry 登记了不存在/缺 SKILL.md 的技能: ${s.name}`);
    if (s.path !== `.workbuddy/skills/${s.name}/SKILL.md`) {
      v(`registry path 与目录不一致: ${s.name} → ${s.path}`);
    }
  }

  const fmByName = new Map();
  for (const name of skillDirs) {
    const p = path.join(SKILLS_DIR, name, 'SKILL.md');
    const fm = parseFrontmatter(p);
    if (fm.error) { v(`${name}: frontmatter 结构损坏 — ${fm.error}`); continue; }
    fmByName.set(name, fm);

    for (const field of ['skill_id', 'name', 'description']) {
      if (!fm[field]) v(`${name}: frontmatter 缺少必备字段 ${field}`);
    }
    if (typeof fm.mandatory !== 'boolean') v(`${name}: 缺少 mandatory 布尔字段`);
    if (fm.name && fm.name !== name) v(`${name}: frontmatter name (${fm.name}) 与目录名不一致`);

    // ⑤ 触发路径
    const t = fm.triggers;
    if ((t.keywords.length + t.files.length + t.events.length) === 0) {
      v(`${name}: 无任何触发路径（keywords/files/events 全空）`);
    }
  }

  // ③ registry ↔ frontmatter 内容一致
  const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  for (const [name, s] of regByName) {
    const fm = fmByName.get(name);
    if (!fm) continue;
    if (s.id !== fm.skill_id) v(`${name}: registry id (${s.id}) ≠ frontmatter skill_id (${fm.skill_id})`);
    if (Boolean(s.mandatory) !== fm.mandatory) v(`${name}: mandatory 不一致（registry=${s.mandatory}, frontmatter=${fm.mandatory}）`);
    if (!sameSet(s.triggers.files || [], fm.triggers.files)) v(`${name}: triggers.files 不一致`);
    if (!sameSet(s.triggers.keywords || [], fm.triggers.keywords)) v(`${name}: triggers.keywords 不一致`);
    if (!sameSet(s.triggers.events || [], fm.triggers.events)) v(`${name}: triggers.events 不一致`);
    if (!sameSet(s.gates || [], fm.gates)) v(`${name}: gates 不一致`);
  }

  // ④ AGENTS.md 覆盖（索引 + 路由表 => 至少 2 次）
  const agents = fs.readFileSync(AGENTS_PATH, 'utf-8');
  for (const name of skillDirs) {
    const count = agents.split('`' + name + '`').length - 1;
    if (count < 2) v(`AGENTS.md 对技能 ${name} 的引用仅 ${count} 次（索引 + 路由表应 ≥ 2）`);
  }

  // ---------- 报告 ----------
  console.log('');
  if (violations.length === 0) {
    console.log(`✅ 全绿：${skillDirs.length} 个技能三方一致（frontmatter ↔ registry ↔ AGENTS.md），触发路径齐全。`);
    process.exit(0);
  }
  console.log(`🔴 发现 ${violations.length} 处违规：`);
  for (const msg of violations) console.log(`  - ${msg}`);
  console.log('');
  console.log('⚠️  修复后重跑 npm run audit:skill-coverage；新增技能请按 AGENTS.md 技能路由表「变更纪律」三步走。');
  process.exit(1);
}

main();
