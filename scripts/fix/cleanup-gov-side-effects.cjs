/**
 * 治理脚本副作用清理
 *
 * 背景：fix-b-lastupdated.cjs 在部分文件引入了两类瑕疵：
 *   (1) 重复 last_updated 字段（原本已有 last_updated，又被插入一条）
 *   (2) frontmatter 起始 `---` 后多余空行
 *
 * 处理：
 *   - last_updated 出现多次时，保留第一条（HEAD 原值优先），删除其余重复行
 *   - frontmatter 起始 `---\n\n` 且 HEAD 版本无此空行时，删除空行（仅当 HEAD 无空行）
 *
 * 用法：
 *   node scripts/fix/cleanup-gov-side-effects.cjs --dry-run
 *   node scripts/fix/cleanup-gov-side-effects.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('--dryrun');
const ROOT = process.cwd();

function gitShowHead(rel) {
  try {
    return execSync(`git show HEAD:${rel}`, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch { return null; }
}

const files = execSync('git diff --name-only -- docs/', { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

let fixed = 0;
const report = [];

for (const rel of files) {
  const fp = path.join(ROOT, rel);
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch { continue; }
  const head = gitShowHead(rel);
  const changes = [];

  let newContent = content;

  // --- (1) frontmatter 起始多余空行：HEAD 无 `---\n\n` 而当前有 ---
  const headHasBlank = head && /^---\n\n/.test(head);
  if (!headHasBlank && /^---\n\n/.test(newContent)) {
    newContent = newContent.replace(/^---\n\n/, '---\n');
    changes.push('去除 frontmatter 起始空行');
  }

  // --- (2) 重复 last_updated：保留第一条，删除其余（仅限 frontmatter 区内）
  const fmMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    let seen = false;
    const out = [];
    for (const line of fmLines) {
      if (/^last_updated:\s*/.test(line)) {
        if (seen) { changes.push('删除重复 last_updated'); continue; }
        seen = true;
      }
      out.push(line);
    }
    if (out.join('\n') !== fmLines.join('\n')) {
      newContent = newContent.replace(fmMatch[1], out.join('\n'));
    }
  }

  if (newContent !== content) {
    fixed++;
    report.push({ rel, changes });
    if (DRY_RUN) {
      console.log(`[dry] ${rel}: ${changes.join('; ')}`);
    } else {
      fs.writeFileSync(fp, newContent);
    }
  }
}

console.log(`\n========== 摘要 ==========`);
console.log(`清理 ${fixed} 份`);
for (const r of report) console.log(`  - ${r.rel}: ${r.changes.join('; ')}`);
