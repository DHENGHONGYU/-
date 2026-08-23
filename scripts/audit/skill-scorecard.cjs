#!/usr/bin/env node
/**
 * skill-scorecard.cjs — SKILL 体系四维评分卡生成器（技能评估体系评分层，零依赖）
 *
 * 对全部 L1 物理技能按四维加权打分（满分 100），输出控制台表格并归档报告：
 *
 *   ① 结构分（40）：正文 5 大段命中（6 分/段 = 30）+ frontmatter 六字段齐全（按占比×10）
 *      —— 与 audit:skill-coverage RULE-TPL 同源，结构合规即可量化
 *   ② 可发现分（30）：registry triggers 关键词数（≥5 满分，15）+ 文件信号（≥2 满分，10）
 *      + 事件信号（≥1 满分，5）—— 触发面越宽，路由器越容易命中
 *   ③ 运行分（20）：junction 有效（10）+ skill_id 对齐 registry（5）+ usage.log 有历史命中（5）
 *      —— E2E 可加载性 + 真实使用证据
 *   ④ 质量分（10）：§三 SOP 阶段数 ≥3（4）+ §四 教训内容量 ≥300 字（3）+ §五 交付物勾选项 ≥3（3）
 *      —— 静态代理指标；深度语义评审走离线 LLM/人工 rubric，不进门禁
 *
 * 等级：A ≥ 90 / B ≥ 75 / C ≥ 60 / D < 60。
 *
 * 用法：node scripts/audit/skill-scorecard.cjs [--out <报告路径>]
 * 退出码：0 = 生成成功；2 = 运行错误。评分不设阻断（评分是度量，门禁由 audit:* 承担）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
const DEST = path.join(ROOT, '.workbuddy', 'skills');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const USAGE_LOG = path.join(ROOT, '.trae', 'skills', 'usage.log');

const SEGS = [
  ['s1', '## 一、触发条件'],
  ['s2', '## 二、前置检查'],
  ['s3', '## 三、阶段化 SOP'],
  ['s4', '## 四、陷阱与经验教训'],
  ['s5', '## 五、完成交付物清单'],
];
const FIELDS = ['skill_id', 'name', 'description', 'version', 'last_updated', 'mandatory'];

function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx < 0) return null;
  const fm = {};
  for (const raw of lines.slice(1, closeIdx)) {
    const top = raw.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (top) fm[top[1]] = top[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

// 按标题切片正文段（与 audit 的 indexOf 定位法一致）
function sliceSeg(text, fromTitle, toTitle) {
  const a = text.indexOf(fromTitle);
  if (a < 0) return '';
  const b = toTitle ? text.indexOf(toTitle, a + fromTitle.length) : -1;
  return text.slice(a, b > a ? b : text.length);
}

function junctionValid() {
  try {
    const st = fs.lstatSync(DEST);
    if (!st.isSymbolicLink()) return false;
    const target = path.resolve(path.dirname(DEST), fs.readlinkSync(DEST));
    return target === path.resolve(SKILLS_DIR);
  } catch { return false; }
}

function grade(total) {
  if (total >= 90) return 'A';
  if (total >= 75) return 'B';
  if (total >= 60) return 'C';
  return 'D';
}

function main() {
  const outArg = process.argv.indexOf('--out');
  // 本地时区日期（toISOString 是 UTC，东八区会差一天）
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const outPath = outArg > 0
    ? path.resolve(process.argv[outArg + 1])
    : path.join(ROOT, 'deliverables', `${today}-skill-scorecard.md`);

  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  const regSkills = registry.projectPhysicalSkills || [];
  const junctionOk = junctionValid();

  let usageText = '';
  try { usageText = fs.readFileSync(USAGE_LOG, 'utf-8'); } catch { /* 无日志视为零命中 */ }

  const rows = [];
  for (const skill of regSkills) {
    const filePath = path.join(ROOT, skill.path);
    let text = '';
    try { text = fs.readFileSync(filePath, 'utf-8'); } catch { /* 不可读则各维度记 0 */ }
    const fm = parseFrontmatter(text) || {};

    // ① 结构分 40
    const segHits = SEGS.filter(([, t]) => text.includes(t)).length;
    const fieldHits = FIELDS.filter(f => fm[f] !== undefined && fm[f] !== '').length;
    const structure = segHits * 6 + Math.round((fieldHits / FIELDS.length) * 10);

    // ② 可发现分 30
    const kw = (skill.triggers.keywords || []).length;
    const fl = (skill.triggers.files || []).length;
    const ev = (skill.triggers.events || []).length;
    const discover = Math.round(Math.min(kw / 5, 1) * 15 + Math.min(fl / 2, 1) * 10 + Math.min(ev / 1, 1) * 5);

    // ③ 运行分 20
    const idAligned = fm.skill_id === skill.id;
    const used = usageText.includes(skill.name) || usageText.includes(`v9-${skill.name}`);
    const runtime = (junctionOk ? 10 : 0) + (idAligned ? 5 : 0) + (used ? 5 : 0);

    // ④ 质量分 10
    const s3 = sliceSeg(text, SEGS[2][1], SEGS[3][1]);
    const s4 = sliceSeg(text, SEGS[3][1], SEGS[4][1]);
    const s5 = sliceSeg(text, SEGS[4][1], null);
    const phaseCount = (s3.match(/阶段 \d|阶段[一二三四五六七八九十]|Phase \d/gi) || []).length;
    const checklistCount = (s5.match(/^\s*[-*] \[[ x]\]/gm) || []).length;
    const quality = (phaseCount >= 3 ? 4 : phaseCount > 0 ? 2 : 0)
      + (s4.trim().length >= 300 ? 3 : s4.trim().length > 0 ? 1 : 0)
      + (checklistCount >= 3 ? 3 : checklistCount > 0 ? 1 : 0);

    const total = structure + discover + runtime + quality;
    rows.push({
      name: skill.name,
      mandatory: skill.mandatory,
      structure, discover, runtime, quality, total,
      grade: grade(total),
    });
  }

  rows.sort((a, b) => b.total - a.total);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.total, 0) / rows.length) : 0;

  // ---------- 控制台 ----------
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  SKILL 体系评分卡 — skill-scorecard.cjs v1.0               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  junction: ${junctionOk ? '有效' : '失效'} | 评分技能数: ${rows.length} | 平均: ${avg} 分`);
  console.log('');
  console.log('  技能名'.padEnd(40) + '结构/40  发现/30  运行/20  质量/10  总分  等级');
  for (const r of rows) {
    const label = `  ${r.name}${r.mandatory ? ' (M)' : ''}`;
    console.log(label.padEnd(40) + String(r.structure).padStart(4) + '    ' + String(r.discover).padStart(4) + '    ' + String(r.runtime).padStart(4) + '    ' + String(r.quality).padStart(4) + '    ' + String(r.total).padStart(4) + `   ${r.grade}`);
  }
  console.log('');

  // ---------- 报告归档 ----------
  const lines = [
    '---',
    'title: SKILL 体系四维评分卡',
    `date: ${today}`,
    `total_skills: ${rows.length}`,
    `average_score: ${avg}`,
    `junction: ${junctionOk ? 'valid' : 'invalid'}`,
    'generator: scripts/audit/skill-scorecard.cjs v1.0',
    '---',
    '',
    `# SKILL 体系四维评分卡（${today}）`,
    '',
    '> 评分维度：结构分（40，五段式 + frontmatter 六字段，与 RULE-TPL 同源）/ 可发现分（30，触发词/文件/事件信号宽度）/ 运行分（20，junction 可加载 + skill_id 对齐 + usage.log 真实命中）/ 质量分（10，SOP 阶段数/教训内容量/交付物勾选项静态代理）。等级：A≥90 / B≥75 / C≥60 / D<60。',
    '> 评分是度量不是门禁；阻断职责由 `npm run audit:skill-coverage` / `audit:skill-runtime` / `test:skill-router` 承担。',
    '',
    '| 技能 | 强制级 | 结构/40 | 发现/30 | 运行/20 | 质量/10 | 总分 | 等级 |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.name} | ${r.mandatory ? 'MAND' : 'adv'} | ${r.structure} | ${r.discover} | ${r.runtime} | ${r.quality} | **${r.total}** | ${r.grade} |`),
    '',
    `**平均得分：${avg} / 100**（junction ${junctionOk ? '有效' : '失效'}）`,
    '',
    '## 复评约定',
    '',
    '- 新增/迁移技能后跑 `npm run skill:scorecard` 刷新；',
    '- 运行分中「真实命中」随 `.trae/skills/usage.log` 积累自然提升，鼓励经 `npm run skill:route` 走路由；',
    '- 质量分仅为静态代理，深度语义评审（可执行性/证据/阈值正确性）走离线 LLM/人工 rubric，结论并入本报告续表。',
    '',
  ];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`📄 报告已归档：${path.relative(ROOT, outPath)}`);
}

try {
  main();
} catch (e) {
  console.error(`[skill-scorecard] 运行错误: ${e.message}`);
  process.exit(2);
}
