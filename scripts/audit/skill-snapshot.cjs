#!/usr/bin/env node
/**
 * skill-snapshot.cjs — 采集 21 Registry entries + 22 SKILL.md frontmatter 关键字段快照
 * 输出：
 *   output/skill-snapshot-before.json — before-fix 快照
 *   output/skill-snapshot-after.json  — after-fix 快照（后续再跑一遍生成）
 *   每个 skill 记录：{name, side: 'registry'|'skill', fields:{...compareKeys...}}
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.trae', 'skills', 'skill-registry.json');
const SKILLS_DIR = path.join(ROOT, '.trae', 'skills');
const OUT_DIR = path.join(ROOT, 'outputs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function read(p) {
  let s = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s;
}
function parseInlineArray(line) {
  const m = line.match(/\[([^\]]*)\]/);
  if (!m) return [];
  const raw = m[1];
  const items = [];
  let cur = '', quote = null, inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (!inQ && (c === '"' || c === "'")) { inQ = true; quote = c; continue; }
    if (inQ && c === quote) { inQ = false; quote = null; continue; }
    if (!inQ && c === ',') { if (cur.trim()) items.push(cur.trim().replace(/^["']|["']$/g,'')); cur=''; continue; }
    cur += c;
  }
  if (cur.trim()) items.push(cur.trim().replace(/^["']|["']$/g,''));
  return items;
}
function extractFrontmatterKeyFields(fm) {
  const out = { id: '', name: '', category: '', version: '', mandatory: '', tags: [], covers_docs: [], related_skills: [], triggersText: '', gatesText: '' };
  for (const line of fm.split('\n')) {
    const lm = line.match(/^(\w+):\s*(.*)$/);
    if (!lm) continue;
    const key = lm[1], rest = lm[2].trim();
    if (key === 'skill_id' || key === 'id') out.id = rest;
    else if (key === 'name') out.name = rest;
    else if (key === 'category') out.category = rest;
    else if (key === 'version') out.version = rest;
    else if (key === 'mandatory') out.mandatory = rest;
    else if (key === 'tags' && rest.startsWith('[')) out.tags = parseInlineArray(rest);
    else if (key === 'covers_docs' && rest.startsWith('[')) out.covers_docs = parseInlineArray(rest);
    else if (key === 'related_skills' && rest.startsWith('[')) out.related_skills = parseInlineArray(rest);
    else if (key === 'triggers' && (rest.startsWith('{') || rest.startsWith('['))) out.triggersText = rest;
    else if (key === 'gates' && (rest.startsWith('{') || rest.startsWith('['))) out.gatesText = rest;
  }
  // 多行 triggers/gates 压缩为 triggersText/gatesText（按 1000 字截断）
  const fmNoLeading = '\n' + fm.replace(/^---\n?|\n?---$/g, '');
  const tBlock = fmNoLeading.match(/\ntriggers:([\s\S]*?)(?=\n[a-z_][a-z0-9_]*:\s*|\n---|$)/i);
  if (tBlock) { out.triggersText = ('triggers:' + tBlock[1]).replace(/\s+/g,' ').trim().slice(0,1200); }
  const gBlock = fmNoLeading.match(/\ngates:([\s\S]*?)(?=\n[a-z_][a-z0-9_]*:\s*|\n---|$)/i);
  if (gBlock) { out.gatesText = ('gates:' + gBlock[1]).replace(/\s+/g,' ').trim().slice(0,1200); }
  return out;
}
function registryKeyFields(reg) {
  const t = reg.triggers || {};
  const g = reg.gates || [];
  const tStr = 'keywords:' + (t.keywords||[]).join('|') + '|files:' + (t.files||[]).join('|') + '|events:' + (t.events||[]).join('|');
  const gStr = Array.isArray(g) ? g.join('|') : String(g);
  return {
    id: reg.id || '', name: reg.name || '', category: reg.category || '',
    version: reg.version || '', mandatory: String(reg.mandatory),
    tags: reg.tags || [], covers_docs: reg.covers_docs || [], related_skills: reg.related_skills || [],
    triggersText: tStr, gatesText: gStr,
  };
}

const regAll = JSON.parse(read(REGISTRY_PATH));
const regEntries = (regAll.skills || []).map(s => ({ name: s.name, side: 'registry', path: s.path, fields: registryKeyFields(s) }));

const skillEntries = [];
for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sm = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
  if (!fs.existsSync(sm)) continue;
  const content = read(sm);
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? fmMatch[1] : '';
  const fmStripped = fm.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  skillEntries.push({ name: entry.name, side: 'skill', path: path.relative(ROOT, sm).replace(/\\/g,'/'), fields: extractFrontmatterKeyFields(fmStripped) });
}
const snapshot = {
  takenAt: new Date().toISOString(),
  registry: regEntries,
  skills: skillEntries,
};
const outPath = path.join(OUT_DIR, process.argv[2] || 'skill-snapshot-before.json');
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
console.log('Wrote', outPath, 'reg=' + regEntries.length, 'skills=' + skillEntries.length);
