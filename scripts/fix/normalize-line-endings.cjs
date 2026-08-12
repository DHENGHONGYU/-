/**
 * 统一文档行尾符为 LF
 *
 * 背景：.gitattributes 已声明 `* text=auto eol=lf`，但工作区存在 17 个纯 CRLF
 *       与 162 个混合行尾（LF 主导 + 少量 CRLF 残留）的 .md 文件，需统一为 LF。
 *
 * 处理：仅将 \r\n 替换为 \n，不改编码、不改内容。仅处理工作区已有改动的
 *       之外，将扫描范围内的 .md 全部规范化（幂等，已 LF 的文件无变化）。
 *
 * 用法：
 *   node scripts/fix/normalize-line-endings.cjs --dry-run
 *   node scripts/fix/normalize-line-endings.cjs
 */
const fs = require('fs');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');

const files = execSync('git ls-files "*.md"').toString().trim().split(/\r?\n/).filter(Boolean);

let changed = 0, unchanged = 0, pureCRLF = 0;
const changedFiles = [];

for (const f of files) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (!s.includes('\r')) { unchanged++; continue; }
  const newS = s.replace(/\r\n/g, '\n');
  if (newS === s) { unchanged++; continue; }
  const wasPureCRLF = !s.includes('\n') || (s.split('\n').length - 1) === (s.match(/\r\n/g) || []).length;
  if (wasPureCRLF) pureCRLF++;
  changed++;
  changedFiles.push({ f, wasPureCRLF });
  if (DRY_RUN) {
    console.log(`[dry] ${wasPureCRLF ? '[纯CRLF]' : '[混合]  '} ${f}`);
  } else {
    fs.writeFileSync(f, newS);
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`需规范化 ${changed} 份（含纯 CRLF ${pureCRLF} 份），无需改动 ${unchanged} 份`);
if (DRY_RUN && changedFiles.length <= 40) {
  for (const c of changedFiles) console.log(`  - ${c.f}`);
}
