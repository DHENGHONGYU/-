// 折叠重复的 frontmatter 块（P0-1）
// 策略：保留所有前导 frontmatter 块中的字段，首块优先（first-wins）；
//       缺失 tier/code_version 时补默认值；最终输出单一 `---` 块。
// 安全：仅处理文件开头的连续 frontmatter 块（块间允许空行）；正文中的 `---` 水平线不动。
import fs from 'fs';
import path from 'path';

const ROOT = 'docs';
const EXCLUDE = ['node_modules', '.git', 'archive', 'deprecated-docs'];
const OUT_LOG = path.resolve('temp/normalize-frontmatter-log.json');

const changed = [];
const errors = [];

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (EXCLUDE.includes(f)) continue;
      walk(p, out);
    } else if (f.endsWith('.md')) {
      out.push(p);
    }
  }
}

// 解析开头连续 frontmatter 块；返回 { blocks: string[][], restStart: number }
function parseLeadingFrontmatter(lines) {
  const blocks = [];
  let i = 0;
  if (!lines[0] || lines[0].trim() !== '---') return { blocks, restStart: 0 };
  while (i < lines.length) {
    if (lines[i].trim() === '---') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '---') j++;
      if (j >= lines.length) break; // 未闭合，停止
      blocks.push(lines.slice(i + 1, j));
      i = j + 1;
      while (i < lines.length && lines[i].trim() === '') i++; // 跳过块间空行
      if (i < lines.length && lines[i].trim() === '---') continue; // 还有下一块
      else break; // 遇到真实内容，停止
    } else break;
  }
  return { blocks, restStart: i };
}

// 合并字段：first-wins；title 取最短（slug 优先）
function mergeBlocks(blocks) {
  const map = new Map();
  const titles = [];
  for (const bl of blocks) {
    for (const ln of bl) {
      const m = ln.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
      if (!m) continue;
      const k = m[1];
      const v = m[2];
      if (!map.has(k)) map.set(k, v);
      if (k === 'title' && v) titles.push(v);
    }
  }
  if (titles.length > 1) {
    titles.sort((a, b) => a.length - b.length);
    map.set('title', titles[0]);
  }
  if (!map.has('code_version')) map.set('code_version', '1.0.0');
  if (!map.has('tier')) map.set('tier', 'reference');
  return map;
}

const files = [];
walk(ROOT, files);
for (const f of files) {
  let content;
  try { content = fs.readFileSync(f, 'utf8'); } catch (e) { errors.push({ f, e: String(e) }); continue; }
  const lines = content.split(/\r?\n/);
  const { blocks, restStart } = parseLeadingFrontmatter(lines);
  if (blocks.length < 2) continue; // 无重复，跳过
  const merged = mergeBlocks(blocks);
  const fm = '---\n' + [...merged.entries()].map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n';
  const rest = lines.slice(restStart).join('\n');
  const newContent = fm + '\n' + rest;
  if (newContent === content) continue;
  try {
    fs.writeFileSync(f, newContent);
    changed.push({ f: f.replace('docs/', ''), blocks: blocks.length });
  } catch (e) {
    errors.push({ f, e: String(e) });
  }
}

fs.mkdirSync(path.dirname(OUT_LOG), { recursive: true });
fs.writeFileSync(OUT_LOG, JSON.stringify({ changedCount: changed.length, changed, errors }, null, 2));
console.log(`处理完成：折叠重复 frontmatter 块 ${changed.length} 个文件，错误 ${errors.length} 个。`);
console.log(`日志：${OUT_LOG}`);
