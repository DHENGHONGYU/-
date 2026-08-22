#!/usr/bin/env node
/**
 * audit-platform-docs.cjs — 跨平台 WIKI 统一契约防漂移审计
 *
 * 契约真相源：wiki/CONTRACT.md（V9-DOC-WIKI-002）
 * 机器注册表：wiki/platform-config.registry.json
 *
 * 校验项：
 *   1. core-files-exist            wiki/ 三核心文件存在且 frontmatter 必备字段齐全、日期新鲜
 *   2. registry-vs-physical        注册表登记的目录/适配文件/机器文件/配置卡物理存在
 *   3. adapter-marker-valid        适配文件含 WIKI-ADAPTER 标记，且引用的 wiki/ 路径有效
 *   4. no-knowledge-duplicates     平台目录无知识副本残留（旧式技能索引表等）
 *
 * 退出码：0 = 全绿；1 = 存在阻断性违规；2 = 执行错误（注册表缺失等）
 * 用法：node scripts/audit/audit-platform-docs.cjs （或 npm run audit:platform-docs）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WIKI = path.join(ROOT, 'wiki');
const REGISTRY_PATH = path.join(WIKI, 'platform-config.registry.json');
const MARKER = 'WIKI-ADAPTER: source=wiki/';
const FRESHNESS_DAYS = 180;

const violations = [];
const passed = [];

function fail(rule, item, detail) {
  violations.push({ rule, item, detail });
}

function ok(msg) {
  passed.push(msg);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function isDir(p) {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isJunctionOrSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function frontmatterField(content, field) {
  const m = content.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

/* ---------- 1. core-files-exist ---------- */
function checkCoreFiles() {
  const coreDocs = ['wiki/README.md', 'wiki/CONTRACT.md'];
  for (const rel of coreDocs) {
    if (!exists(rel)) {
      fail('core-files-exist', rel, '核心文件缺失');
      continue;
    }
    const text = read(rel);
    for (const field of ['title', 'version', 'last_updated', 'doc_id', 'change_log']) {
      if (!frontmatterField(text, field)) {
        fail('core-files-exist', rel, `frontmatter 缺 ${field}`);
      }
    }
    const lu = frontmatterField(text, 'last_updated');
    if (lu) {
      const ageDays = (Date.now() - new Date(lu).getTime()) / 86400000;
      if (Number.isNaN(ageDays)) {
        fail('core-files-exist', rel, `last_updated 非法日期: ${lu}`);
      } else if (ageDays > FRESHNESS_DAYS) {
        fail('core-files-exist', rel, `last_updated 超 ${FRESHNESS_DAYS} 天未刷新 (${lu})`);
      }
    }
  }
  if (!exists('wiki/platform-config.registry.json')) {
    fail('core-files-exist', 'wiki/platform-config.registry.json', '机器注册表缺失');
  }
  if (violations.length === 0) ok('core-files-exist: wiki/ 三核心文件存在且元数据新鲜');
}

/* ---------- 2/3. registry 一致性 + 适配标记 ---------- */
function checkRegistry(registry) {
  for (const p of registry.platforms) {
    for (const dir of p.dirs || []) {
      if (!isDir(path.join(ROOT, dir))) {
        fail('registry-vs-physical', `${p.id}/${dir}`, '注册表登记的目录不存在');
      }
    }
    for (const mf of p.machineFiles || []) {
      if (!exists(mf)) {
        fail('registry-vs-physical', `${p.id}/${mf}`, '注册表登记的机器文件不存在');
      }
    }
    if (p.card && !exists(p.card)) {
      fail('registry-vs-physical', `${p.id}/${p.card}`, '平台环境配置卡不存在');
    }
    for (const af of p.adapterFiles || []) {
      if (!exists(af)) {
        fail('registry-vs-physical', `${p.id}/${af}`, '注册表登记的适配文件不存在');
        continue;
      }
      const text = read(af);
      if (!text.includes(MARKER)) {
        fail('adapter-marker-valid', af, `缺 ${MARKER} 标记`);
      }
      // 适配文件引用的 wiki/ 路径必须有效
      const refs = text.match(/wiki\/[A-Za-z0-9_\-./]+\.(?:md|json)/g) || [];
      for (const ref of [...new Set(refs)]) {
        if (!exists(ref)) {
          fail('adapter-marker-valid', af, `引用的真相源路径不存在: ${ref}`);
        }
      }
    }
  }
  ok(`registry-vs-physical: ${registry.platforms.length} 个平台条目核对完成`);
}

/* ---------- 4. no-knowledge-duplicates ---------- */
function checkDuplicates() {
  // .trae/skills/INDEX.md 必须保持指针形态，不得残留旧式技能清单表
  const traeIndex = '.trae/skills/INDEX.md';
  if (exists(traeIndex)) {
    const text = read(traeIndex);
    if (/V9-SKILL-(GATEKEEPER|ARCH-DEBT|CROSSINDEX)/.test(text)) {
      fail('no-knowledge-duplicates', traeIndex, '残留旧式技能清单（知识副本），应只保留指针');
    }
    if (!text.includes(MARKER)) {
      fail('no-knowledge-duplicates', traeIndex, '缺适配标记，疑似被改写为内容副本');
    }
  }
  // .workbuddy/skills 若为普通目录（cp 副本态），其 README 必须带指针标记
  const wb = path.join(ROOT, '.workbuddy', 'skills');
  if (isDir(wb) && !isJunctionOrSymlink(wb)) {
    const readme = path.join(wb, 'README.md');
    if (fs.existsSync(readme)) {
      const text = fs.readFileSync(readme, 'utf8');
      if (!text.includes('wiki/') && !text.includes(MARKER)) {
        fail('no-knowledge-duplicates', '.workbuddy/skills/README.md', 'cp 副本态缺指针标记，请重跑 npm run skill:mirror');
      }
    }
  }
  ok('no-knowledge-duplicates: 平台目录知识副本抽检完成');
}

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('[audit-platform-docs] FATAL: wiki/platform-config.registry.json 缺失');
    process.exit(2);
  }
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (e) {
    console.error(`[audit-platform-docs] FATAL: 注册表解析失败: ${e.message}`);
    process.exit(2);
  }

  checkCoreFiles();
  checkRegistry(registry);
  checkDuplicates();

  if (violations.length > 0) {
    console.error(`[audit-platform-docs] FAIL: ${violations.length} 项违规`);
    for (const v of violations) {
      console.error(`  ✗ [${v.rule}] ${v.item} — ${v.detail}`);
    }
    process.exit(1);
  }

  console.log('[audit-platform-docs] PASS — 跨平台 WIKI 契约一致性全绿');
  for (const p of passed) console.log(`  ✓ ${p}`);
  process.exit(0);
}

main();
