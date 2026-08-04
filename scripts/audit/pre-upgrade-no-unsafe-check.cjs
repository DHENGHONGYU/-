// scripts/audit/pre-upgrade-no-unsafe-check.cjs
const fs = require('fs');
const raw = fs.readFileSync('outputs/pre-upgrade-eslint-full.json', 'utf8').replace(/^\uFEFF/, '');
const d = JSON.parse(raw);
let noUnsafe = 0;
const files = [];
for (const f of d) {
  for (const m of f.messages) {
    if (m.ruleId === '@typescript-eslint/no-unsafe-member-access') {
      noUnsafe++;
      const fn = f.filePath.replace(/.*FinSightV9[\\/]/, '');
      const last = files[files.length - 1];
      if (!last || last.file !== fn) {
        files.push({ file: fn, count: 1, line: m.line });
      } else {
        last.count++;
      }
    }
  }
}
console.log('=== 规则升级前：全仓 no-unsafe-member-access 警告数 ===');
console.log('  总数: ' + noUnsafe);
if (noUnsafe === 0) {
  console.log('  ✅ 0处！可以安全升级为 error');
} else {
  console.log('  ❌ 存在 ' + noUnsafe + ' 处，升级到 error 会阻断 CI。按文件分布：');
  for (const f of files) {
    console.log('    ' + f.file + ': ' + f.count + ' 处 例:L' + f.line);
  }
}
process.exit(noUnsafe === 0 ? 0 : 1);
