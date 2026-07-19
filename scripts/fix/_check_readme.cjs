const fs = require('fs');
const c = fs.readFileSync('docs/explanation/README.md', 'utf8');
const re = /((?:\.\.\/)+prompts\/(?:\.\.\/)+prompts[^)\s`"']*)/g;
let m, count = 0;
while ((m = re.exec(c)) !== null) {
  count++;
  console.log('Found:', m[1]);
}
console.log('README.md repeated prompts paths:', count);
