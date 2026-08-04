/**
 * V9 Store 并发安全审计脚本
 * 
 * 功能：扫描所有 Store 文件，检查是否包含异步方法以及防重入逻辑
 * 输出：需要添加防重入保护的文件清单
 */

const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(__dirname, '..', '..', 'src', 'store');
const STORE_PATTERN = /[A-Za-z]+Store\.ts$/;

// 异步方法名称模式（与 ESLint 规则保持一致）
const ASYNC_ACTION_PATTERN = /^(refresh|load|check|fetch|update|delete|add|save|remove|reset|run|execute|cancel|confirm|handle|generate|search|sync|import|export|start|stop|create|build|collect|scan|process|transfer|upload|download|send|receive|open|close|toggle|set|get|query|execute|submit|commit|dispatch|publish|subscribe)$/;

// 防重入模式检查
function hasProtection(source) {
  // 模式 A：isRefreshing 检查
  if (source.includes('isRefreshing') && source.includes('get().isRefreshing')) {
    return { type: 'A', pattern: 'isRefreshing 锁', found: true };
  }
  // 模式 B：RefreshCoordinator
  if (source.includes('coordinateRefresh')) {
    return { type: 'B', pattern: 'RefreshCoordinator 协调', found: true };
  }
  // 模式 C：通用 Coordinator
  if (source.includes('.coordinate(')) {
    return { type: 'C', pattern: '通用 Coordinator 协调', found: true };
  }
  return { type: 'NONE', pattern: '无防重入', found: false };
}

