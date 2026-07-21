const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = 'L:/FinSightV9';

// Run ESLint and get output
const eslintOutput = execSync(
  `"C:/Users/huawei/.workbuddy/binaries/node/versions/22.22.2/node.exe" node_modules/eslint/bin/eslint.js src/ tests/ --ext .ts,.tsx`,
  { cwd: base, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
);

fs.writeFileSync(path.join(base, 'eslint_out.txt'), eslintOutput, 'utf-8');
console.log('ESLint output saved to eslint_out.txt');
