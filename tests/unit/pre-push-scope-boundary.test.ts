/**
 * @test_id V9-TEST-UT-PREPUSH-SCOPE
 * @covers_docs []
 *
 * pre-push 钩子 Scope 校验边界场景单元测试
 *
 * 覆盖 10 个边界场景:
 *   1. 删除分支 (local_sha=0)
 *   2. 空 local_sha
 *   3. 新分支 + 不合规 commit
 *   4. 新分支 + 合规 commit
 *   5. 无增量 (remote==local)
 *   6. 增量不合规 child
 *   7. 增量全合规
 *   8. 空 remote_sha
 *   9. 空 local + remote=0
 *   10. 不合规新分支 + 空 remote
 *
 * 运行方式:
 *   npx vitest run tests/unit/pre-push-scope-boundary.test.ts
 *
 * CI 集成:
 *   npm run test:clean  (已包含在 vitest run 全量中)
 */
import { execSync, spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const PRE_PUSH_PATH = join(process.cwd(), '.husky', 'pre-push')
const SCOPE_REGEX_PATH = join(process.cwd(), '.husky', 'scope-regex.sh')
const ZERO_SHA = '0'.repeat(40)
const TMP_SCRIPT = join(process.cwd(), '.tmp', 'test-scope-check.sh')

// 检测 sh 可执行文件路径（Windows 使用 Git Bash 的 sh.exe，Linux/Mac 使用 sh）
function detectShBin(): string {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\bin\\sh.exe',
      'C:\\Program Files (x86)\\Git\\bin\\sh.exe',
    ]
    for (const c of candidates) {
      try {
        execSync(`"${c}" --version`, { stdio: 'pipe', timeout: 3000 })
        return c
      } catch {
        // 尝试下一个候选
      }
    }
  }
  return 'sh'
}

const SH_BIN = detectShBin()

/**
 * 创建临时 commit 对象（dangling，不影响分支历史）
 */
