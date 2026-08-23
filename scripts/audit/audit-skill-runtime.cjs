#!/usr/bin/env node
/**
 * audit-skill-runtime.cjs — SKILL 体系运行时加载冒烟（E2E 调用测试的确定性替代，零依赖）
 *
 * 定位：技能评估体系 L1 层。真实逐个调用 Skill() 代价高且不可断言，本脚本以确定性断言
 * 校验「加载链路是否可用」，等价覆盖 E2E 调用测试的可验证子集：
 *
 *   ① junction 契约：.workbuddy/skills 必须是指向 .agents/skills 的目录联接
 *      （非 Windows / 降级 cp 副本 → FAIL；联接缺失 → FAIL 并提示跑 npm run skill:mirror）
 *   ② 目录枚举：.agents/skills 每个技能目录含 SKILL.md，无孤儿目录（_ 前缀模板除外）
 *   ③ frontmatter 可解析：六字段齐全（skill_id/name/description/version/last_updated/mandatory）
 *   ④ 清单比对：目录 ↔ registry projectPhysicalSkills 无缺失无多余，skill_id ↔ registry id 一致
 *
 * 五段式结构不在此重复检查（归 audit:skill-coverage 的 RULE-TPL，单一职责）。
 *
 * 用法：node scripts/audit/audit-skill-runtime.cjs
 * 退出码：0 = 全绿；1 = 存在违规；2 = 运行错误。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, '.agents', 'skills');
const DEST = path.join(ROOT, '.workbuddy', 'skills');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');

const violations = [];
const passed = [];
const v = (msg) => violations.push(msg);
const ok = (msg) => passed.push(msg);

const REQUIRED_FIELDS = ['skill_id', 'name', 'description', 'version', 'last_updated', 'mandatory'];

// ---------- 极简 frontmatter 字段提取（只取顶层标量，受控格式；兼容引号包裹值） ----------
function parseFrontmatter(filePath) {
  let text;
  try { text = fs.readFileSync(filePath, 'utf-8'); } catch (e) { return { error: `不可读: ${e.message}` }; }
  text = text.replace(/^\uFEFF/, ''); // 容忍 BOM（外部脚本回写可能引入，导致首行 --- 失配）
  text = text.replace(/\r\n/g, '\n'); // 归一 CRLF（外部工具回写可能引入，行尾 \r 会破坏字段正则）
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return { error: '缺少起始 ---' };
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx < 0) return { error: '缺少闭合 ---' };
  const fm = {};
  for (const raw of lines.slice(1, closeIdx)) {
    const top = raw.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (top) fm[top[1]] = top[2].trim().replace(/^["']+|["']+$/g, '');
  }
  return fm;
}

function junctionInfo(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isSymbolicLink()) return { is: false, target: null, exists: true };
    const raw = fs.readlinkSync(p);
    return { is: true, target: path.resolve(path.dirname(p), raw), exists: true };
  } catch { return { is: false, target: null, exists: false }; }
}

function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  SKILL 运行时加载冒烟 — audit-skill-runtime.cjs v1.0       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // ---------- ① junction 契约 ----------
  const info = junctionInfo(DEST);
  if (!info.exists) {
    v(`R1 .workbuddy/skills 不存在 —— 请运行 npm run skill:mirror 重建联接`);
  } else if (!info.is) {
    v(`R1 .workbuddy/skills 是实体目录（旧 cp 副本降级态）而非联接 —— 请运行 npm run skill:mirror 重建`);
  } else if (info.target !== path.resolve(SRC_DIR)) {
    v(`R1 .workbuddy/skills 联接指向错误：${info.target}（期望 ${path.resolve(SRC_DIR)}）`);
  } else {
    ok(`R1 junction 契约：.workbuddy/skills → ${info.target}（物理单份）`);
  }

  // ---------- 读取 registry ----------
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch (e) {
    console.error(`🔴 无法读取 ${REGISTRY_PATH}: ${e.message}`);
    process.exit(2);
  }
  const regSkills = registry.projectPhysicalSkills || [];
  const regByName = new Map(regSkills.map(s => [s.name, s]));

  // ---------- ② 目录枚举 ----------
  let dirs = [];
  try {
    dirs = fs.readdirSync(SRC_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name);
  } catch (e) {
    console.error(`🔴 无法枚举 ${SRC_DIR}: ${e.message}`);
    process.exit(2);
  }

  // ---------- ③④ 逐技能校验 ----------
  for (const name of dirs) {
    const skillPath = path.join(SRC_DIR, name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      v(`R2 ${name}/ 缺 SKILL.md（孤儿目录）`);
      continue;
    }
    const fm = parseFrontmatter(skillPath);
    if (fm.error) {
      v(`R3 ${name}: frontmatter 解析失败 —— ${fm.error}`);
      continue;
    }
    for (const f of REQUIRED_FIELDS) {
      if (fm[f] === undefined || fm[f] === '') v(`R3 ${name}: frontmatter 缺字段 ${f}`);
    }
    const reg = regByName.get(name);
    if (!reg) {
      v(`R4 ${name}: 目录存在但 registry 未登记`);
    } else {
      if (fm.skill_id && fm.skill_id !== reg.id) {
        v(`R4 ${name}: skill_id 漂移（frontmatter=${fm.skill_id}，registry=${reg.id}）`);
      }
      if (fm.name && fm.name !== name) {
        v(`R4 ${name}: frontmatter name 与目录名不一致（${fm.name}）`);
      }
    }
  }

  // registry 有登记但目录缺失
  for (const s of regSkills) {
    if (!dirs.includes(s.name)) v(`R4 registry 登记了 ${s.name} 但 .agents/skills/ 无此目录`);
  }

  // ---------- 汇总 ----------
  console.log(`  扫描技能目录: ${dirs.length} 个，registry L1 登记: ${regSkills.length} 个，junction: ${info.is ? '有效' : '失效'}`);
  console.log('');
  if (violations.length === 0) {
    console.log(`✅ 全绿：${dirs.length} 个技能运行时可加载（junction 有效 + 枚举齐全 + frontmatter 完整 + 清单一致；五段结构由 audit:skill-coverage 专责）。`);
    process.exit(0);
  }
  console.error(`🔴 违规 ${violations.length} 项：`);
  for (const msg of violations) console.error(`  ✗ ${msg}`);
  process.exit(1);
}

main();
