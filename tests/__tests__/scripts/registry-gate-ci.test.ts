/**
 * registry-gate CI Alert — 单元测试
 *
 * 验证 ci.yml 中 registry-gate job 的「Alert on PR failure」step 的：
 *   1. 评论去重逻辑（tag 匹配 → updateComment vs createComment）
 *   2. 失败告警触发条件（failures/warnings 内容渲染）
 *   3. 边界容错（空 failures / JSON 解析失败）
 *
 * 原理：从 .github/workflows/ci.yml 提取 github-script 内联 JS 代码 →
 *   用 new Function() 包装为可执行函数 → 注入 mock github/context/core →
 *   断言 API 调用次数和参数。
 *
 * 运行：
 *   npx vitest run tests/__tests__/scripts/registry-gate-ci.test.ts \
 *     --pool=forks --poolOptions.forks.singleFork=true
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const CI_YML = path.resolve('.github/workflows/ci.yml')

// ═══════════════════════════════════════════════════════════════
//  工具函数：从 ci.yml 提取 Alert 脚本 + 构建可执行 runner
// ═══════════════════════════════════════════════════════════════

/** 从 ci.yml 的 registry-gate job 中提取「Alert on PR failure」step 的内联 script */
function extractAlertScript(): string {
  const ci = fs.readFileSync(CI_YML, 'utf8')
  // 匹配 script: | 后的代码块，直到下一个 step（6空格+dash）或下一个 job（2空格+字母）
  const m = ci.match(/script: \|\n([\s\S]*?)(?=\n      - |\n  [a-z])/)
  if (!m) throw new Error('❌ 未在 ci.yml 中找到 Alert on PR failure 的 script 块')
  // 去除 YAML 12 空格缩进
  return m[1].replace(/^ {12}/gm, '').trim()
}

