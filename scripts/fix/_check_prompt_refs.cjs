const fs = require('fs');
const dir = 'docs/00-meta';
const files = fs.readdirSync(dir).filter(f => /[\u4e00-\u9fa5]/.test(f));
for (const f of files) {
  const content = fs.readFileSync(dir + '/' + f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('prompts/service-prompt-template.md') || line.includes('prompts/store-prompt-template.md')) {
      console.log(f + ':' + (i + 1) + ': ' + line);
    }
  });
}
