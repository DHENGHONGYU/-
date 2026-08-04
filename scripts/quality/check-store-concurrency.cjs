#!/usr/bin/env node
/**
 * V9 Store 并发安全 CI 检查脚本
 * 
 * 用途：在 CI 流水线中自动检测 Store 文件是否包含防重入逻辑
 * 集成方式：添加到 package.json scripts 或 CI 配置
 * 
 * 使用方式：
 *   npm run audit:store-concurrency    # 检查所有 Store 文件
 *   npm run audit:store-concurrency -- --fix  # 同时生成修复建议
 *   npm run audit:store-concurrency -- --ci   # CI 模式（严格退出码）
 * 
 * 规则：v9-store/no-async-without-is-refreshing
 * 严重级别：error（P0）
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 要扫描的目录
  scanDirs: ['src/store/'],
  
  // ESLint 规则 ID
  ruleId: 'v9-store/no-async-without-is-refreshing',
  
  // 允许的防重入模式（用于代码审计脚本）
  protectionPatterns: [
    { name: '模式 A', description: 'isRefreshing 锁', patterns: ['isRefreshing'] },
    { name: '模式 B', description: 'RefreshCoordinator 协调', patterns: ['coordinateRefresh'] },
    { name: '模式 C', description: '通用 Coordinator 协调', patterns: ['.coordinate('] },
  ],
  
  // 异步方法命名模式
  asyncMethodPattern: /^(refresh|load|check|fetch|update|delete|add|save|remove|reset|run|execute|cancel|confirm|handle|generate|search|sync|import|export|start|stop|create|build|collect|scan|process|transfer|upload|download|send|receive|open|close|toggle|set|get|query|submit|commit|dispatch|publish|subscribe)$/,
  
  // 豁免的文件模式
  exemptFiles: ['useSearchStore', 'useTokenStore', 'useVoiceStore'],
  
  // 报告输出目录
  reportDir: 'outputs/audit',
};

// 颜色输出
const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// 日志工具
const logger = {
  info: (msg) => console.log(`${COLORS.cyan}[INFO]${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}[PASS]${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}[FAIL]${COLORS.reset} ${msg}`),
  warn: (msg) => console.log(`${COLORS.yellow}[WARN]${COLORS.reset} ${msg}`),
  section: (msg) => {
    console.log('');
    console.log(`${COLORS.bold}${COLORS.magenta}${'='.repeat(70)}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.magenta} ${msg}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.magenta}${'='.repeat(70)}${COLORS.reset}`);
    console.log('');
  },
};

/**
 * 运行 ESLint 检查
 */
