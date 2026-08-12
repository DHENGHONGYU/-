#!/usr/bin/env node
// sync-skill-registry.cjs — 技能注册表 description 同步 + 结构重构工具
//
// 功能：
//   1. 检测 .agents/skills/ 下所有 SKILL.md frontmatter description 与 registry 的不匹配项
//   2. 用 SKILL.md 的 description 作为真相源，同步更新 registry
//   3. 删除冗余的 skills 数组（与 projectPhysicalSkills 完全重复）
//   4. 更新 lastVerifiedAt 时间戳
//
// 用法：
//   node scripts/audit/sync-skill-registry.cjs              // 只检测，输出报告（dry-run）
//   node scripts/audit/sync-skill-registry.cjs --fix         // 检测并修复
//   node scripts/audit/sync-skill-registry.cjs --fix --quiet  // 修复，只输出摘要
//
// 退出码：0 = 全部一致或修复成功；1 = 存在不匹配且未修复；2 = 运行错误。
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const QUIET = args.includes('--quiet');

// ---------- 极简 frontmatter 解析 ----------
function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { error: '缺少起始 ---' };
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx < 0) return { error: '缺少闭合 ---' };

  const fmLines = lines.slice(1, closeIdx);
  const fm = {};
  let currentKey = null;
  let inArray = false;

  for (const line of fmLines) {
    // 数组项（以 - 开头）
    if (/^\s+-\s/.test(line) && currentKey) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      const val = line.replace(/^\s+-\s*/, '').replace(/^"(.*)"$/, '$1').trim();
      fm[currentKey].push(val);
      continue;
    }
    // 键值对
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      let val = m[2].trim();
      // 去除引号
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === '') {
        // 空值，可能是多行或数组
        continue;
      }
      fm[currentKey] = val;
    }
  }
  return fm;
}

// ---------- 读取所有 SKILL.md frontmatter ----------
function readAllSkillFrontmatters() {
  const result = {};
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const dir of dirs) {
    const skillMdPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      result[dir] = { error: 'SKILL.md 不存在', path: skillMdPath };
      continue;
    }
    const fm = parseFrontmatter(skillMdPath);
    if (fm.error) {
      result[dir] = { error: fm.error, path: skillMdPath };
    } else {
      result[dir] = {
        name: fm.name || dir,
        description: fm.description || '',
        version: fm.version || '',
        last_updated: fm.last_updated || '',
        path: skillMdPath,
      };
    }
  }
  return result;
}

