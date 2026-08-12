// 解析覆盖率报告的脚本
const fs = require('fs');
const path = require('path');

// 假设覆盖率报告在 coverage 目录下
const coverageDir = path.join(__dirname, 'coverage');
const summaryPath = path.join(coverageDir, 'coverage-summary.json');

if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  
  console.log('\n=== 最终测试覆盖率报告 ===\n');
  
  // 提取总体数据
  if (summary.total) {
    console.log('总体覆盖率:');
    console.log(`  语句覆盖 (Statements): ${summary.total.statements.pct}%`);
    console.log(`  分支覆盖 (Branches): ${summary.total.branches.pct}%`);
    console.log(`  函数覆盖 (Functions): ${summary.total.functions.pct}%`);
    console.log(`  行覆盖 (Lines): ${summary.total.lines.pct}%`);
  }
  
  // 提取 src/apps 相关数据
  console.log('\nInputApp 模块覆盖率 (src/apps/input):');
  for (const [file, data] of Object.entries(summary)) {
    if (file.includes('src/apps/input')) {
      console.log(`\n  ${file}:`);
      console.log(`    语句: ${data.statements?.pct ?? 'N/A'}%`);
      console.log(`    分支: ${data.branches?.pct ?? 'N/A'}%`);
      console.log(`    函数: ${data.functions?.pct ?? 'N/A'}%`);
      console.log(`    行: ${data.lines?.pct ?? 'N/A'}%`);
    }
  }
  
  console.log('\n=== 报告生成完成 ===\n');
} else {
  console.log('覆盖率报告文件不存在，请等待测试完成或检查脚本配置。');
}