/** 去除 require('fs') / require('path') — 这些由测试参数注入 */
function stripRequires(script: string): string {
  return script
    .replace(/^const fs = require\(['"]fs['"]\);\n?/m, '')
    .replace(/^const path = require\(['"]path['"]\);\n?/m, '')
}

/** 把脚本字符串包装为 async 可执行函数 */
function makeRunner(scriptBody: string) {
  const code = `return (async () => {\n${scriptBody}\n})()`
  return new Function(
    'github', 'context', 'core', 'fs', 'path', 'process', code
  ) as (g: any, c: any, co: any, f: any, p: any, pr: any) => Promise<void>
}

// ═══════════════════════════════════════════════════════════════
//  Mock 对象
// ═══════════════════════════════════════════════════════════════

function makeMockGithub(existingComments: any[] = []) {
  const calls = {
    listComments: vi.fn().mockResolvedValue({ data: existingComments }),
    updateComment: vi.fn().mockResolvedValue({}),
    createComment: vi.fn().mockResolvedValue({}),
  }
  return { rest: { issues: calls }, _calls: calls }
}

function makeMockContext(sha = 'abcdef1234567890', number = 42) {
  return {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number },
    sha,
  }
}

function makeMockCore() {
  return { info: vi.fn() }
}

// ═══════════════════════════════════════════════════════════════
//  测试辅助：运行 Alert 脚本并返回 mock 对象
// ═══════════════════════════════════════════════════════════════

async function runAlert(opts: {
  reportJson?: object | string
  existingComments?: any[]
  sha?: string
}) {
  const script = stripRequires(extractAlertScript())
  const runner = makeRunner(script)

  const github = makeMockGithub(opts.existingComments || [])
  const context = makeMockContext(opts.sha)
  const core = makeMockCore()

  // 准备临时 workspace + 写 mock report JSON
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-gate-test-'))
  const reportDir = path.join(tmpDir, 'outputs')
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'registry-regression.json')
  if (typeof opts.reportJson === 'string') {
    fs.writeFileSync(reportPath, opts.reportJson)
  } else if (opts.reportJson) {
    fs.writeFileSync(reportPath, JSON.stringify(opts.reportJson))
  }

  const origWs = process.env.GITHUB_WORKSPACE
  process.env.GITHUB_WORKSPACE = tmpDir
  await runner(github, context, core, fs, path, process)
  process.env.GITHUB_WORKSPACE = origWs

  // 清理临时目录
  fs.rmSync(tmpDir, { recursive: true, force: true })
  return { github, context, core }
}

afterEach(() => {
  delete process.env.GITHUB_WORKSPACE
})

// ═══════════════════════════════════════════════════════════════
//  测试用例
// ═══════════════════════════════════════════════════════════════

describe('registry-gate CI Alert — 评论去重 & 失败告警', () => {

  // ─── SCENARIO 1: 首次失败推送 — 无旧评论 → createComment ───
  describe('SCENARIO 1: 首次失败推送 — 无旧评论', () => {
    it('createComment 调用 1 次，updateComment 不调用', async () => {
      const { github } = await runAlert({
        reportJson: { failures: ['test failure'], warnings: [], allPassed: false },
      })
      expect(github._calls.createComment).toHaveBeenCalledTimes(1)
      expect(github._calls.updateComment).not.toHaveBeenCalled()
    })

    it('评论 body 包含幂等 tag <!-- registry-gate-report-tag:v1 -->', async () => {
      const { github } = await runAlert({
        reportJson: { failures: ['x'], warnings: [], allPassed: false },
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).toContain('<!-- registry-gate-report-tag:v1 -->')
    })

    it('createComment 参数包含正确的 owner/repo/issue_number', async () => {
      const { github } = await runAlert({
        reportJson: { failures: ['x'], warnings: [], allPassed: false },
      })
      const params = github._calls.createComment.mock.calls[0][0]
      expect(params.owner).toBe('test-owner')
      expect(params.repo).toBe('test-repo')
      expect(params.issue_number).toBe(42)
    })
  })

  // ─── SCENARIO 2: 重复推送 — 有 tag 匹配的旧评论 → updateComment（去重）───
  describe('SCENARIO 2: 重复推送 — 幂等去重', () => {
    it('有 tag 匹配的 Bot 旧评论 → updateComment 覆盖，createComment 不调用', async () => {
      const oldComment = {
        id: 999,
        body: '<!-- registry-gate-report-tag:v1 -->\n旧内容',
        user: { type: 'Bot', login: 'github-actions[bot]' },
      }
      const { github } = await runAlert({
        reportJson: { failures: ['new failure'], warnings: [], allPassed: false },
        existingComments: [oldComment],
      })
      expect(github._calls.updateComment).toHaveBeenCalledWith(
        expect.objectContaining({ comment_id: 999 })
      )
      expect(github._calls.createComment).not.toHaveBeenCalled()
    })

    it('updateComment 的 body 仍含 tag（保持幂等链不断裂）', async () => {
      const oldComment = {
        id: 777,
        body: '<!-- registry-gate-report-tag:v1 -->\n旧',
        user: { type: 'Bot', login: 'github-actions[bot]' },
      }
      const { github } = await runAlert({
        reportJson: { failures: ['y'], warnings: [], allPassed: false },
        existingComments: [oldComment],
      })
      const body = github._calls.updateComment.mock.calls[0][0].body
      expect(body).toContain('<!-- registry-gate-report-tag:v1 -->')
    })

    it('非 Bot 的旧评论（User 类型）不触发 update → 走 createComment', async () => {
      const humanComment = {
        id: 555,
        body: '<!-- registry-gate-report-tag:v1 -->\n人类评论',
        user: { type: 'User', login: 'human-user' },
      }
      const { github } = await runAlert({
        reportJson: { failures: ['z'], warnings: [], allPassed: false },
        existingComments: [humanComment],
      })
      expect(github._calls.createComment).toHaveBeenCalledTimes(1)
      expect(github._calls.updateComment).not.toHaveBeenCalled()
    })

    it('多条旧评论中只有一条 tag 匹配 → 只 update 那一条', async () => {
      const comments = [
        { id: 100, body: '无关评论', user: { type: 'User', login: 'user1' } },
        { id: 200, body: '<!-- registry-gate-report-tag:v1 -->\n旧警报', user: { type: 'Bot', login: 'github-actions[bot]' } },
        { id: 300, body: '另一条无关评论', user: { type: 'User', login: 'user2' } },
      ]
      const { github } = await runAlert({
        reportJson: { failures: ['x'], warnings: [], allPassed: false },
        existingComments: comments,
      })
      expect(github._calls.updateComment).toHaveBeenCalledWith(
        expect.objectContaining({ comment_id: 200 })
      )
      expect(github._calls.createComment).not.toHaveBeenCalled()
    })
  })

  // ─── SCENARIO 3: 失败告警内容渲染 ───
  describe('SCENARIO 3: 失败告警内容渲染', () => {
    it('failures 正确渲染为 ⛔ 列表 + 计数', async () => {
      const { github } = await runAlert({
        reportJson: {
          failures: ['PortfolioService id 重名', 'SkeletonLegacy 缺字段'],
          warnings: [],
          allPassed: false,
        },
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).toContain('阻塞级回归（2 条）')
      expect(body).toContain('⛔ `PortfolioService id 重名`')
      expect(body).toContain('⛔ `SkeletonLegacy 缺字段`')
    })

    it('warnings 正确渲染为 ⚠️ 列表', async () => {
      const { github } = await runAlert({
        reportJson: { failures: [], warnings: ['minor issue'], allPassed: false },
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).toContain('非阻塞警告（1 条）')
      expect(body).toContain('⚠️ `minor issue`')
    })

    it('条目数快照表渲染（含 counts + baseline）', async () => {
      const { github } = await runAlert({
        reportJson: {
          failures: ['x'],
          warnings: [],
          allPassed: false,
          counts: { storeEntries: 64, serviceEntries: 62, componentEntries: 166 },
          baseline: { componentSubRegistries: 4 },
        },
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).toContain('条目数快照')
      expect(body).toContain('| 64 | 62 | 166 | 4 |')
    })

    it('评论包含 commit SHA（前 8 位）', async () => {
      const { github } = await runAlert({
        reportJson: { failures: ['x'], warnings: [], allPassed: false },
        sha: '0123456789abcdef',
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).toContain('`01234567`')
    })

    it('failures 中的反引号被替换为单引号（防 Markdown 注入）', async () => {
      const { github } = await runAlert({
        reportJson: {
          failures: ['含 `反引号` 的 failure'],
          warnings: [],
          allPassed: false,
        },
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).not.toContain('`反引号`')
      expect(body).toContain("'反引号'")
    })
  })

  // ─── SCENARIO 4: 边界 — 空 failures ───
  describe('SCENARIO 4: 边界 — 空 failures', () => {
    it('failures=[] → 显示 阻塞级回归（0 条）+ _(空)_', async () => {
      const { github } = await runAlert({
        reportJson: { failures: [], warnings: [], allPassed: false },
      })
      const body = github._calls.createComment.mock.calls[0][0].body
      expect(body).toContain('阻塞级回归（0 条）')
      expect(body).toContain('_(空)_')
    })
  })

  // ─── SCENARIO 5: 容错 — JSON 解析失败 ───
  describe('SCENARIO 5: 容错 — JSON 解析失败', () => {
    it('报告文件损坏 → 评论仍能发出（使用默认空值）', async () => {
      const { github } = await runAlert({
        reportJson: 'NOT VALID JSON {{{',
      })
      expect(github._calls.createComment).toHaveBeenCalledTimes(1)
      const body = github._calls.createComment.mock.calls[0][0].body
      // 默认初始化 { failures: [], warnings: [], allPassed: false }
      expect(body).toContain('阻塞级回归（0 条）')
    })
  })
})
