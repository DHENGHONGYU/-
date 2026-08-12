#!/usr/bin/env node
/**
 * skill-router.cjs — 技能路由器（五层触发体系 L4 强制层，零依赖）
 *
 * 职责：把「信号」（改动文件 / 用户提示词）匹配到 `.trae/skills/skill-registry.json`
 * 中的技能，输出命中清单与该技能的交付前必跑门禁（gates）。
 *
 * 用法：
 *   node scripts/skill-router.cjs                      # 默认 --remind，取暂存区改动（为空则取工作区改动）
 *   node scripts/skill-router.cjs --remind --log       # 提醒并追加命中日志（pre-commit 挂载方式）
 *   node scripts/skill-router.cjs --enforce            # 命中 mandatory 技能时 exit 1（pre-push 挂载方式）
 *   node scripts/skill-router.cjs --enforce --since origin/main  # 按推送范围 diff（pre-push 推荐）
 *   node scripts/skill-router.cjs --files a.ts,b.ts    # 手工指定文件列表（调试用）
 *   node scripts/skill-router.cjs --prompt "用户原话"   # 关键词信号匹配（供 prompt 类钩子使用）
 *   node scripts/skill-router.cjs --enforce --confirmed# 声明 gates 已跑过，放行
 *
 * 环境变量：SKILL_GATE_CONFIRM=1 等价于 --confirmed（供 pre-push 旁路：SKILL_GATE_CONFIRM=1 git push）。
 * 退出码：0 = 无命中或仅 advisory 命中；1 = --enforce 下命中 mandatory 且未确认；2 = 运行错误。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const USAGE_LOG = path.join(ROOT, '.trae', 'skills', 'usage.log');

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const opts = { mode: 'remind', log: false, confirmed: false, files: null, prompt: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--enforce') opts.mode = 'enforce';
    else if (a === '--remind') opts.mode = 'remind';
    else if (a === '--log') opts.log = true;
    else if (a === '--confirmed') opts.confirmed = true;
    else if (a === '--files') opts.files = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--prompt') opts.prompt = argv[++i] || '';
    else if (a === '--since') opts.since = argv[++i] || null;
  }
  if (process.env.SKILL_GATE_CONFIRM === '1') opts.confirmed = true;
  return opts;
}

// ---------- glob → RegExp（支持 **、*、?，零依赖） ----------
function globToRegex(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 3; } // **/ 匹配零级或多级目录
        else { re += '.*'; i += 2; }
      } else {
        re += '[^/]*'; i += 1;
      }
    } else if (c === '?') {
      re += '[^/]'; i += 1;
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&'); i += 1;
    }
  }
  return new RegExp('^' + re + '$');
}

// ---------- 改动文件采集 ----------
function getChangedFiles(opts) {
  if (opts.files) return opts.files;
  const run = (cmd) => {
    try {
      return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
        .split('\n').map(s => s.trim()).filter(Boolean);
    } catch { return []; }
  };
  if (opts.since) {
    // 推送范围：三点 diff（merge-base...HEAD），ref 仅允许安全字符防注入
    const ref = String(opts.since).replace(/[^\w\-./@{}^~]/g, '');
    if (ref) return run(`git diff --name-only ${ref}...HEAD`);
  }
  const staged = run('git diff --name-only --cached');
  return staged.length > 0 ? staged : run('git diff --name-only');
}

// ---------- 匹配 ----------
function matchSkills(registry, files, prompt) {
  const hits = [];
  // 兼容多种注册表格式：skills / projectPhysicalSkills
  const skills = registry.skills || registry.projectPhysicalSkills || [];
  for (const skill of skills) {
    const fileHits = [];
    for (const glob of skill.triggers.files || []) {
      const re = globToRegex(glob);
      for (const f of files) {
        if (re.test(f)) fileHits.push({ glob, file: f });
      }
    }
    const keywordHits = [];
    if (prompt) {
      for (const kw of skill.triggers.keywords || []) {
        if (kw && prompt.includes(kw)) keywordHits.push(kw);
      }
    }
    if (fileHits.length > 0 || keywordHits.length > 0) {
      hits.push({ skill, fileHits, keywordHits });
    }
  }
  // mandatory 排前面
  hits.sort((a, b) => Number(b.skill.mandatory) - Number(a.skill.mandatory));
  return hits;
}

// ---------- 日志 ----------
function appendLog(mode, source, files, hits) {
  const line = [
    new Date().toISOString(),
    mode,
    source,
    `files=${files.length}`,
    `hits=${hits.map(h => h.skill.name + (h.skill.mandatory ? '(M)' : '')).join(',') || '-'}`,
  ].join('\t') + '\n';
  try { fs.appendFileSync(USAGE_LOG, line, 'utf-8'); } catch { /* 日志失败不阻断 */ }
}

// ---------- 主流程 ----------
function main() {
  const opts = parseArgs(process.argv.slice(2));

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch (e) {
    console.error(`[skill-router] 无法读取注册表 ${REGISTRY_PATH}: ${e.message}`);
    process.exit(2);
  }

  const files = getChangedFiles(opts);
  const source = opts.files ? '--files' : (opts.since ? `--since:${opts.since}` : (opts.prompt ? '--prompt' : 'git-diff'));
  const hits = matchSkills(registry, files, opts.prompt);

  if (hits.length === 0) {
    console.log(`[skill-router] 未命中任何技能（改动文件 ${files.length} 个${opts.prompt ? '，含 prompt 匹配' : ''}）。`);
    if (opts.log) appendLog(opts.mode, source, files, hits);
    return;
  }

  console.log(`[skill-router] 本次${opts.prompt ? '提示词' : '改动'}命中 ${hits.length} 个技能：`);
  for (const { skill, fileHits, keywordHits } of hits) {
    const tag = skill.mandatory ? 'mandatory' : 'advisory';
    console.log(`  ✦ ${skill.name} [${tag}]  →  ${skill.path}`);
    for (const h of fileHits.slice(0, 3)) console.log(`      文件匹配: ${h.glob}  ←  ${h.file}`);
    if (fileHits.length > 3) console.log(`      文件匹配: … 其余 ${fileHits.length - 3} 条略`);
    for (const kw of keywordHits.slice(0, 3)) console.log(`      关键词匹配: "${kw}"`);
    if (skill.gates && skill.gates.length > 0) {
      console.log('      交付前必跑:');
      for (const g of skill.gates) console.log(`        - ${g}`);
    }
  }

  if (opts.log) appendLog(opts.mode, source, files, hits);

  const mandatoryHits = hits.filter(h => h.skill.mandatory);
  if (opts.mode === 'enforce' && mandatoryHits.length > 0 && !opts.confirmed) {
    console.error('');
    console.error(`[skill-router] ⛔ 命中 ${mandatoryHits.length} 个 mandatory 技能，其 gates 未确认运行。`);
    console.error('[skill-router] 请先执行上述「交付前必跑」命令并全绿后重试；确认已跑过可加 --confirmed。');
    process.exit(1);
  }
}

main();
