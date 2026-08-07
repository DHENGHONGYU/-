#!/usr/bin/env node
/**
 * CI 自动化回归测试脚本 — pre-push 钩子 scope 校验
 *
 * 在 CI 流水线中运行，模拟多种提交场景，验证 pre-push 钩子的拦截效果。
 *
 * 运行方式:
 *   node scripts/audit/ci-pre-push-regression.mjs
 *
 * CI 集成 (GitHub Actions):
 *   - name: Pre-push hook regression
 *     run: node scripts/audit/ci-pre-push-regression.mjs
 *
 * 退出码:
 *   0 = 全部通过
 *   1 = 有失败用例
 */

import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ── 配置 ──
const HUSKY_PRE_PUSH = join(process.cwd(), '.husky', 'pre-push');
const HUSKY_SCOPE_REGEX = join(process.cwd(), '.husky', 'scope-regex.sh');

// 检测 sh 可执行文件路径（Windows 使用 Git Bash 的 sh.exe，Linux/Mac 使用 sh）
function detectShBin() {
  if (process.env.SH_BIN) return process.env.SH_BIN;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\bin\\sh.exe',
      'C:\\Program Files (x86)\\Git\\bin\\sh.exe',
    ];
    for (const c of candidates) {
      try {
        spawnSync(c, ['--version'], { encoding: 'utf-8', stdio: 'pipe', timeout: 3000, maxBuffer: 10 * 1024 * 1024, windowsHide: true });
        return c;
      } catch {
        // 尝试下一个候选
      }
    }
  }
  return 'sh';
}
const SH_BIN = detectShBin();

// ── 工具函数 ──
const PASS = 0;
const BLOCK = 1;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

/**
 * 创建临时 commit 对象（不影响分支历史）
 */
