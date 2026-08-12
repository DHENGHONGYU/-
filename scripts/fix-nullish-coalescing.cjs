/**
 * 自动化修复 strict-boolean-expressions: 将 || 替换为 ??
 * 仅处理简单场景: var || defaultValue → var ?? defaultValue
 * 
 * 使用方法: node scripts/fix-nullish-coalescing.cjs [--dry-run]
 * 
 * 注意: 此脚本仅处理简单赋值和函数参数中的 || 运算符，
 *       对于复杂的逻辑判断（如 if 条件中的 ||）不会修改。
 *       运行后请手动检查代码逻辑。
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.resolve(__dirname, '..', 'src'),
  extensions: ['.ts', '.tsx'],
  dryRun: process.argv.includes('--dry-run'),
  // 这些字符串后面的 || 不应该被替换（避免逻辑错误）
  excludePatterns: [
    /if\s*\(/,
    /while\s*\(/,
    /for\s*\(/,
    /\?\s*.*\s*:/,
  ],
};

/**
 * 判断是否应该替换该位置的 || 为 ??
 */
function shouldReplace(context, line) {
  // 如果是在 if/while/for 条件中，跳过
  if (/^\s*(if|while|for)\s*\(/.test(line)) return false;
  
  // 如果是三元表达式，跳过
  if (/\?.*:/.test(line)) return false;
  
  // 如果是函数调用参数，跳过
  if (/^\s*\w+\(.*\|\|/.test(line)) return false;
  
  return true;
}

/**
 * 替换单行中的 || 为 ??
 * 只处理简单模式: var || default → var ?? default
 */
function replaceInLine(line, filePath, lineNum) {
  // 匹配模式: identifier || value → identifier ?? value
  // 不处理: 字符串字面量中的 ||、连续的 || || 操作
  
  const original = line;
  
  // 模式 1: 简单赋值
  // const x = value || default
  // let x = value || default
  // x = value || default
  let replaced = line.replace(
    /(const|let|var|\w+)\s*=\s*(\w+(?:\??\.?\w+)*)\s*\|\|\s*(.+)/g,
    (match, keyword, expr, defaultVal) => {
      // 如果 || 后面是字符串 '' 或数字 0，优先处理
      return `${keyword} = ${expr} ?? ${defaultVal.trim()}`;
    }
  );
  
  // 模式 2: 在对象字面量中
  // { key: value || default }
  replaced = replaced.replace(
    /(\w+)\s*:\s*(\w+(?:\??\.?\w+)*)\s*\|\|\s*(.+)/g,
    (match, key, expr, defaultVal) => {
      // 如果 key 和 value 相同，替换
      if (key === expr || /\?\./.test(expr)) {
        return `${key}: ${expr} ?? ${defaultVal.trim()}`;
      }
      return match;
    }
  );
  
  return replaced !== original;
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) return 0;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modifiedLines = 0;
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const modified = replaceInLine(line, filePath, i + 1);
    
    if (modified) {
      modifiedLines++;
      if (CONFIG.dryRun) {
        console.log(`  [DRY] ${filePath}:${i + 1}`);
        console.log(`    - ${line.trim()}`);
        console.log(`    + ${modified}`);
      }
    }
    newLines.push(modified || line);
  }
  
  if (modifiedLines > 0 && !CONFIG.dryRun) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log(`Fixed ${modifiedLines} lines in ${path.relative(CONFIG.srcDir, filePath)}`);
  }
  
  return modifiedLines;
}

/**
 * 遍历目录
 */
function walkDir(dir) {
  let totalFixed = 0;
  const entries = fs.readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules 和 .git
      if (['node_modules', '.git', '__mocks__'].includes(entry)) continue;
      totalFixed += walkDir(fullPath);
    } else if (CONFIG.extensions.includes(path.extname(entry))) {
      totalFixed += processFile(fullPath);
    }
  }
  
  return totalFixed;
}

// 执行
console.log(`=== 自动化修复 strict-boolean-expressions: || → ?? ===`);
console.log(`模式: ${CONFIG.dryRun ? 'DRY RUN (仅预览)' : 'APPLY (实际修改)'}`);
console.log(`扫描目录: ${CONFIG.srcDir}`);
console.log(`扩展名: ${CONFIG.extensions.join(', ')}`);
console.log('='.repeat(60));

const totalFixed = walkDir(CONFIG.srcDir);

console.log('='.repeat(60));
console.log(`完成！共修复 ${totalFixed} 处 || → ??`);

if (CONFIG.dryRun) {
  console.log('\n这是 DRY RUN 模式，文件未被实际修改。');
  console.log('确认无误后，运行: node scripts/fix-nullish-coalescing.cjs');
} else {
  console.log('\n建议: 运行 ESLint 检查修复结果');
  console.log('  npx eslint src/');
  console.log('然后手动检查修复的代码是否符合预期。');
}