// 分析单个文件
function analyzeStoreFile(filePath) {
  const fileName = path.basename(filePath);
  if (!STORE_PATTERN.test(fileName)) return null;
  if (fileName.startsWith('__')) return null; // 跳过测试文件
  
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  
  // 查找所有 async 方法
  const asyncMethods = [];
  
  // 匹配模式1: methodName: async () => { ... }
  const arrowFnRegex = /(\w+):\s*async\s*\(\)[^{]*\{/g;
  let match;
  while ((match = arrowFnRegex.exec(content)) !== null) {
    const methodName = match[1];
    if (ASYNC_ACTION_PATTERN.test(methodName) && !methodName.startsWith('_')) {
      // 提取方法体（简化版本，只检查前几行）
      const methodStart = match.index;
      const methodBody = content.slice(methodStart, methodStart + 500);
      const protection = hasProtection(methodBody);
      asyncMethods.push({
        name: methodName,
        line: content.slice(0, methodStart).split('\n').length,
        hasProtection: protection.found,
        protectionType: protection.type,
        protectionPattern: protection.pattern
      });
    }
  }
  
  // 匹配模式2: async methodName() { ... }
  const methodDefRegex = /async\s+(\w+)\s*\(\)[^{]*\{/g;
  while ((match = methodDefRegex.exec(content)) !== null) {
    const methodName = match[1];
    if (ASYNC_ACTION_PATTERN.test(methodName) && !methodName.startsWith('_')) {
      const methodStart = match.index;
      const methodBody = content.slice(methodStart, methodStart + 500);
      const protection = hasProtection(methodBody);
      
      // 避免重复
      if (!asyncMethods.find(m => m.name === methodName)) {
        asyncMethods.push({
          name: methodName,
          line: content.slice(0, methodStart).split('\n').length,
          hasProtection: protection.found,
          protectionType: protection.type,
          protectionPattern: protection.pattern
        });
      }
    }
  }
  
  if (asyncMethods.length === 0) {
    return null; // 无异步方法，无需防重入
  }
  
  // 检查是否有 isRefreshing 状态定义
  const hasIsRefreshingState = 
    content.includes('isRefreshing: boolean') || 
    content.includes('isRefreshing:false') ||
    /isRefreshing:\s*(true|false)/.test(content);
  
  return {
    file: relativePath,
    hasIsRefreshingState,
    methods: asyncMethods,
    needsFix: asyncMethods.some(m => !m.hasProtection)
  };
}

// 主程序
function main() {
  const storeFiles = fs.readdirSync(STORE_DIR)
    .map(file => path.join(STORE_DIR, file))
    .filter(file => fs.statSync(file).isFile());
  
  const results = [];
  let totalMethods = 0;
  let protectedMethods = 0;
  let unprotectedMethods = 0;
  
  storeFiles.forEach(filePath => {
    const result = analyzeStoreFile(filePath);
    if (result) {
      results.push(result);
      totalMethods += result.methods.length;
      protectedMethods += result.methods.filter(m => m.hasProtection).length;
      unprotectedMethods += result.methods.filter(m => !m.hasProtection).length;
    }
  });
  
  // 输出报告
  console.log('='.repeat(80));
  console.log('V9 Store 并发安全审计报告');
  console.log('='.repeat(80));
  console.log(`审计时间: ${new Date().toISOString()}`);
  console.log(`扫描目录: src/store/`);
  console.log(`扫描文件数: ${storeFiles.length}`);
  console.log('');
  
  console.log('【总体统计】');
  console.log(`  - 含异步方法的 Store 文件: ${results.length}`);
  console.log(`  - 异步方法总数: ${totalMethods}`);
  console.log(`  - 已有防重入保护: ${protectedMethods}`);
  console.log(`  - 缺少防重入保护: ${unprotectedMethods}`);
  console.log(`  - 保护覆盖率: ${totalMethods > 0 ? ((protectedMethods / totalMethods) * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log('');
  
  // 列出需要修复的文件
  const needsFix = results.filter(r => r.needsFix);
  
  if (needsFix.length > 0) {
    console.log('❌ 需要添加防重入保护的文件:');
    console.log('');
    
    needsFix.forEach(r => {
      console.log(`📁 ${r.file}`);
      if (!r.hasIsRefreshingState) {
        console.log('   ⚠️  缺少 isRefreshing 状态定义');
      }
      r.methods.forEach(m => {
        if (!m.hasProtection) {
          console.log(`   ❌ ${m.name}() (行 ${m.line}): 缺少防重入检查`);
        } else {
          console.log(`   ✅ ${m.name}() (行 ${m.line}): ${m.protectionPattern}`);
        }
      });
      console.log('');
    });
  } else {
    console.log('✅ 所有异步方法都已包含防重入保护！');
  }
  
  // 列出已合规的文件
  const compliant = results.filter(r => !r.needsFix);
  if (compliant.length > 0) {
    console.log('✅ 已合规的文件:');
    compliant.forEach(r => {
      const methods = r.methods.map(m => `${m.name}(${m.protectionType})`).join(', ');
      console.log(`   - ${r.file}: ${methods}`);
    });
  }
  
  console.log('');
  console.log('='.repeat(80));
  
  // 输出修复建议
  if (needsFix.length > 0) {
    console.log('【修复清单】');
    console.log('');
    console.log('需要修改的文件及步骤:');
    console.log('');
    
    let step = 1;
    needsFix.forEach(r => {
      console.log(`${step}. ${r.file}`);
      if (!r.hasIsRefreshingState) {
        console.log(`   - 添加 isRefreshing: boolean 到 State 接口`);
        console.log(`   - 添加 isRefreshing: false 到 initialState`);
      }
      r.methods.forEach(m => {
        if (!m.hasProtection) {
          console.log(`   - 在 ${m.name}() 方法中添加防重入检查`);
        }
      });
      console.log('');
      step++;
    });
    
    console.log('【标准修复模板】');
    console.log('');
    console.log('1. State 接口添加:');
    console.log('   isRefreshing: boolean');
    console.log('');
    console.log('2. initialState 添加:');
    console.log('   isRefreshing: false');
    console.log('');
    console.log('3. create 函数签名:');
    console.log('   create<State>((set, get) => ({...}))');
    console.log('');
    console.log('4. 异步方法开头添加:');
    console.log('   if (get().isRefreshing) { return }');
    console.log('   set({ isRefreshing: true })');
    console.log('');
    console.log('5. 成功/失败路径重置:');
    console.log('   set({ isRefreshing: false })');
  }
  
  console.log('='.repeat(80));
  
  // 保存 JSON 报告
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: storeFiles.length,
      filesWithAsyncMethods: results.length,
      totalAsyncMethods: totalMethods,
      protectedMethods,
      unprotectedMethods,
      coverageRate: totalMethods > 0 ? ((protectedMethods / totalMethods) * 100) : 0
    },
    needsFix: needsFix.map(r => ({
      file: r.file,
      hasIsRefreshingState: r.hasIsRefreshingState,
      methods: r.methods.map(m => ({
        name: m.name,
        line: m.line,
        hasProtection: m.hasProtection,
        protectionType: m.protectionType
      }))
    })),
    compliant: compliant.map(r => ({
      file: r.file,
      methods: r.methods.map(m => ({
        name: m.name,
        line: m.line,
        protectionType: m.protectionType,
        protectionPattern: m.protectionPattern
      }))
    }))
  };
  
  const reportPath = path.join(__dirname, 'store-concurrency-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
  console.log(`报告已保存至: store-concurrency-audit-report.json`);
  
  // 返回退出码
  process.exit(unprotectedMethods > 0 ? 1 : 0);
}

main();
