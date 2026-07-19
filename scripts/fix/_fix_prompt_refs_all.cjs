const fs = require('fs');
const path = require('path');

const dirs = ['docs'];
let totalFixed = 0;

function walk(d) {
  const r = [];
  if (!fs.existsSync(d)) return r;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage', 'archive'].includes(e.name)) continue;
      r.push(...walk(f));
    } else if (/\.md$/.test(e.name)) {
      r.push(f);
    }
  }
  return r;
}

const files = dirs.flatMap(d => walk(d));

for (const fp of files) {
  let content = fs.readFileSync(fp, 'utf8');
  const before = content;

  // Compute the relative path from file directory to root
  const fpRel = fp.replace(/\\/g, '/');
  const dirRel = path.dirname(fpRel);
  let prefix = '';
  if (dirRel !== '.') {
    const levels = dirRel.split('/').length;
    prefix = '../'.repeat(levels);
  }

  // Fix bare prompts/ references - they should be relative to root
  content = content.replace(/(^|[^\.\/\w])(prompts\/(?:service|store|system|component|types)-prompt-template\.md)/g,
    (m, p, target) => p + prefix + target);

  if (content !== before) {
    fs.writeFileSync(fp, content, 'utf8');
    const fixed = (before.match(/(^|[^\.\/\w])(prompts\/(?:service|store|system|component|types)-prompt-template\.md)/g) || []).length;
    totalFixed += fixed;
    console.log('Fixed', fixed, 'in', fp);
  }
}
console.log('Total fixed:', totalFixed);
