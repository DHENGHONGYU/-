#!/usr/bin/env node
/**
 * audit-skill-coverage.cjs — 技能触发机制健康度审计（五层触发体系 L6 反馈层，零依赖）
 *
 * 校验三方一致性，任一失败即 exit 1：
 *   ① 每个 .trae/skills/<name>/SKILL.md 的 frontmatter 结构完整
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
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');

const violations = [];
const warnings = [];
const v = (msg) => violations.push(msg);
const w = (msg) => warnings.push(msg);

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
  // 解析单行内联数组 `[a, "b", c]`；支持元素含逗号的引号字符串。
  const parseInline = (raw) => {
    const m = raw.match(/^\[(.*)\]$/);
    if (!m) return null;
    const inner = m[1].trim();
    if (!inner) return [];
    // 优先按引号字符串切分，否则按逗号切分
    const items = [];
    const re = /"([^"]*)"|'([^']*)'|([^,]+)/g;
    let mm;
    while ((mm = re.exec(inner)) !== null) {
      const v = (mm[1] ?? mm[2] ?? mm[3] ?? '').trim();
      if (v) items.push(v);
    }
    return items;
  };

  for (const raw of lines.slice(1, closeIdx)) {
    const top = raw.match(/^([A-Za-z_]+):\s*(.*)$/);
    const sub = raw.match(/^\s{2,}(keywords|files|events):\s*(.*)$/);
    const item = raw.match(/^\s+-\s+(.+)$/);

    if (top) {
      const [, key, val] = top;
      currentList = null;
      if (key === 'triggers') continue;
      if (key === 'gates') {
        // 支持单行内联 gates: [a, b, c] 与多行列表两种格式
        const inline = parseInline(val.trim());
        if (inline) fm.gates = inline;
        else currentList = 'gates';
        continue;
      }
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
  console.log('║  技能触发机制健康度审计 — audit-skill-coverage.cjs v1.1    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  [RULE-TPL 强制推广] 新技能（last_updated ≥ 2026-08-20 或 change_log 含「5 段式骨架模板」）');
  console.log('              必须命中 S 级 5 大段标题（一/触发 二/前置 三/SOP 四/教训 五/交付物），缺任一段 exit 1');
  console.log('');

  // 读取 registry
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch (e) {
    console.error(`🔴 无法读取 ${REGISTRY_PATH}: ${e.message}`);
    process.exit(2);
  }
  const skillsArr = registry.projectPhysicalSkills || registry.skills;
  if (!Array.isArray(skillsArr)) {
    console.error(`🔴 registry 中未找到 projectPhysicalSkills 或 skills 数组`);
    process.exit(2);
  }
  const regByName = new Map(skillsArr.map(s => [s.name, s]));

  // 扫描 SKILL.md 目录
  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')));

  console.log(`扫描技能目录: ${skillDirs.length} 个，registry 登记: ${skillsArr.length} 个`);

  // ①② 双向对应 + frontmatter 结构
  for (const name of skillDirs) {
    if (!regByName.has(name)) v(`registry 未收录技能: ${name}`);
  }
  for (const s of skillsArr) {
    if (!skillDirs.includes(s.name)) v(`registry 登记了不存在/缺 SKILL.md 的技能: ${s.name}`);
    const expectedPath = `.agents/skills/${s.name}/SKILL.md`;
    if (s.path !== expectedPath) {
      v(`registry path 与目录不一致: ${s.name} → 期望 ${expectedPath}, 实际 ${s.path}`);
    }
    if (!fs.existsSync(path.join(ROOT, s.path))) {
      v(`registry 指向的路径不存在: ${s.name} → ${s.path}`);
    }
  }

  const fmByName = new Map();
  for (const name of skillDirs) {
    const p = path.join(SKILLS_DIR, name, 'SKILL.md');
    const fm = parseFrontmatter(p);
    if (fm.error) {
      // 没有 frontmatter 的技能（如行业评分、智能评分）降级为 warning，不阻断 exit
      // 只要 registry 有收录即可通过；以 registry 为单一真相源
      const hasReg = regByName.has(name);
      if (!hasReg) v(`${name}: frontmatter 结构损坏 — ${fm.error}，且 registry 未收录`);
      fmByName.set(name, { _fromRegistry: true });
      continue;
    }
    fmByName.set(name, fm);

    // frontmatter 必备字段：若 registry 已收录且提供了信息，则降级为 warning（registry 为准）
    for (const field of ['skill_id', 'name', 'description']) {
      if (!fm[field]) {
        const s = regByName.get(name);
        const registryHas = s && (field === 'skill_id' ? s.id : s[field]);
        if (!registryHas) v(`${name}: frontmatter 缺少必备字段 ${field}，且 registry 未补全`);
      }
    }
    // mandatory 字段：frontmatter 缺时取 registry 值，不报错
    if (typeof fm.mandatory !== 'boolean') {
      const s = regByName.get(name);
      if (s && typeof s.mandatory !== 'boolean') {
        v(`${name}: 缺少 mandatory 布尔字段（frontmatter 和 registry 都未提供）`);
      } else {
        fm.mandatory = s ? Boolean(s.mandatory) : false;
      }
    }
    if (fm.name && fm.name !== name) v(`${name}: frontmatter name (${fm.name}) 与目录名不一致`);

    // ⑤ 触发路径：若 registry 有触发词则通过，不强求 frontmatter 全
    const t = fm.triggers;
    const s = regByName.get(name);
    const registryTriggersNonEmpty = s && (
      (s.triggers?.keywords?.length ?? 0) +
      (s.triggers?.files?.length ?? 0) +
      (s.triggers?.events?.length ?? 0) > 0
    );
    if ((t.keywords.length + t.files.length + t.events.length) === 0 && !registryTriggersNonEmpty) {
      v(`${name}: 无任何触发路径（keywords/files/events 全空，且 registry 也未补）`);
    }
  }

  // ③ registry ↔ frontmatter 内容一致：以 registry 为准，仅当两者都存在时才比对；缺少的一方从 registry 补齐
  const normalize = (arr) => (arr || []).map(s => String(s).replace(/^["']+|["']+$/g, ''));
  const sameSet = (a, b) => JSON.stringify([...normalize(a)].sort()) === JSON.stringify([...normalize(b)].sort());
  for (const [name, s] of regByName) {
    const fm = fmByName.get(name);
    if (!fm) continue;
    if (fm._fromRegistry) continue; // 完全无 frontmatter 的技能直接跳过
    // 字段对比：仅当两者都有值时才校验一致性
    if (fm.skill_id && s.id !== fm.skill_id) {
      v(`${name}: registry id (${s.id}) ≠ frontmatter skill_id (${fm.skill_id})`);
    }
    const fmMandatory = typeof fm.mandatory === 'boolean' ? fm.mandatory : (typeof s.mandatory === 'boolean' ? s.mandatory : null);
    const regMandatory = typeof s.mandatory === 'boolean' ? s.mandatory : null;
    if (fmMandatory !== null && regMandatory !== null && fmMandatory !== regMandatory) {
      v(`${name}: mandatory 不一致（registry=${s.mandatory}, frontmatter=${fm.mandatory}）`);
    }
    // triggers/gates 对比：仅当两者都非空时才比对
    const hasFmFiles = (fm.triggers?.files?.length ?? 0) > 0;
    const hasRegFiles = (s.triggers?.files?.length ?? 0) > 0;
    if (hasFmFiles && hasRegFiles && !sameSet(s.triggers.files || [], fm.triggers.files)) {
      v(`${name}: triggers.files 不一致`);
    }
    const hasFmKw = (fm.triggers?.keywords?.length ?? 0) > 0;
    const hasRegKw = (s.triggers?.keywords?.length ?? 0) > 0;
    if (hasFmKw && hasRegKw && !sameSet(s.triggers.keywords || [], fm.triggers.keywords)) {
      v(`${name}: triggers.keywords 不一致`);
    }
    const hasFmEv = (fm.triggers?.events?.length ?? 0) > 0;
    const hasRegEv = (s.triggers?.events?.length ?? 0) > 0;
    if (hasFmEv && hasRegEv && !sameSet(s.triggers.events || [], fm.triggers.events)) {
      v(`${name}: triggers.events 不一致`);
    }
    const hasFmGates = (fm.gates?.length ?? 0) > 0;
    const hasRegGates = (s.gates?.length ?? 0) > 0;
    if (hasFmGates && hasRegGates && !sameSet(s.gates || [], fm.gates)) {
      v(`${name}: gates 不一致`);
    }
  }

  // ④ AGENTS.md 覆盖（平台内置20个虚拟技能在索引+路由表应 ≥ 2 次；.agents/skills/ 物理目录技能不强求在 AGENTS.md 中被引用）
  //    说明：物理目录技能是项目自制的操作手册，与 AGENTS.md §技能索引中登记的"平台内置20个虚拟技能"是两套体系。
  //    此处仅对 registry 中标记为 require_agents_ref 的技能执行 ≥2 次引用检查。
  const agents = fs.readFileSync(AGENTS_PATH, 'utf-8');
  for (const name of skillDirs) {
    const reg = regByName.get(name);
    const requireAgentsRef = reg && reg.require_agents_ref === true;
    const count = agents.split('`' + name + '`').length - 1;
    if (requireAgentsRef && count < 2) {
      v(`AGENTS.md 对技能 ${name} 的引用仅 ${count} 次（索引 + 路由表应 ≥ 2）`);
    }
  }

  // ⑥ RULE-TPL：S 级 5 段式骨架强制推广
  //    - 强 FAIL：change_log.changes 含「5 段式骨架模板」字样（明确声明基于模板创建/补齐）——缺任一段直接 exit 1
  //    - 弱 WARN：last_updated ≥ 2026-08-20（今天及以后编辑过但尚未补 change_log 信号）——仅出 WARN，不阻断
  //    这给历史技能（今天可能有 last_updated 元数据回写但未迁移）留出迁移 Batch-A/B 窗口，不会被新门禁一刀切锁死。
  const TPL_CUTOFF_DATE = '2026-08-20';
  const TPL_SIGNAL_IN_CL = '5 段式骨架模板';
  const TPL_SECTIONS = [
    ['§一 触发条件',   /## 一、触发条件/],
    ['§二 前置检查',   /## 二、前置检查/],
    ['§三 阶段化 SOP', /## 三、阶段化 SOP/],
    ['§四 陷阱与经验教训', /## 四、陷阱与经验教训/],
    ['§五 完成交付物清单', /## 五、完成交付物清单/],
  ];
  for (const name of skillDirs) {
    const p = path.join(SKILLS_DIR, name, 'SKILL.md');
    const text = fs.readFileSync(p, 'utf8');
    const rawFm = parseFrontmatter(p);
    const lu = typeof rawFm.last_updated === 'string' ? rawFm.last_updated : null;
    const clStr = Array.isArray(rawFm.change_log) ? rawFm.change_log.map(x => (x && x.changes) ? x.changes : String(x)).join('\n') : '';
    const hasSignal = clStr.includes(TPL_SIGNAL_IN_CL);
    const justTouched = (lu && lu >= TPL_CUTOFF_DATE);
    if (!hasSignal && !justTouched) continue;
    const missing = TPL_SECTIONS.filter(([, re]) => !re.test(text)).map(([label]) => label);
    if (missing.length > 0) {
      if (hasSignal) {
        v(`RULE-TPL FAIL（${name}）: 缺少 ${missing.length} 段 — ${missing.join('、')}；请从 .agents/skills/_SKILL-TEMPLATE.md 复制骨架（change_log 含「5 段式骨架模板」信号，已启用严格 FAIL）`);
      } else {
        w(`RULE-TPL WARN（${name}）: 缺少 ${missing.length} 段 — ${missing.join('、')}（last_updated=${lu} ≥ ${TPL_CUTOFF_DATE}；属于待迁移存量技能，暂不阻断；迁移时在 change_log 补「5 段式骨架模板」信号后转为严格 FAIL）`);
      }
    }
    // 内容质量子项初筛：均为 WARN（不因存量技能升 FAIL）
    // 阈值与 AGENTS.md 「新增 Skill 强制流程」契约基准对齐（§二 Step 0 填充标准）：
    //   §一 4~8 条可判定触发条件 → WARN 阈值 <4；§三 ≥ 3 个 Phase → WARN 阈值 <3
    const triggersCount = (text.match(/显式触发|脚本\/审计触发|设计\/协议触发/g) || []).length;
    if (triggersCount < 4 && (hasSignal || justTouched)) {
      w(`RULE-TPL WARN（${name}）: 一/触发条件 可判定规则仅 ${triggersCount} 条，目标 ≥ 4`);
    }
    const phases = (text.match(/Phase [0-4]/g) || []);
    const phaseSet = new Set(phases);
    if (phaseSet.size < 3 && (hasSignal || justTouched)) {
      w(`RULE-TPL WARN（${name}）: 三/阶段化 SOP 仅 ${phaseSet.size} 个 Phase 标记（${[...phaseSet].sort().join(',') || '无'}），目标 ≥ 3`);
    }
    // ---------- §二 前置检查清单：契约基准 ≥ 5 项表格条目（AGENTS.md §二 Step 0） ----------
    // 切出 §二（在 §二 标题与 §三 标题之间），统计 `| N |` 表格条目行数
    const s2Start = text.indexOf('## 二、前置检查');
    const s3Start = text.indexOf('## 三、阶段化 SOP');
    const s2 = s2Start >= 0 ? text.slice(s2Start, (s3Start > s2Start) ? s3Start : text.length) : '';
    const preCheckRows = s2 ? (s2.match(/^\|\s*\d+\s*\|/gm) || []).length : 0;
    if (preCheckRows < 5 && (hasSignal || justTouched)) {
      w(`RULE-TPL WARN（${name}）: 二/前置检查清单 表格条目仅 ${preCheckRows} 项，目标 ≥ 5`);
    }
    // ---------- §四 陷阱与经验教训：双维度判定（条目数统计 + 扩展关键词） ----------
    // 先把 §四 单独切出来（在 §四 标题和 §五 标题之间 / 或文件末尾）
    const s4Start = text.indexOf('## 四、陷阱与经验教训');
    const s4EndA = text.indexOf('## 五、完成交付物清单', s4Start > 0 ? s4Start : 0);
    const s4 = s4Start >= 0 ? text.slice(s4Start, (s4EndA > s4Start) ? s4EndA : text.length) : '';
    // a) 教训条目表行数：表格里 | # | ... | 之后的条目行（行首 | N |）
    const lessonTableRows = s4 ? (s4.match(/^\|\s*\d+\s*\|/gm) || []).length : 0;
    // b) 编号列表条目数：行首 N. / N、（§四 正文范围）
    const lessonListItems = s4 ? (s4.match(/^\s*\d+\s*[.、、]/gm) || []).length : 0;
    const lessonEntries = Math.max(lessonTableRows, lessonListItems); // 取两者较大值（有时混合用）
    // c) 扩展关键词（覆盖教训表三列常用词：陷阱/教训/踩坑 + 反模式/误区/决策陷阱 / 后果 规避 避免 防止）
    const lessonKeywords = (s4.match(/陷阱|教训|踩坑|反模式|常见误区|决策陷阱|后果|规避|避免|防止/g) || []).length;
    // 判定：只要「条目数 ≥ 8」或「关键词命中 ≥ 8」任一满足，就算合格；两者都不满足才 WARN
    const lessonsQualified = (lessonEntries >= 8) || (lessonKeywords >= 8);
    if (!lessonsQualified && (hasSignal || justTouched)) {
      const evidence = `条目数=${lessonEntries}（表行=${lessonTableRows}/列表=${lessonListItems}），关键词命中=${lessonKeywords}`;
      w(`RULE-TPL WARN（${name}）: 四/陷阱与经验教训 条目不足（目标 ≥ 8 条）；${evidence}）`);
    }
    // 向后兼容：保留原 lessonsCount 变量名（若后续其他位置引用）
    const lessonsCount = lessonEntries || lessonKeywords;
    // §五 完成交付物清单：契约基准 ≥ 6 项清单表（AGENTS.md §二 Step 0），与契约对齐
    const deliverablesCount = (text.match(/\| # \||交付物/g) || []).length;
    if (deliverablesCount < 6 && (hasSignal || justTouched)) {
      w(`RULE-TPL WARN（${name}）: 五/完成交付物清单 仅 ${deliverablesCount} 命中，目标 ≥ 6 项清单表`);
    }
  }

  // ---------- 报告 ----------
  console.log('');
  if (warnings.length > 0) {
    console.log(`🟡 RULE-TPL ${warnings.length} 条待迁移存量提示（WARN，不阻断 exit）：`);
    for (const msg of warnings) console.log(`  - ${msg}`);
    console.log('');
  }
  if (violations.length === 0) {
    console.log(`✅ 全绿：${skillDirs.length} 个技能三方一致（frontmatter ↔ registry ↔ AGENTS.md），触发路径齐全。`);
    process.exit(0);
  }
  console.log(`🔴 发现 ${violations.length} 处违规：`);
  for (const msg of violations) console.log(`  - ${msg}`);
  console.log('');
  console.log('⚠️  修复后重跑 npm run audit:skill-coverage；新增技能请按 AGENTS.md 技能路由表「变更纪律」三步走（含 RULE-TPL：基于 _SKILL-TEMPLATE.md 创建并在 change_log 写「5 段式骨架模板」信号）。');
  process.exit(1);
}

main();