// ---------- 主逻辑 ----------
function main() {
  // 1. 检查 registry.json 是否存在
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('ERROR: skill-registry.json 不存在于 ' + REGISTRY_PATH);
    console.error('提示：如果文件被 git reset 覆盖，请从历史提交恢复：');
    console.error('  git checkout <commit> -- .trae/skills/skill-registry.json');
    process.exit(2);
  }

  // 2. 读取 registry.json
  const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  let registry;
  try {
    registry = JSON.parse(registryRaw);
  } catch (e) {
    console.error('ERROR: skill-registry.json JSON 解析失败: ' + e.message);
    process.exit(2);
  }

  // 3. 读取所有 SKILL.md frontmatter
  const skillFMs = readAllSkillFrontmatters();

  // 4. 检测结构：是否有冗余的 skills 数组
  const hasRedundantSkillsArray = Array.isArray(registry.skills) &&
    Array.isArray(registry.projectPhysicalSkills) &&
    registry.skills.length === registry.projectPhysicalSkills.length;

  let skillsArrayDeleted = false;
  let redundantSkillsArrayName = '';

  if (hasRedundantSkillsArray) {
    const skillsNames = registry.skills.map(s => s.name).sort().join(',');
    const ppSkillsNames = registry.projectPhysicalSkills.map(s => s.name).sort().join(',');
    if (skillsNames === ppSkillsNames) {
      redundantSkillsArrayName = 'skills';
      skillsArrayDeleted = true;
    }
  }

  // 5. 检测 description 不匹配
  const targetArray = registry.projectPhysicalSkills || registry.skills;
  if (!targetArray) {
    console.error('ERROR: registry 中既无 projectPhysicalSkills 也无 skills 数组');
    process.exit(2);
  }

  const mismatches = [];
  const matches = [];
  const missing = [];
  const skipped = [];

  for (const regSkill of targetArray) {
    const skillName = regSkill.name;
    // 在 skillFMs 中查找对应的 SKILL.md
    let fmEntry = null;
    for (const dir of Object.keys(skillFMs)) {
      if (skillFMs[dir].name === skillName || dir === skillName) {
        fmEntry = skillFMs[dir];
        break;
      }
    }

    if (!fmEntry) {
      missing.push({ name: skillName, reason: 'SKILL.md 目录不存在' });
      continue;
    }
    if (fmEntry.error) {
      missing.push({ name: skillName, reason: fmEntry.error, path: fmEntry.path });
      continue;
    }

    const regDesc = regSkill.description || '';
    const fmDesc = fmEntry.description || '';

    if (regDesc === fmDesc) {
      matches.push({ name: skillName, descLen: fmDesc.length });
    } else if (!fmDesc) {
      // SKILL.md frontmatter 缺少 description 字段，无法作为真相源 → 跳过
      skipped.push({ name: skillName, reason: 'fm description 为空（frontmatter 缺字段）', regDescLen: regDesc.length });
    } else {
      mismatches.push({
        name: skillName,
        regDescLen: regDesc.length,
        fmDescLen: fmDesc.length,
        regDesc: regDesc,
        fmDesc: fmDesc,
        hasInvoke: fmDesc.includes('Invoke when'),
      });
    }
  }

  // 6. 输出报告
  if (!QUIET) {
    console.log('========== SKILL Registry Description Sync Report ==========\n');
    console.log('Registry: ' + REGISTRY_PATH);
    console.log('Skills dir: ' + SKILLS_DIR);
    console.log('Target array: ' + (registry.projectPhysicalSkills ? 'projectPhysicalSkills' : 'skills'));
    console.log('Total skills in registry: ' + targetArray.length);
    console.log('');

    // 结构问题
    if (skillsArrayDeleted) {
      console.log('--- 结构问题 ---');
      console.log('  冗余数组: "' + redundantSkillsArrayName + '" 与 "projectPhysicalSkills" 完全重复');
      console.log('  修复操作: 删除 "' + redundantSkillsArrayName + '" 数组');
      console.log('');
    }

    // 匹配项
    console.log('--- 匹配项 (' + matches.length + ') ---');
    for (const m of matches) {
      console.log('  OK: ' + m.name.padEnd(35) + ' | desc_len=' + m.descLen);
    }
    console.log('');

    // 不匹配项
    console.log('--- 不匹配项 (' + mismatches.length + ') ---');
    for (const m of mismatches) {
      console.log('  MISMATCH: ' + m.name.padEnd(35) +
        ' | reg=' + m.regDescLen + ' -> fm=' + m.fmDescLen +
        ' | has_Invoke=' + m.hasInvoke);
      if (!QUIET) {
        console.log('    reg: ' + (m.regDesc.substring(0, 80) + (m.regDesc.length > 80 ? '...' : '')));
        console.log('    fm:  ' + (m.fmDesc.substring(0, 80) + (m.fmDesc.length > 80 ? '...' : '')));
      }
    }
    console.log('');

    // 缺失项
    if (missing.length > 0) {
      console.log('--- 缺失项 (' + missing.length + ') ---');
      for (const m of missing) {
        console.log('  MISSING: ' + m.name.padEnd(35) + ' | ' + m.reason);
      }
      console.log('');
    }

    // 跳过项（fm description 为空，无法作为真相源）
    if (skipped.length > 0) {
      console.log('--- 跳过项 (' + skipped.length + ') ---');
      for (const s of skipped) {
        console.log('  SKIP: ' + s.name.padEnd(35) + ' | ' + s.reason + ' | reg_desc_len=' + s.regDescLen);
      }
      console.log('');
    }
  }

  // 7. 执行修复
  if (FIX_MODE) {
    let fixed = 0;
    let structFixed = false;

    // 7a. 同步 description
    for (const m of mismatches) {
      const skill = targetArray.find(s => s.name === m.name);
      if (skill) {
        skill.description = m.fmDesc;
        fixed++;
      }
    }

    // 7b. 如果 projectPhysicalSkills 也存在，同步更新
    if (registry.projectPhysicalSkills && targetArray !== registry.projectPhysicalSkills) {
      for (const m of mismatches) {
        const skill = registry.projectPhysicalSkills.find(s => s.name === m.name);
        if (skill) {
          skill.description = m.fmDesc;
        }
      }
    }

    // 7c. 删除冗余的 skills 数组
    if (skillsArrayDeleted) {
      delete registry.skills;
      structFixed = true;
    }

    // 7d. 更新 lastVerifiedAt
    registry.lastVerifiedAt = new Date().toISOString();

    // 7e. 写入文件
    const output = JSON.stringify(registry, null, 2) + '\n';
    fs.writeFileSync(REGISTRY_PATH, output, 'utf-8');

    console.log('--- 修复结果 ---');
    console.log('  description 同步: ' + fixed + ' 个');
    console.log('  结构重构: ' + (structFixed ? '删除冗余 "' + redundantSkillsArrayName + '" 数组' : '无需'));
    console.log('  lastVerifiedAt 已更新');
    console.log('  文件已写入: ' + REGISTRY_PATH);
    console.log('');
    console.log('总修复: ' + (fixed + (structFixed ? 1 : 0)) + ' 项');
    process.exit(0);
  } else {
    // dry-run 模式
    const totalIssues = mismatches.length + missing.length + (skillsArrayDeleted ? 1 : 0);
    console.log('========== 摘要 ==========');
    console.log('匹配: ' + matches.length + ' | 不匹配: ' + mismatches.length + ' | 跳过: ' + skipped.length + ' | 缺失: ' + missing.length + ' | 结构问题: ' + (skillsArrayDeleted ? 1 : 0));
    console.log('总问题数: ' + totalIssues + '（不含跳过项）');
    if (totalIssues > 0) {
      console.log('\n运行 --fix 修复: node scripts/audit/sync-skill-registry.cjs --fix');
      process.exit(1);
    } else {
      console.log('\n全部一致，无需修复。');
      process.exit(0);
    }
  }
}

try {
  main();
} catch (e) {
  console.error('FATAL: ' + e.message);
  console.error(e.stack);
  process.exit(2);
}
