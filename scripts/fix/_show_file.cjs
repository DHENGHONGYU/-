const fs = require('fs');
const path = require('path');
const dir = 'docs/reference';
const files = fs.readdirSync(dir);
// 文件管理清单 = e69687e4bbb6e695b4e79086e6b885e58d95
const targetBuf = Buffer.from('e69687e4bbb6e695b4e79086e6b885e58d95', 'hex');
let target = null;
for (const f of files) {
  if (Buffer.from(f, 'utf8').includes(targetBuf)) {
    target = f;
    break;
  }
}
console.log('Target file:', target);
if (target) {
  const fp = path.join(dir, target);
  const c = fs.readFileSync(fp, 'utf8');
  const lines = c.split('\n');
  for (let i = 40; i < 95; i++) {
    if (lines[i]) console.log((i+1) + ': ' + lines[i].substring(0, 200));
  }
}
