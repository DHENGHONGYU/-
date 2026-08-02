const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const base = path.resolve(__dirname, '..');

// Run ESLint and get output
const eslintOutput = execSync(
  `"${process.execPath}" node_modules/eslint/bin/eslint.js src/ tests/ --ext .ts,.tsx`,
  { cwd: base, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
);

fs.writeFileSync(path.join(base, 'eslint_out.txt'), eslintOutput, 'utf-8');
console.log('ESLint output saved to eslint_out.txt');