function createCommit(message, parent = null) {
  // 使用 SH_BIN 执行，避免 PowerShell 吞掉 ^ 字符
  const tree = (spawnSync('git', ['rev-parse', 'HEAD^{tree}'], {
    encoding: 'utf-8', shell: SH_BIN, maxBuffer: 10 * 1024 * 1024, timeout: 15000, windowsHide: true,
  }).stdout || '').trim();
  const parentArg = parent ? `-p ${parent}` : '';
  const escapedMsg = message.replace(/'/g, "'\\''");
  const sha = (spawnSync('git', ['commit-tree', tree, ...(parentArg ? [parentArg.split(' ')[0], parentArg.split(' ')[1], '-m', escapedMsg.replace(/^'|'$/g, '')] : ['-m', escapedMsg.replace(/^'|'$/g, '')])], {
    encoding: 'utf-8', shell: SH_BIN, maxBuffer: 10 * 1024 * 1024, timeout: 15000, windowsHide: true,
  }).stdout || '').trim();
  return sha;
}

/**
 * 模拟 pre-push 钩子执行
 * @param {string} localSha - 本端 SHA
 * @param {string} remoteSha - 远端 SHA
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
function runPrePush(localSha, remoteSha) {
  const zero = '0'.repeat(40);
  const stdin = `refs/heads/test ${localSha} refs/heads/test ${remoteSha}\n`;

  // 通过 sh.exe 执行 pre-push，模拟 git push 的 stdin 输入
  const result = spawnSync(SH_BIN, [HUSKY_PRE_PUSH, 'test-origin', '/tmp/test.git'], {
    input: stdin,
    encoding: 'utf-8',
    timeout: 30000,
    cwd: process.cwd(),
  });

  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * 只运行 scope 校验段（跳过后续的 skill-router / 测试 / 构建）
 * 关键修复：
 *   1. 在 scope 校验段前显式 source .husky/scope-regex.sh（绝对路径，不因 CWD 改变失效）
 *   2. 先 set +eu 避免 scope-regex.sh 自带 set -eu 中 nounset(-u) 把仿真未初始化变量当错误
 *   3. 日志函数 + scope 校验段严格按顺序，确保 validate_scope 函数在调用前已定义
 */
function runScopeCheckOnly(localSha, remoteSha) {
  if (!existsSync(HUSKY_SCOPE_REGEX)) {
    throw new Error(`scope-regex.sh 不存在: ${HUSKY_SCOPE_REGEX}`);
  }
  // 读取 pre-push 脚本，提取 scope 校验段
  const script = readFileSync(HUSKY_PRE_PUSH, 'utf-8');

  // 提取从 "SCOPE_VIOLATIONS=0" 到 "Scope 校验通过" 的代码段
  const scopeStart = script.indexOf('SCOPE_VIOLATIONS=0');
  const scopeEnd = script.indexOf("echo \"✅ [0/6] Commit Message Scope 校验通过");
  if (scopeStart === -1 || scopeEnd === -1) {
    throw new Error('无法从 pre-push 脚本中提取 scope 校验段');
  }
  const scopeSection = script.substring(scopeStart, scopeEnd + 120);

  // 将 scope-regex.sh 的路径转成 shell 安全字符串（简单转义单引号）
  const scopeRegexSh = HUSKY_SCOPE_REGEX.replace(/'/g, "'\\''");

  // 构建独立测试脚本：环境自举 → scope-regex → 日志函数 → scope 校验执行段
  const testScript = `#!/bin/sh
# ========== 测试环境自举 ==========
# Step 1: 先关闭 -eu，防止 scope-regex.sh 自带 set -eu 中 nounset(-u) 误杀仿真环境变量
set +eu
# Step 2: 显式 source scope-regex.sh（绝对路径，用绝对路径避免 CWD 影响）
if [ -f '${scopeRegexSh}' ]; then
  . '${scopeRegexSh}' 2>/tmp/scope-source.err || {
    echo "ERROR: source scope-regex.sh 失败" >&2
    cat /tmp/scope-source.err >&2
    exit 2
  }
else
  echo "ERROR: scope-regex.sh 不存在: ${scopeRegexSh}" >&2
  exit 2
fi
# Step 3: 只恢复 errexit(-e)，保持 nounset(-u) 关闭以兼容仿真脚本
set -e
# ========== 日志函数（与 pre-push 保持一致） ==========
PREPUSH_LOG_DIR=".tmp/logs"
PREPUSH_LOG_FILE="\${PREPUSH_LOG_DIR}/pre-push.log"
_prepush_log() { _level="\$1"; _msg="\$2"; _ts=\$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S'); mkdir -p "\$PREPUSH_LOG_DIR" 2>/dev/null || true; printf '[%s] [%s] %s\\n' "\$_ts" "\$_level" "\$_msg" >> "\$PREPUSH_LOG_FILE" 2>/dev/null || true; }
log_info()  { _prepush_log "INFO"  "\$1"; }
log_warn()  { _prepush_log "WARN"  "\$1"; }
log_error() { _prepush_log "ERROR" "\$1"; }
log_info "===== pre-push 钩子 scope 仿真启动 ====="
# ========== scope 校验执行段（从 pre-push 原始脚本中提取） ==========
${scopeSection}
`;

  const zero = '0'.repeat(40);
  const stdin = `refs/heads/test ${localSha} refs/heads/test ${remoteSha}\n`;

  const result = spawnSync(SH_BIN, ['-c', testScript], {
    input: stdin,
    encoding: 'utf-8',
    timeout: 15000,
    cwd: process.cwd(),
  });

  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * 断言：推送应被拦截
 */
function assertBlocked(result, testName) {
  totalTests++;
  const output = result.stdout + result.stderr;
  const hasScopeError = output.includes('Scope 校验失败') || output.includes('不合规提交');

  if (result.exitCode !== BLOCK || !hasScopeError) {
    failedTests++;
    failures.push({
      name: testName,
      expected: 'BLOCKED (exit 1, scope error)',
      actual: `exit=${result.exitCode}, hasScopeError=${hasScopeError}`,
      output: output.slice(0, 500),
    });
    console.log(`  ❌ FAIL  ${testName}`);
    console.log(`     预期: exit=1, scope error`);
    console.log(`     实际: exit=${result.exitCode}, hasScopeError=${hasScopeError}`);
  } else {
    passedTests++;
    console.log(`  ✅ PASS  ${testName} (拦截成功)`);
  }
}

/**
 * 断言：推送应通过 scope 校验
 */
function assertScopePassed(result, testName) {
  totalTests++;
  const output = result.stdout + result.stderr;
  const hasScopePass = output.includes('Scope 校验通过') || output.includes('无内部编号泄漏');

  if (!hasScopePass) {
    failedTests++;
    failures.push({
      name: testName,
      expected: 'PASSED scope check',
      actual: `exit=${result.exitCode}, hasScopePass=${hasScopePass}`,
      output: output.slice(0, 500),
    });
    console.log(`  ❌ FAIL  ${testName}`);
    console.log(`     预期: scope 校验通过`);
    console.log(`     实际: exit=${result.exitCode}, hasScopePass=${hasScopePass}`);
  } else {
    passedTests++;
    console.log(`  ✅ PASS  ${testName} (scope 通过)`);
  }
}

// ── 测试用例定义 ──

const ZERO = '0'.repeat(40);

// 场景 1: 正常提交（合规 scope）
const testCases = [
  {
    name: '正常提交 — fix(FIN-P0) 合规 scope',
    purpose: '验证合规 Jira Key scope 不被误拦截',
    commit: 'fix(FIN-P0): 修复 P0 级别的问题',
    localSha: null, // 运行时创建
    remoteSha: ZERO,
    expected: 'PASS',
    assert: assertScopePassed,
  },
  {
    name: '正常提交 — feat(auth) 功能模块 scope',
    purpose: '验证功能模块名作为 scope 通过',
    commit: 'feat(auth): 新增用户认证模块',
    localSha: null,
    remoteSha: ZERO,
    expected: 'PASS',
    assert: assertScopePassed,
  },
  {
    name: '正常提交 — 无 scope 的非 conventional commit',
    purpose: '验证非 conventional 格式不触发 scope 校验',
    commit: 'update README documentation',
    localSha: null,
    remoteSha: ZERO,
    expected: 'PASS',
    assert: assertScopePassed,
  },
  {
    name: '正常提交 — chore(scope) 无内部编号',
    purpose: '验证常规 scope 通过',
    commit: 'chore(deps): 升级依赖版本',
    localSha: null,
    remoteSha: ZERO,
    expected: 'PASS',
    assert: assertScopePassed,
  },
  {
    name: '正常提交 — feat(app0) 不误匹配',
    purpose: '验证 app0 中 p 前有字母不匹配',
    commit: 'feat(app0): 应用层零依赖初始化',
    localSha: null,
    remoteSha: ZERO,
    expected: 'PASS',
    assert: assertScopePassed,
  },
  {
    name: '正常提交 — fix(FIN-P1-2) Jira 子任务编号不误匹配',
    purpose: '验证 FIN-P1-2 中 P 前有连字符不匹配',
    commit: 'fix(FIN-P1-2): 修复子任务编号问题',
    localSha: null,
    remoteSha: ZERO,
    expected: 'PASS',
    assert: assertScopePassed,
  },

  // ── 不合规 scope 场景 ──
  {
    name: '不合规提交 — fix(p0) 小写裸编号',
    purpose: '验证 p0 被正则匹配并拦截',
    commit: 'fix(p0): 使用内部编号作为 scope',
    localSha: null,
    remoteSha: ZERO,
    expected: 'BLOCK',
    assert: assertBlocked,
  },
  {
    name: '不合规提交 — feat(P0) 大写裸编号',
    purpose: '验证 P0 被正则匹配并拦截（不区分大小写）',
    commit: 'feat(P0): 大写内部编号',
    localSha: null,
    remoteSha: ZERO,
    expected: 'BLOCK',
    assert: assertBlocked,
  },
  {
    name: '不合规提交 — fix(p1-2) 子任务编号',
    purpose: '验证 p1-2 格式被正则匹配并拦截',
    commit: 'fix(p1-2): 子任务编号作为 scope',
    localSha: null,
    remoteSha: ZERO,
    expected: 'BLOCK',
    assert: assertBlocked,
  },
  {
    name: '不合规提交 — feat(P3) 大写 P3',
    purpose: '验证 P3 被拦截',
    commit: 'feat(P3): 使用 P3 内部编号',
    localSha: null,
    remoteSha: ZERO,
    expected: 'BLOCK',
    assert: assertBlocked,
  },
  {
    name: '不合规提交 — fix(p6) 最大编号',
    purpose: '验证 p6（编号上限）被拦截',
    commit: 'fix(p6): 使用 p6 编号',
    localSha: null,
    remoteSha: ZERO,
    expected: 'BLOCK',
    assert: assertBlocked,
  },
  {
    name: '不合规提交 — docs(p2) 文档类不合规 scope',
    purpose: '验证 docs 类型 commit 的 p2 scope 被拦截',
    commit: 'docs(p2): 文档更新使用内部编号',
    localSha: null,
    remoteSha: ZERO,
    expected: 'BLOCK',
    assert: assertBlocked,
  },

  // ── 边界情况 ──
  {
    name: '边界 — 删除分支 (local_sha=0)',
    purpose: '验证删除分支时跳过校验，不报错',
    commit: null,
    localSha: ZERO,
    remoteSha: 'HEAD',
    expected: 'PASS',
    assert: (result, name) => {
      totalTests++;
      const output = result.stdout + result.stderr;
      // 删除分支应跳过 scope 校验（不出现 scope 违规）
      const hasViolation = output.includes('Scope 校验失败') || output.includes('不合规提交');
      if (hasViolation) {
        failedTests++;
        failures.push({ name, expected: 'SKIP (no scope check)', actual: 'scope violation found', output: output.slice(0, 500) });
        console.log(`  ❌ FAIL  ${name}`);
        console.log(`     预期: 跳过校验（删除分支）`);
        console.log(`     实际: 出现 scope 违规`);
      } else {
        passedTests++;
        console.log(`  ✅ PASS  ${name} (跳过校验)`);
      }
    },
  },
  {
    name: '边界 — 无增量推送 (remote==local)',
    purpose: '验证无增量时 rev-list 返回空，循环自动跳过',
    commit: null,
    localSha: 'HEAD',
    remoteSha: 'HEAD',
    expected: 'PASS',
    assert: (result, name) => {
      totalTests++;
      const output = result.stdout + result.stderr;
      const hasScopePass = output.includes('Scope 校验通过') || output.includes('无内部编号泄漏');
      const hasViolation = output.includes('Scope 校验失败');
      if (hasViolation || !hasScopePass) {
        failedTests++;
        failures.push({ name, expected: 'PASS (no increment)', actual: `exit=${result.exitCode}`, output: output.slice(0, 500) });
        console.log(`  ❌ FAIL  ${name}`);
        console.log(`     预期: scope 校验通过（无增量）`);
        console.log(`     实际: exit=${result.exitCode}, pass=${hasScopePass}, violation=${hasViolation}`);
      } else {
        passedTests++;
        console.log(`  ✅ PASS  ${name} (无增量跳过)`);
      }
    },
  },
  {
    name: '边界 — 空远程 SHA (remote="")',
    purpose: '验证空 remote_sha 不导致脚本报错',
    commit: 'fix(FIN-P0): 空远程 SHA 测试',
    localSha: null,
    remoteSha: '',
    expected: 'PASS',
    assert: assertScopePassed,
  },
  {
    name: '边界 — 增量推送包含不合规 child commit',
    purpose: '验证增量推送时正确扫描 child commits',
    commit: 'fix(p0): 增量推送中的不合规 child',
    localSha: null,
    remoteSha: null, // 运行时设为父 commit SHA
    expected: 'BLOCK',
    assert: assertBlocked,
    isIncremental: true,
  },
  {
    name: '边界 — 增量推送全合规 child commits',
    purpose: '验证增量推送时合规 child 通过校验',
    commit: 'fix(FIN-P0): 增量推送中的合规 child',
    localSha: null,
    remoteSha: null,
    expected: 'PASS',
    assert: assertScopePassed,
    isIncremental: true,
  },
  {
    name: '边界 — 多个 commit 混合（合规+不合规）',
    purpose: '验证多个 commit 中有一个不合规即拦截',
    commit: 'fix(p3): 混合提交中的不合规项',
    localSha: null,
    remoteSha: null,
    expected: 'BLOCK',
    assert: assertBlocked,
    isIncremental: true,
    extraCommits: ['feat(FIN-P0): 合规的前置 commit'],
  },
];

// ── 主执行逻辑 ──

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  CI 回归测试 — pre-push 钩子 scope 校验');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  测试环境:`);
console.log(`    Git: ${(spawnSync('git', ['--version'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 10000, windowsHide: true, }).stdout || '').trim()}`);
console.log(`    Node: ${process.version}`);
console.log(`    Shell: ${SH_BIN}`);
console.log(`    平台: ${process.platform} ${process.arch}`);
console.log('');

// 确保 .tmp/logs 目录存在
mkdirSync('.tmp/logs', { recursive: true });

// 执行测试用例
for (const tc of testCases) {
  console.log(`\n▶ ${tc.name}`);
  console.log(`  目的: ${tc.purpose}`);

  let localSha, remoteSha;

  if (tc.localSha === ZERO) {
    // 删除分支场景
    localSha = ZERO;
    remoteSha = tc.remoteSha === 'HEAD' ? (spawnSync('git', ['rev-parse','HEAD'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 10000, windowsHide: true }).stdout || '').trim() : tc.remoteSha;
  } else if (tc.localSha === 'HEAD') {
    // 无增量场景
    const headSha = (spawnSync('git', ['rev-parse','HEAD'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 10000, windowsHide: true }).stdout || '').trim();
    localSha = headSha;
    remoteSha = headSha;
  } else if (tc.isIncremental) {
    // 增量推送场景：创建父 commit + 子 commit
    const parentSha = (spawnSync('git', ['rev-parse','HEAD'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 10000, windowsHide: true }).stdout || '').trim();

    // 创建额外的前置 commits
    let baseParent = parentSha;
    if (tc.extraCommits) {
      for (const msg of tc.extraCommits) {
        baseParent = createCommit(msg, baseParent);
      }
    }

    // 创建目标 commit
    localSha = createCommit(tc.commit, baseParent);
    remoteSha = baseParent; // remote 指向父 commit
  } else {
    // 新分支场景
    localSha = createCommit(tc.commit);
    remoteSha = tc.remoteSha === '' ? '' : (tc.remoteSha === ZERO ? ZERO : tc.remoteSha);
  }

  const result = runScopeCheckOnly(localSha, remoteSha);
  tc.assert(result, tc.name);
}

// ── 测试结果汇总 ──
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  测试结果汇总');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  总用例数: ${totalTests}`);
console.log(`  通过:     ${passedTests} ✅`);
console.log(`  失败:     ${failedTests} ❌`);
console.log(`  通过率:   ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log('');

if (failedTests > 0) {
  console.log('── 失败详情 ──');
  for (const f of failures) {
    console.log(`  ❌ ${f.name}`);
    console.log(`     预期: ${f.expected}`);
    console.log(`     实际: ${f.actual}`);
    if (f.output) {
      console.log(`     输出: ${f.output.slice(0, 200)}`);
    }
    console.log('');
  }
}

console.log('═══════════════════════════════════════════════════════════');
if (failedTests === 0) {
  console.log('  ✅ 全部通过 — pre-push 钩子 scope 校验功能正常');
} else {
  console.log('  ❌ 存在失败用例 — 请检查上方详情');
}
console.log('═══════════════════════════════════════════════════════════');
console.log('');

process.exit(failedTests > 0 ? 1 : 0);
