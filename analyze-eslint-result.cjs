/**
 * 分析 ESLint 扫描结果，提取 v9-store/no-async-without-is-refreshing 违规
 */

const fs = require('fs');
const path = require('path');

// 读取 ESLint 输出（处理 UTF-8 BOM）
const eslintOutputPath = path.join(__dirname, 'eslint-scan-result.json');
let rawContent = fs.readFileSync(eslintOutputPath, 'utf8');
if (rawContent.charCodeAt(0) === 0xFEFF) {
  rawContent = rawContent.slice(1);
}
const rawData = JSON.parse(rawContent);

// 提取 v9-store 规则违规
const v9RuleId = 'v9-store/no-async-without-is-refreshing';
const violations = [];

rawData.forEach(file => {
  const relevantMessages = file.messages.filter(
    msg => msg.ruleId === v9RuleId
  );
  
  relevantMessages.forEach(msg => {
    violations.push({
      file: file.filePath.replace('D:\\FinSightV9\\', ''),
      line: msg.line,
      column: msg.column,
      message: msg.message,
      ruleId: msg.ruleId,
      severity: msg.severity === 2 ? 'error' : 'warning'
    });
  });
});

// 统计违规详情
console.log('='.repeat(70));
console.log('ESLint 并发安全扫描报告');
console.log('='.repeat(70));
console.log(`扫描时间: ${new Date().toISOString()}`);
console.log(`扫描目录: src/store/`);
console.log('');

if (violations.length === 0) {
  console.log('✅ 扫描通过！所有 Store 文件的异步 action 都已包含防重入逻辑。');
  console.log('');
  console.log('规则: v9-store/no-async-without-is-refreshing');
  console.log('状态: 0 violations (全部合规)');
} else {
  console.log(`❌ 发现 ${violations.length} 处违规，涉及以下文件:`);
  console.log('');
  
  // 按文件分组
  const byFile = {};
  violations.forEach(v => {
    if (!byFile[v.file]) {
      byFile[v.file] = [];
    }
    byFile[v.file].push({ line: v.line, message: v.message });
  });
  
  Object.entries(byFile).forEach(([file, msgs]) => {
    console.log(`📁 ${file}:`);
    msgs.forEach(msg => {
      console.log(`   - 行 ${msg.line}: ${msg.message}`);
    });
    console.log('');
  });
  
  console.log('修复建议:');
  console.log('1. 在 State 接口中添加 isRefreshing: boolean');
  console.log('2. 在 initialState 中设置 isRefreshing: false');
  console.log('3. 在 create 函数签名中添加 get 参数: create<State>((set, get) => ({...}))');
  console.log('4. 在异步 action 首行添加防重入检查:');
  console.log('   if (get().isRefreshing) { return; }');
  console.log('5. 在执行前设置 isRefreshing: true，完成后重置为 false');
}

console.log('='.repeat(70));

// 输出 JSON 格式的违规清单供后续使用
const outputPath = path.join(__dirname, 'concurrency-violations.json');
fs.writeFileSync(outputPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalViolations: violations.length,
  violations: violations.map(v => ({
    file: v.file,
    line: v.line,
    action: v.message.match(/async action "(\w+)"/)?.[1] || 'unknown',
    message: v.message
  }))
}, null, 2));

console.log(`违规清单已保存至: concurrency-violations.json`);
