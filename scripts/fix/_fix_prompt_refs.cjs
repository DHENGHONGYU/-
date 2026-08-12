const fs = require('fs');
const path = require('path');

const dir = 'docs/00-meta';
const files = fs.readdirSync(dir).filter(f => /[\u4e00-\u9fa5]/.test(f));
let totalFixed = 0;

for (const f of files) {
  const fp = path.join(dir, f);
  let content = fs.readFileSync(fp, 'utf8');
  const before = content;

  // Fix bare prompts/ references
  content = content.replace(/(^|[^\.\/\w])(prompts\/(?:service|store|system|component|types)-prompt-template\.md)/g,
    (m, prefix, target) => prefix + '../' + target);

  if (content !== before) {
    fs.writeFileSync(fp, content, 'utf8');
    const fixed = (before.match(/(^|[^\.\/\w])(prompts\/(?:service|store|system|component|types)-prompt-template\.md)/g) || []).length;
    totalFixed += fixed;
    console.log('Fixed', fixed, 'in', f);
  }
}
console.log('Total fixed:', totalFixed);
