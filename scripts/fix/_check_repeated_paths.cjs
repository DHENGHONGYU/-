const fs = require('fs');
const path = require('path');

const dir = 'docs';
function walk(d) {
  const r = [];
  if (!fs.existsSync(d)) return r;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      r.push(...walk(f));
    } else if (/\.md$/.test(e.name)) {
      r.push(f);
    }
  }
  return r;
}

const files = walk(dir);
let count = 0;
const samples = [];
const matches = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  // Look for any sequence of ../../prompts repeated
  const re = /((?:\.\.\/)+prompts\/(?:\.\.\/)+prompts[^)\s`"']*)/g;
  let m;
  while ((m = re.exec(c)) !== null) {
    matches.push({ file: f, target: m[1] });
    if (!samples.find(s => s.file === f)) {
      samples.push({ file: f, target: m[1] });
    }
    count++;
  }
}

console.log('Total repeated ../../prompts/../../prompts paths found:', count);
console.log('Files affected:', samples.length);
samples.forEach(s => console.log('  ' + s.file + ' -> ' + s.target));
console.log('\nAll matches:');
matches.forEach(m => console.log('  ' + m.file + ' :: ' + m.target));