function runEslintCheck() {
  logger.info('运行 ESLint 并发安全检查...');
  
  try {
    const cmd = `npx eslint ${CONFIG.scanDirs.join(' ')} --ext .ts --format json 2>&1`;
    const output = execSync(cmd, { 
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // 处理 BOM
    let cleanOutput = output;
    if (cleanOutput.charCodeAt(0) === 0xFEFF) {
      cleanOutput = cleanOutput.slice(1);
    }
    
    const results = JSON.parse(cleanOutput);
    
    // 提取 v9-store 规则违规
    const violations = [];
    let totalFiles = 0;
    let filesWithViolations = new Set();
    
    results.forEach(file => {
      totalFiles++;
      const relevantMessages = file.messages.filter(
        msg => msg.ruleId === CONFIG.ruleId
      );
      
      relevantMessages.forEach(msg => {
        const relativePath = file.filePath
          .replace(process.cwd(), '')
          .replace(/^\//, '')
          .replace(/\\/g, '/');
        
        violations.push({
          file: relativePath,
          line: msg.line,
          column: msg.column,
          message: msg.message,
          severity: msg.severity === 2 ? 'error' : 'warning',
        });
        filesWithViolations.add(relativePath);
      });
    });
    
    return {
      success: true,
      totalFiles,
      totalViolations: violations.length,
      filesWithViolations: filesWithViolations.size,
      violations,
    };
  } catch (err) {
    // ESLint 退出码非 0 可能表示有违规，尝试解析输出
    try {
      let output = err.stdout?.toString() || err.stderr?.toString() || '';
      if (output.charCodeAt(0) === 0xFEFF) {
        output = output.slice(1);
      }
      
      // 尝试提取 JSON 部分
      const jsonStart = output.indexOf('[');
      const jsonEnd = output.lastIndexOf(']');
      if (jsonStart >= 0 && jsonEnd >= 0) {
        const jsonStr = output.slice(jsonStart, jsonEnd + 1);
        const results = JSON.parse(jsonStr);
        
        const violations = [];
        let totalFiles = 0;
        let filesWithViolations = new Set();
        
        results.forEach(file => {
          totalFiles++;
          const relevantMessages = file.messages.filter(
            msg => msg.ruleId === CONFIG.ruleId
          );
          
          relevantMessages.forEach(msg => {
            const relativePath = file.filePath
              .replace(process.cwd(), '')
              .replace(/^\//, '')
              .replace(/\\/g, '/');
            
            violations.push({
              file: relativePath,
              line: msg.line,
              column: msg.column,
              message: msg.message,
              severity: msg.severity === 2 ? 'error' : 'warning',
            });
            filesWithViolations.add(relativePath);
          });
        });
        
        return {
          success: true,
          totalFiles,
          totalViolations: violations.length,
          filesWithViolations: filesWithViolations.size,
          violations,
        };
      }
    } catch (parseErr) {
      // 忽略解析错误
    }
    
    return {
      success: false,
      error: err.message,
      totalFiles: 0,
      totalViolations: 0,
      filesWithViolations: 0,
      violations: [],
    };
  }
}

/**
 * 生成修复建议
 */
function generateFixSuggestions(violations) {
  const suggestions = [];
  
  violations.forEach(v => {
    // 提取方法名
    const methodMatch = v.message.match(/async action "(\w+)"/);
    const methodName = methodMatch ? methodMatch[1] : 'unknown';
    
    suggestions.push({
      file: v.file,
      line: v.line,
      methodName,
      fixTemplate: `
// 1. 在 State 接口中添加（如不存在）：
//    isRefreshing: boolean

// 2. 在 initialState 中添加（如不存在）：
//    isRefreshing: false

// 3. 在 create 函数中确保 get 参数：
//    create<State>((set, get) => ({...}))

// 4. 在 ${methodName}() 方法首行添加防重入检查：
//    if (get().isRefreshing) { return }
//    set({ isRefreshing: true })

// 5. 在成功/失败路径重置：
//    set({ isRefreshing: false })
      `.trim(),
    });
  });
  
  return suggestions;
}

/**
 * 运行代码审计（辅助检查，补充 ESLint 未覆盖的场景）
 */
function runCodeAudit() {
  logger.info('运行代码审计（辅助检查）...');
  
  const storeDir = path.join(process.cwd(), 'src', 'store');
  
  if (!fs.existsSync(storeDir)) {
    logger.warn('Store 目录不存在，跳过代码审计');
    return { checkedFiles: 0, potentialIssues: [] };
  }
  
  const files = fs.readdirSync(storeDir).filter(f => {
    if (!f.endsWith('.ts')) return false;
    if (f.startsWith('__')) return false;
    if (f.endsWith('.test.ts')) return false;
    return CONFIG.exemptFiles.some(exempt => !f.includes(exempt));
  });
  
  const potentialIssues = [];
  
  files.forEach(file => {
    const filePath = path.join(storeDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = `src/store/${file}`;
    
    // 检查是否包含 async 方法
    const asyncMethodRegex = /(\w+):\s*async\s*\(\)[^{]*\{/g;
    let match;
    
    while ((match = asyncMethodRegex.exec(content)) !== null) {
      const methodName = match[1];
      
      // 只检查符合命名模式的方法
      if (!CONFIG.asyncMethodPattern.test(methodName)) continue;
      if (methodName.startsWith('_')) continue;
      
      // 提取方法体前 500 字符
      const methodStart = match.index;
      const methodBody = content.slice(methodStart, methodStart + 500);
      
      // 检查是否包含防重入模式
      const hasProtection = CONFIG.protectionPatterns.some(pattern => 
        pattern.patterns.some(p => methodBody.includes(p))
      );
      
      if (!hasProtection) {
        const lineNumber = content.slice(0, methodStart).split('\n').length;
        potentialIssues.push({
          file: relativePath,
          line: lineNumber,
          method: methodName,
          issue: `方法 ${methodName}() 可能缺少防重入检查`,
        });
      }
    }
  });
  
  return {
    checkedFiles: files.length,
    potentialIssues,
  };
}

/**
 * 生成报告
 */
function generateReport(eslintResult, auditResult, showFixSuggestions) {
  const timestamp = new Date().toISOString();
  
  // 确保报告目录存在
  const reportDir = path.join(process.cwd(), CONFIG.reportDir);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const report = {
    reportType: 'V9 Store Concurrency Safety Audit',
    timestamp,
    summary: {
      totalFilesScanned: eslintResult.totalFiles,
      eslintViolations: eslintResult.totalViolations,
      filesWithViolations: eslintResult.filesWithViolations,
      auditFilesChecked: auditResult.checkedFiles,
      auditPotentialIssues: auditResult.potentialIssues.length,
      overallStatus: eslintResult.totalViolations === 0 ? 'PASS' : 'FAIL',
    },
    eslint: {
      success: eslintResult.success,
      violations: eslintResult.violations,
    },
    audit: {
      potentialIssues: auditResult.potentialIssues,
    },
    fixSuggestions: showFixSuggestions ? generateFixSuggestions(eslintResult.violations) : [],
  };
  
  // 保存 JSON 报告
  const reportPath = path.join(reportDir, 'store-concurrency-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  return report;
}

/**
 * 打印报告
 */
function printReport(report) {
  console.log('');
  console.log(`${COLORS.bold}${COLORS.cyan}╔══════════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}║       V9 Store 并发安全审计报告                                     ║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}╚══════════════════════════════════════════════════════════════════════════╝${COLORS.reset}`);
  console.log('');
  console.log(`${COLORS.bold}📅 审计时间:${COLORS.reset} ${report.timestamp}`);
  console.log('');
  
  // 总体状态
  const statusColor = report.summary.overallStatus === 'PASS' ? COLORS.green : COLORS.red;
  const statusIcon = report.summary.overallStatus === 'PASS' ? '✅' : '❌';
  
  console.log(`${COLORS.bold}📊 总体状态:${COLORS.reset} ${statusColor}${statusIcon} ${report.summary.overallStatus}${COLORS.reset}`);
  console.log('');
  
  // 统计详情
  console.log(`${COLORS.bold}📈 统计详情:${COLORS.reset}`);
  console.log(`   - ESLint 扫描文件数: ${report.summary.totalFilesScanned}`);
  console.log(`   - ESLint 违规数: ${report.summary.eslintViolations}`);
  console.log(`   - 涉及违规文件数: ${report.summary.filesWithViolations}`);
  console.log(`   - 代码审计检查文件数: ${report.summary.auditFilesChecked}`);
  console.log(`   - 潜在问题数: ${report.summary.auditPotentialIssues}`);
  console.log('');
  
  // ESLint 违规详情
  if (report.eslint.violations.length > 0) {
    logger.error('ESLint 违规详情:');
    console.log('');
    report.eslint.violations.forEach(v => {
      console.log(`   ${COLORS.red}❌${COLORS.reset} ${v.file}:${v.line}`);
      console.log(`      ${v.message}`);
      console.log('');
    });
  } else {
    logger.success('ESLint 检查: 所有文件通过！');
    console.log('');
  }
  
  // 代码审计潜在问题
  if (report.audit.potentialIssues.length > 0) {
    logger.warn('代码审计发现的潜在问题:');
    console.log('');
    report.audit.potentialIssues.forEach(issue => {
      console.log(`   ${COLORS.yellow}⚠️${COLORS.reset} ${issue.file}:${issue.line}`);
      console.log(`      ${issue.issue}`);
      console.log('');
    });
    console.log(`${COLORS.yellow}   注意: 这些可能是 ESLint 规则未覆盖的场景，建议人工复核。${COLORS.reset}`);
  }
  
  // 修复建议
  if (report.fixSuggestions && report.fixSuggestions.length > 0) {
    console.log(`${COLORS.bold}🔧 修复建议:${COLORS.reset}`);
    console.log('');
    report.fixSuggestions.forEach(suggestion => {
      console.log(`${COLORS.bold}   文件: ${suggestion.file}${COLORS.reset}`);
      console.log(`   方法: ${suggestion.methodName}()`);
      console.log('');
      console.log(`${COLORS.cyan}   修复模板:${COLORS.reset}`);
      console.log(suggestion.fixTemplate.split('\n').map(l => `   ${l}`).join('\n'));
      console.log('');
    });
  }
  
  // 报告路径
  console.log(`${COLORS.bold}📄 详细报告:${COLORS.reset} outputs/audit/store-concurrency-audit-report.json`);
  console.log('');
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const showFixSuggestions = args.includes('--fix');
  const ciMode = args.includes('--ci');
  
  logger.section('V9 Store 并发安全审计');
  console.log(`${COLORS.bold}规则:${COLORS.reset} ${CONFIG.ruleId}`);
  console.log(`${COLORS.bold}级别:${COLORS.reset} ${COLORS.red}error (P0)${COLORS.reset}`);
  console.log('');
  
  // Step 1: 运行 ESLint 检查
  const eslintResult = runEslintCheck();
  
  if (!eslintResult.success) {
    logger.error(`ESLint 执行失败: ${eslintResult.error}`);
    process.exit(1);
  }
  
  // Step 2: 运行代码审计
  const auditResult = runCodeAudit();
  
  // Step 3: 生成报告
  const report = generateReport(eslintResult, auditResult, showFixSuggestions);
  
  // Step 4: 打印报告
  printReport(report);
  
  // Step 5: 返回退出码
  if (report.summary.overallStatus === 'FAIL') {
    if (ciMode) {
      logger.error('CI 模式：检测到违规，退出码 1');
      process.exit(1);
    } else {
      logger.warn('检测到违规（非 CI 模式），请查看报告进行修复');
      process.exit(0);
    }
  } else {
    logger.success('🎉 所有检查通过！Store 并发安全合规！');
    process.exit(0);
  }
}

main();
