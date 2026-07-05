#!/usr/bin/env tsx

/**
 * pre-review-check.ts — 代码审查前快速检查脚本
 * 
 * 功能：自动执行所有本地验证命令，生成审查前自检报告
 * 使用：npm run pre-review
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CheckResult {
  name: string;
  command: string;
  passed: boolean;
  output: string;
  duration: number;
}

function runCheck(name: string, command: string): CheckResult {
  const start = Date.now();
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    return {
      name,
      command,
      passed: true,
      output: output.trim(),
      duration: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name,
      command,
      passed: false,
      output: error.stdout || error.message || 'Unknown error',
      duration: Date.now() - start,
    };
  }
}

function main() {
  console.log('🔍 开始代码审查前自检...\n');
  
  const checks: CheckResult[] = [];
  
  // L1: 自动化检查
  console.log('📋 L1: 自动化检查');
  checks.push(runCheck('ESLint', 'npm run lint'));
  checks.push(runCheck('TypeScript', 'npx tsc --noEmit'));
  checks.push(runCheck('单元测试', 'npm test -- --run'));
  
  console.log('\n📊 L2: 架构审计');
  checks.push(runCheck('分层调用', 'npm run audit:layers'));
  checks.push(runCheck('硬编码检查', 'npm run audit:hardcode'));
  checks.push(runCheck('死代码', 'npm run audit:deadcode'));
  checks.push(runCheck('文档同步', 'npm run audit:docs'));
  
  // 生成报告
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;
  const totalDuration = checks.reduce((sum, c) => sum + c.duration, 0);
  
  console.log('\n' + '='.repeat(60));
  console.log('📑 审查前自检报告');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`⏱️  总耗时: ${(totalDuration / 1000).toFixed(2)}s\n`);
  
  checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name} (${(check.duration / 1000).toFixed(2)}s)`);
    if (!check.passed) {
      console.log(`   └── 命令: ${check.command}`);
      console.log(`   └── 输出: ${check.output.split('\n')[0]}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (failed > 0) {
    console.log('❌ 自检失败，请修复问题后重新检查');
    process.exit(1);
  } else {
    console.log('✅ 自检通过，可以提交 PR 进行审查');
    console.log('\n📝 提醒:');
    console.log('  1. 填写 PR 描述模板（docs/CODE-REVIEW.md §4.1）');
    console.log('  2. 自查 Checklist（docs/CODE-REVIEW.md §2）');
    console.log('  3. 指定审查者（至少 1 人，核心模块需 2 人）');
  }
}

main();
