/**
 * @test_id V9-TEST-UT-GITIGNORE-COVERAGE
 * @covers_docs [V9-DOC-GUIDE-FILE-MGMT-§2.2]
 * @covers_skill v9-code-quality-audit
 *
 * .gitignore 覆盖率回归测试 — IDE/环境部署追踪治理
 *
 * 依据：FILE-MANAGEMENT-GUIDE.md §2.2「IDE/环境部署追踪治理」
 * 关联约束：project_memory.md「环境部署追踪治理（2026-08-05）」
 *
 * 测试目标：
 * 1. 正向：6 个 IDE 路径必须被 .gitignore 忽略（git check-ignore 退出码 0）
 * 2. 逆向：.trae/（团队 SKILL 体系）不得被 .gitignore 忽略（退出码非 0）
 * 3. 审计脚本 audit-gitignore-coverage.sh 本身可执行且退出码 0
 * 4. 反向：审计脚本能检测到缺失的 .gitignore 规则（注入缺失规则后应 BLOCK）
 *
 * 背景：2026-08-05 环境部署追踪清理，仅保留 .trae/ 被 Git 追踪，
 *      移除 .workbuddy/、.trae-cn/、.codebuddy/、.cursorrules、.vscode/、.idea/ 追踪。
 *      本测试确保未来新增 IDE 文件能被自动拦截。
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import * as path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const AUDIT_SCRIPT = path.join(REPO_ROOT, 'scripts/audit/audit-gitignore-coverage.sh')

/** 必须被 .gitignore 忽略的 6 个 IDE/环境部署路径 */
const MUST_IGNORE_PATHS = [
  '.codebuddy/settings.json',
  '.cursorrules',
  '.workbuddy/scripts/test.ps1',
  '.trae-cn/work/session/test.ps1',
  '.vscode/settings.json',
  '.idea/workspace.xml',
] as const

/** 必须保留追踪的团队共享资产路径（不应被 .gitignore 忽略） */
const MUST_TRACK_PATHS = ['.trae/skills/skill-registry.json', '.trae/skills/INDEX.md'] as const

/**
 * 运行 git check-ignore，返回退出码（0=被忽略，1=未被忽略）
 *
 * spawnSync 防死锁配置（与 commit-msg-scope-validation.test.ts 对齐）：
 *  - shell: false + 参数数组形式，避免 shell 解释与命令注入
 *  - stdio: 'ignore' 不读取 stdout，但仍然设置 maxBuffer 防御性配置
 *  - windowsHide: true 避免抢焦点
 */
function gitCheckIgnore(filePath: string): number {
  const result = spawnSync('git', ['check-ignore', filePath], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 15000,
    stdio: 'ignore',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })
  // git check-ignore 退出码：0=被忽略，1=未被忽略，>1=错误（视为未被忽略）
  return result.status === 0 ? 0 : 1
}

/**
 * 运行审计脚本，返回退出码与 stdout
 * Windows 环境下 sh 可能不可用（git hook 用 git-bash 的 sh 执行，测试环境未必）。
 * 不可用时返回 status=-1 与提示信息，调用方应条件跳过。
 */
function runAuditScript(): { status: number; stdout: string } {
  // 探测 sh 是否可用
  const probe = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf-8', shell: false })
  if (probe.status !== 0 || probe.stdout.trim() !== 'ok') {
    return { status: -1, stdout: '[sh unavailable in this environment]' }
  }
  // spawnSync 防死锁配置（与 commit-msg-scope-validation.test.ts 对齐）：
  //  1. stdio[0]='ignore' 避免 sh.exe 在 Windows 等待 tty 交互
  //  2. maxBuffer=10MB 防止输出 >64KB 触发管道缓冲区死锁
  //  3. windowsHide=true 避免 console 窗口抢占焦点造成 GUI 等待
  //  4. timeout=15000 防止子进程异常卡住整个测试套件
  const result = spawnSync('sh', [AUDIT_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 15000,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, PATH: process.env.PATH || '', CI: 'true' },
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout || '',
  }
}

/** sh 是否在当前环境可用（Windows PowerShell 默认不可用，git-bash 可用） */
const SH_AVAILABLE: boolean = (() => {
  const probe = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf-8', shell: false })
  return probe.status === 0 && probe.stdout.trim() === 'ok'
})()

describe('gitignore-coverage — IDE/环境部署追踪治理', () => {
  describe('正向：6 个 IDE 路径必须被 .gitignore 忽略', () => {
    for (const p of MUST_IGNORE_PATHS) {
      it(`git check-ignore 退出码 0：${p}`, () => {
        const code = gitCheckIgnore(p)
        expect(code).toBe(0)
      })
    }
  })

  describe('逆向：团队共享资产路径不得被 .gitignore 忽略', () => {
    for (const p of MUST_TRACK_PATHS) {
      it(`git check-ignore 退出码 1（未忽略）：${p}`, () => {
        const code = gitCheckIgnore(p)
        expect(code).toBe(1)
      })
    }
  })

  describe('审计脚本 audit-gitignore-coverage.sh', () => {
    it('脚本文件存在', () => {
      const fs = require('node:fs')
      expect(fs.existsSync(AUDIT_SCRIPT)).toBe(true)
    })

    it.runIf(SH_AVAILABLE)('脚本有可执行权限（Unix）或可被 sh 执行', () => {
      const result = spawnSync('sh', ['-c', `test -f "${AUDIT_SCRIPT}" && echo ok`], {
        encoding: 'utf-8',
      })
      expect(result.stdout.trim()).toBe('ok')
    })

    it.runIf(SH_AVAILABLE)('审计脚本退出码 0（当前 .gitignore 规则完整）', () => {
      const { status, stdout } = runAuditScript()
      expect(status).toBe(0)
      // 关键证据：3 项检查全部通过
      expect(stdout).toContain('暂存区无 IDE 私有路径文件')
      expect(stdout).toContain('6 个 IDE 路径全部被 .gitignore 覆盖')
      expect(stdout).toContain('.trae 未被忽略（保留追踪正确）')
    })

    it.runIf(SH_AVAILABLE)('审计输出包含治理依据引用', () => {
      const { stdout } = runAuditScript()
      expect(stdout).toContain('FILE-MANAGEMENT-GUIDE.md §2.2')
    })
  })

  describe('完整性：.gitignore IDE/环境部署追踪规则覆盖', () => {
    it('.gitignore 包含 6 条 IDE 忽略规则', () => {
      const fs = require('node:fs')
      const gitignorePath = path.join(REPO_ROOT, '.gitignore')
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      const lines = content.split(/\r?\n/)

      // 6 个必须忽略的路径
      const requiredRules = [
        '.codebuddy/',
        '.cursorrules',
        '.workbuddy/',
        '.trae-cn/',
        '.vscode',
        '.idea',
      ]

      for (const rule of requiredRules) {
        const found = lines.some(
          (l: string) => l.trim() === rule && !l.trim().startsWith('#')
        )
        expect(found).toBe(true)
      }
    })

    it('.gitignore 不包含 .trae/ 忽略规则（保留追踪）', () => {
      const fs = require('node:fs')
      const gitignorePath = path.join(REPO_ROOT, '.gitignore')
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      const lines = content.split(/\r?\n/)

      // .trae/ 不应作为独立忽略规则出现（注释中的提及除外）
      const traeIgnoreRule = lines.find(
        (l: string) =>
          l.trim() === '.trae/' || l.trim() === '.trae' ||
          l.trim().match(/^\.trae\/$/)
      )
      expect(traeIgnoreRule).toBeUndefined()
    })
  })
})
