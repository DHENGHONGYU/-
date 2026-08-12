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

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  // Look for any sequence of ../../ repeats
  // Pattern 1: ../../X/../../X
  const patterns = [
    /((?:\.\.\/)+reference\/(?:\.\.\/)+reference[^)\s`"']*)/g,
    /((?:\.\.\/)+reports\/(?:\.\.\/)+[^)\s`"']*)/g,
    /((?:\.\.\/)+docs\/(?:\.\.\/)+docs[^)\s`"']*)/g,
    /((?:\.\.\/)+AGENTS\.md(?:\s|["'`)<]|$))/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(c)) !== null) {
      samples.push({ file: f, target: m[1] });
      count++;
    }
  }
}

console.log('Total suspicious repeated paths:', count);
samples.forEach(s => console.log('  ' + s.file + ' :: ' + s.target));
