#!/usr/bin/env node
/**
 * @module scripts/other/create-annotated-tag
 * @description P3-4 rc.3 发布：创建 Annotated Tag（git tag -a v<ver> -F <msg>）
 *              并在 Tag message Footer 内嵌 ROLLBACK 5min RTO 回滚命令行。
 *
 * 核心价值：
 *   运维 `git show v2.0.1 | tail` → 秒级看到回滚命令，不用翻 09-Deployment-Readiness 报告。
 *   对应 IMPROVEMENT-TRACKER.md P3-4 验收：`git show v2.0.1 | grep ROLLBACK` → 命中 → OK。
 *
 * 用法（默认 DRY-RUN，仅打印不写 git，安全第一）：
 *   npx tsx scripts/other/create-annotated-tag.ts --dry-run [--version 2.0.1-rc.3]
 *   npx tsx scripts/other/create-annotated-tag.ts --help
 *
 * 真实创建（人工确认后）：
 *   npx tsx scripts/other/create-annotated-tag.ts --apply [--version 2.0.1-rc.3]
 *
 * 设计原则：
 *   - 默认为 --dry-run（打印输出，零副作用），避免误打 Tag。
 *   - --apply 才会真实调用 `git tag -a`；仍然**不会执行 git push**，推送由人工或
 *     scripts/other/git-push-with-retry.ps1 二次确认（禁止自动 push 到远端）。
 *   - 版本来源优先级：--version > process.env.npm_package_version > 读取 package.json。
 *   - 幂等：若同版本 Tag 已存在则 --apply 时退出 1（禁止覆盖已推远端的 Tag）。
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// ES Module 环境下的 __filename / __dirname 等价物（Node 22+ 不提供 CommonJS 全局变量）
const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

// ---------- 参数解析 ----------
type CliArgs = {
  dryRun: boolean    // 默认 true；显式 --apply 才为 false
  apply: boolean
  help: boolean
  version?: string   // CLI 传入，或后续从 package.json 推断
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: true, apply: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--dry-run': args.dryRun = true; args.apply = false; break
      case '--apply':   args.apply = true;  args.dryRun = false; break
      case '--help':    args.help = true; break
      case '--version': {
        const next = argv[i + 1]
        if (!next || next.startsWith('-')) {
          console.error('[create-annotated-tag] --version 需要一个版本号参数（例如 2.0.1-rc.3）')
          process.exit(1)
        }
        args.version = next
        i++ // 跳过值
        break
      }
      default:
        // 形如 `--version=2.0.1-rc.3` 的等号写法
        if (a.startsWith('--version=')) {
          args.version = a.split('=')[1] || ''
          if (!args.version) {
            console.error('[create-annotated-tag] --version= 值不可为空')
            process.exit(1)
          }
        } else {
          // 版本号裸传（兼容 npm version 钩子传参习惯）
          if (/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(a)) {
            args.version = a.replace(/^v/, '')
          } else {
            console.warn(`[create-annotated-tag] ⚠ 忽略未知参数: ${a}`)
          }
        }
    }
  }
  return args
}

// ---------- 版本推断 ----------
function resolveVersion(cliVersion: string | undefined): string {
  if (cliVersion) return cliVersion.replace(/^v/, '')
  if (process.env.npm_package_version) return process.env.npm_package_version
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  if (pkg.version) return String(pkg.version)
  console.error('[create-annotated-tag] 无法解析版本号：--version 未传且 package.json 无 version')
  process.exit(1)
}

// ---------- ROLLBACK Footer 构造（与 IMPROVEMENT-TRACKER.md L123 精确对齐） ----------
const ROLLBACK_FOOTER = [
  '--- ROLLBACK 5min RTO ---',
  '# 回滚目的：遇到线上严重故障时，按以下两档之一 5 分钟内完成回滚',
  '#   A 档 · 代码硬回滚（适合接口/渲染崩溃）：',
  '回滚到 rc.1: git reset --hard v2.0.0-rc.1 && npm run build && deploy.sh',
  '#   B 档 · 灰度关闭（适合逻辑错误，保留当前代码，仅将 canary 流量切回稳定分支）：',
  '回滚到上一个稳定: feature-flags.json canary.enabled=false canaryPct=0 (Stable GA)',
  '# 验证：curl https://<your-domain>/health → version 字段应为 v2.0.0-rc.1 或 stable GA 版本号',
  '',
].join('\n')

function buildTagMessage(version: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return [
    `Release v${version} (${date})`,
    '',
    `# 智能投研复盘系统 V9 · ${version} Annotated Tag`,
    '',
    '## 关联变更',
    '  · 详见 CHANGELOG.md 对应 [Unreleased] 段，已由 postversion 钩子归档为版本段。',
    '  · 关联文档：docs/reports/pre-launch/<date>/ 下 GA/rc 发布系列评估报告。',
    '',
    '## 部署前检查（5 条）',
    '  [ ] 1. `npm run tsc:prod` 退出码 0',
    '  [ ] 2. `npm run audit:layers` 退出码 0（0 违规）',
    '  [ ] 3. `npm run vitest` 全部通过（vitest baseline 无回归）',
    '  [ ] 4. `npm run build` 成功，PWA dist/sw.js 产出（build 日志见 PWA v1.3.0 precache 统计）',
    '  [ ] 5. 环境变量：VITE_DATA_SOURCE_TYPE=real + Python AkShare collect_endpoints 运行中',
    '',
    ROLLBACK_FOOTER,
  ].join('\n')
}

// ---------- Git 前置检查 ----------
function tagExists(tagName: string): boolean {
  const r = spawnSync('git', ['tag', '-l', tagName], { encoding: 'utf-8', cwd: process.cwd() })
  return r.status === 0 && r.stdout.trim().split(/\r?\n/).includes(tagName)
}

function writeTagAnnotated(tagName: string, message: string): { ok: boolean; cmd: string; output: string } {
  // 使用 `git tag -a <name> -F <file>` 更稳健（多行 message 不受 shell 转义影响）
  const tmp = os.tmpdir()
  const msgFile = join(tmp, `finsight-v9-tag-${tagName}-${Date.now()}.txt`)
  writeFileSync(msgFile, message, 'utf-8')
  const cmd = `git tag -a ${tagName} -F "${msgFile}"`
  const r = spawnSync('git', ['tag', '-a', tagName, '-F', msgFile], { encoding: 'utf-8', cwd: process.cwd() })
  return {
    ok: r.status === 0,
    cmd,
    output: (r.stdout + r.stderr).trim(),
  }
}

// ---------- HELP ----------
const HELP_TEXT = `
create-annotated-tag.ts · P3-4 Annotated Tag 内嵌 ROLLBACK Footer 工具

USAGE:
  npx tsx scripts/other/create-annotated-tag.ts [--dry-run | --apply] [--version <ver>]

FLAGS:
  --dry-run   (默认) 仅打印会生成的 Tag 名、完整 Tag message、将执行的 git 命令；**不写入 git**。
  --apply     真实执行 git tag -a 创建 Annotated Tag；仍**不执行 git push**。
  --version X 显式指定版本号（例 2.0.1-rc.3）；缺省值从 npm_package_version / package.json 读取。
  --help      显示本帮助。

SAFETY GUARANTEES:
  1. 默认 --dry-run（零副作用）；必须显式 --apply 才写 git tag。
  2. --apply 遇到同版本 Tag 已存在 → 直接退出 1（禁止覆盖已推送远端的 Tag）。
  3. --apply 仅创建本地 Tag，不做 git push；推送必须人工二次确认后执行：
       git push origin v<version>
       或通过 scripts/other/git-push-with-retry.ps1（含断点重试 + 审计日志）。

ROLLBACK Footer 自动注入：
  每次生成的 Tag message 末段必然包含：
    --- ROLLBACK 5min RTO ---
    回滚到 rc.1: git reset --hard v2.0.0-rc.1 && npm run build && deploy.sh
    回滚到上一个稳定: feature-flags.json canary.enabled=false canaryPct=0 (Stable GA)
  验收：git show v<version> | grep -E "ROLLBACK|canary.enabled=false" → 必须命中。
`

// ---------- MAIN ----------
function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP_TEXT)
    process.exit(0)
  }
  // 注意：无 --apply + 无 --dry-run 显式写的时候 → 仍按 dry-run（安全默认）
  const mode = args.apply ? 'apply' : 'dry-run'
  const version = resolveVersion(args.version)
  const tagName = `v${version}`
  const message = buildTagMessage(version)

  // =============== HEADER（apply/dry-run 共通输出）===============
  console.log('============================================================')
  console.log(`[create-annotated-tag] MODE    : ${mode.toUpperCase()}`)
  console.log(`[create-annotated-tag] VERSION : ${version}`)
  console.log(`[create-annotated-tag] TAG NAME: ${tagName}`)
  console.log('============================================================')
  console.log()
  console.log('--- BEGIN TAG MESSAGE ---')
  console.log(message)
  console.log('--- END TAG MESSAGE ---')
  console.log()

  // 校验：确保 ROLLBACK 关键行存在（防止未来重构丢失 Footer，自验）
  const mustHave = ['--- ROLLBACK 5min RTO ---', 'git reset --hard v2.0.0-rc.1 && npm run build &&', 'canary.enabled=false', 'canaryPct=0']
  const missing = mustHave.filter((s) => !message.includes(s))
  if (missing.length > 0) {
    console.error(`[create-annotated-tag] ❌ TAG MESSAGE 自检失败：缺失 ROLLBACK 关键行 = ${missing.join(' | ')}`)
    process.exit(1)
  }
  console.log('[create-annotated-tag] ✓ Tag message 自验通过（ROLLBACK Footer 关键行齐全）')

  // =============== DRY-RUN：打印命令 + 提醒 ===============
  if (mode === 'dry-run') {
    console.log('[create-annotated-tag] ⚠ DRY-RUN 模式（零副作用），将执行的命令如下：')
    console.log(`     1) git tag -a ${tagName} -F <tmp message file>`)
    console.log('     2) （人工二次确认后） git push origin ' + tagName)
    console.log()
    console.log('[create-annotated-tag] 如需真实创建，执行：')
    console.log('     npm run release:tag-apply')
    console.log('  或 npx tsx scripts/other/create-annotated-tag.ts --apply')
    process.exit(0)
  }

  // =============== APPLY：真实创建 ===============
  if (tagExists(tagName)) {
    console.error(`[create-annotated-tag] ❌ ${tagName} 已存在（已推远端？禁止覆盖）。`)
    console.error('     若确需重建，请先人工执行：git tag -d ' + tagName + ' && git push origin :refs/tags/' + tagName)
    process.exit(1)
  }
  const result = writeTagAnnotated(tagName, message)
  if (!result.ok) {
    console.error(`[create-annotated-tag] ❌ git tag -a 执行失败：${result.output}`)
    process.exit(1)
  }
  console.log(`[create-annotated-tag] ✓ 本地 Annotated Tag 已创建：${tagName}`)
  console.log(`     执行命令: ${result.cmd}`)
  console.log()
  console.log('[create-annotated-tag] ⚠ 下一步（人工确认后推送，建议用 git-push-with-retry.ps1）：')
  console.log('     # 方法 1 · 直接推送：')
  console.log('       git push origin ' + tagName)
  console.log('     # 方法 2 · 带断点重试 + 审计日志（scripts/other/git-push-with-retry.ps1）：')
  console.log('       powershell -ExecutionPolicy Bypass -File scripts/other/git-push-with-retry.ps1 -Tag ' + tagName)
  console.log()
  console.log('[create-annotated-tag] 验收：推送成功后执行 → git show ' + tagName + ' | grep ROLLBACK')
  console.log('     预期输出：命中 "--- ROLLBACK 5min RTO ---" + "canary.enabled=false" 等关键行 → OK')
}

// 仅当直接被 tsx/node 执行时运行（避免 vitest import 时触发副作用）
const executedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(__filename)
if (executedDirectly) main()

// 导出供 vitest 复用（测试 message 构造 + Footer 自检，无需 spawn）
export const _forTest = {
  buildTagMessage,
  ROLLBACK_FOOTER,
  parseArgs,
  resolveVersion,
}