function createCommit(message: string, parent?: string): string {
  const tree = execSync('git rev-parse "HEAD^{tree}"', {
    encoding: 'utf-8',
    shell: SH_BIN,
  }).trim()
  const parentArg = parent ? `-p ${parent}` : ''
  const escapedMsg = message.replace(/'/g, "'\\''")
  return execSync(`git commit-tree ${tree} ${parentArg} -m '${escapedMsg}'`, {
    encoding: 'utf-8',
    shell: SH_BIN,
  }).trim()
}

/**
 * 从 .husky/pre-push 提取 scope 校验段，构建独立测试脚本
 * (避免触发后续 skill-router / test / build 等重量级步骤)
 */
function buildScopeTestScript(): string {
  const script = readFileSync(PRE_PUSH_PATH, 'utf-8')

  const scopeStart = script.indexOf('SCOPE_VIOLATIONS=0')
  const scopeEndMarker = "echo \"✅ [0/6] Commit Message Scope 校验通过"
  const scopeEnd = script.indexOf(scopeEndMarker)
  if (scopeStart === -1 || scopeEnd === -1) {
    throw new Error('无法从 .husky/pre-push 提取 scope 校验段')
  }

  const logFunc = `
PREPUSH_LOG_DIR=".tmp/logs"
PREPUSH_LOG_FILE="\${PREPUSH_LOG_DIR}/pre-push.log"
_prepush_log() { _level="$1"; _msg="$2"; _ts=$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S'); mkdir -p "$PREPUSH_LOG_DIR" 2>/dev/null || true; printf '[%s] [%s] %s\\n' "$_ts" "$_level" "$_msg" >> "$PREPUSH_LOG_FILE" 2>/dev/null || true; }
log_info()  { _prepush_log "INFO"  "$1"; }
log_warn()  { _prepush_log "WARN"  "$1"; }
log_error() { _prepush_log "ERROR" "$1"; }
`

  // 提取到 echo "✅ ... 通过" 行末尾（包含完整的 echo 语句）
  const lineEnd = script.indexOf('\n', scopeEnd)
  const scopeSection = script.substring(scopeStart, lineEnd === -1 ? scopeEnd + 100 : lineEnd + 1)

  return `#!/bin/sh\nset -e\n. "${SCOPE_REGEX_PATH}"\n${logFunc}\n${scopeSection}\n`
}

const SCOPE_TEST_SCRIPT = buildScopeTestScript()

// 将测试脚本写入临时文件（避免 sh -c 双引号冲突）
mkdirSync('.tmp', { recursive: true })
writeFileSync(TMP_SCRIPT, SCOPE_TEST_SCRIPT, 'utf-8')

/**
 * 执行 scope 校验，返回退出码和输出
 */
function runScopeCheck(localSha: string, remoteSha: string): {
  exitCode: number
  stdout: string
  stderr: string
} {
  const stdin = `refs/heads/test ${localSha} refs/heads/test ${remoteSha}\n`
  const result = spawnSync(SH_BIN, [TMP_SCRIPT], {
    input: stdin,
    encoding: 'utf-8',
    timeout: 10000,
    cwd: process.cwd(),
  })
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

// ── 测试数据 ──
const testData = {
  badSha: '',   // fix(p0): 不合规
  goodSha: '',  // fix(FIN-P0): 合规
  badChild: '', // fix(p1-2): 子任务不合规
  goodChild: '',// feat(FIN-P1-2): 合规子任务
  headSha: '',  // 当前 HEAD
}

beforeAll(() => {
  testData.headSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  testData.badSha = createCommit('fix(p0): 不合规 scope 提交')
  testData.goodSha = createCommit('fix(FIN-P0): 合规 Jira Key scope')
  testData.badChild = createCommit('fix(p1-2): 子任务不合规', testData.goodSha)
  testData.goodChild = createCommit('feat(FIN-P1-2): 新功能子任务', testData.goodSha)
})

describe('pre-push 钩子 Scope 校验边界场景', () => {
  describe('删除分支场景', () => {
    it('场景 1: 删除分支 (local_sha=0) 应跳过校验', () => {
      const result = runScopeCheck(ZERO_SHA, testData.headSha)
      const output = result.stdout + result.stderr
      expect(output).not.toContain('Scope 校验失败')
      expect(output).not.toContain('不合规提交')
    })

    it('场景 2: 空 local_sha 应跳过校验', () => {
      const result = runScopeCheck('', testData.headSha)
      const output = result.stdout + result.stderr
      expect(output).not.toContain('Scope 校验失败')
      expect(output).not.toContain('不合规提交')
    })
  })

  describe('新分支首次推送场景', () => {
    it('场景 3: 新分支 + 不合规 commit (fix(p0)) 应被拦截', () => {
      const result = runScopeCheck(testData.badSha, ZERO_SHA)
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验失败')
      expect(output).toContain('不合规提交')
      expect(output).toContain('p0')
    })

    it('场景 4: 新分支 + 合规 commit (fix(FIN-P0)) 应通过', () => {
      const result = runScopeCheck(testData.goodSha, ZERO_SHA)
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验通过')
    })
  })

  describe('无增量推送场景', () => {
    it('场景 5: 无增量 (remote==local) 应通过', () => {
      const result = runScopeCheck(testData.headSha, testData.headSha)
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验通过')
    })
  })

  describe('增量推送场景', () => {
    it('场景 6: 增量推送包含不合规 child (fix(p1-2)) 应被拦截', () => {
      const result = runScopeCheck(testData.badChild, testData.goodSha)
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验失败')
      expect(output).toContain('p1-2')
    })

    it('场景 7: 增量推送全合规 child (feat(FIN-P1-2)) 应通过', () => {
      const result = runScopeCheck(testData.goodChild, testData.goodSha)
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验通过')
    })
  })

  describe('空 remote_sha 场景', () => {
    it('场景 8: 空 remote_sha + 合规 commit 应通过', () => {
      const result = runScopeCheck(testData.goodSha, '')
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验通过')
    })

    it('场景 9: 空 local + remote=0 应跳过校验', () => {
      const result = runScopeCheck('', ZERO_SHA)
      const output = result.stdout + result.stderr
      expect(output).not.toContain('Scope 校验失败')
    })

    it('场景 10: 空 remote_sha + 不合规 commit (fix(p0)) 应被拦截', () => {
      const result = runScopeCheck(testData.badSha, '')
      const output = result.stdout + result.stderr
      expect(output).toContain('Scope 校验失败')
      expect(output).toContain('p0')
    })
  })
})
