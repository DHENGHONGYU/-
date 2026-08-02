#!/usr/bin/env npx tsx
/**
 * scripts/verify-three-fixes.ts
 *
 * 🔧 本地自动化三件套验证总 runner（按依赖顺序串行执行）
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ Step 1：useMediaQuery 单元测试（Vitest）                     │
 * │   命令：npx vitest run src/hooks/useMediaQuery.test.ts       │
 * │   目的：验证 useSyncExternalStore 架构、SSR 场景、断点常量    │
 * │         订阅器工厂、内存泄漏、addListener fallback 等 16 用例  │
 * ├──────────────────────────────────────────────────────────────┤
 * │ Step 2：循环依赖检查（madge）                                 │
 * │   命令：npx tsx scripts/verify-circular-deps.ts              │
 * │   目的：运行 madge --circular 全仓扫描 + seed ↔ bootstrap     │
 * │         双向可达性检查 + Graphviz / Mermaid 可视化报告        │
 * ├──────────────────────────────────────────────────────────────┤
 * │ Step 3：useMediaQuery + z-index E2E（Playwright）            │
 * │   命令：npx playwright test e2e/use-mediaquery-zindex-       │
 * │                e2e.spec.ts --reporter=list                    │
 * │   目的：5 屏幕尺寸 × 3 路由 = 15 case 控制台监控 + 响应式    │
 * │         断点 2 case（底部导航/Sidebar 显隐）                 │
 * └──────────────────────────────────────────────────────────────┘
 *
 * 运行：
 *   npx tsx scripts/verify-three-fixes.ts
 *
 * 注意：
 *   · 第 3 步 Playwright 会自动通过 playwright.config.ts 的 webServer
 *     启 Vite (npm run dev)，无需手动启动；浏览器未安装时会给出指引。
 *   · Node >= 18，tsx 已在 devDependencies 中。
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname__ = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname__, '..')
const OUT_DIR = path.join(ROOT, 'outputs')
const DATE_STR = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const LOG_FILE = path.join(OUT_DIR, `verify-three-fixes-${DATE_STR}.log`)
const SUMMARY_FILE = path.join(OUT_DIR, `verify-three-fixes-summary-${DATE_STR}.md`)

function safeEnsureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}
safeEnsureDir(OUT_DIR)
// 初始化/清空日志文件
fs.writeFileSync(LOG_FILE, '', 'utf-8')

/* ============================================================
 * 日志工具：同时写入终端 + LOG_FILE
 * ========================================================== */
const streams = {
  log: fs.createWriteStream(LOG_FILE, { flags: 'a' }),
}
type LogLevel = 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'STEP'
function log(level: LogLevel, message: string, alsoConsole = true): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`
  try {
    streams.log.write(line + '\n')
  } catch {
    /* ignore */
  }
  if (alsoConsole) {
    const color =
      level === 'OK'
        ? '\x1b[32m'
        : level === 'ERROR'
          ? '\x1b[31m'
          : level === 'WARN'
            ? '\x1b[33m'
            : level === 'STEP'
              ? '\x1b[36m\x1b[1m'
              : '\x1b[0m'
    const reset = '\x1b[0m'
    // eslint-disable-next-line no-console
    console.log(`${color}${line}${reset}`)
  }
}

/* ============================================================
 * 命令执行：Windows shell:true / stdout+stderr tee 到 LOG_FILE
 * ========================================================== */
interface RunResult {
  code: number
  durationMs: number
  stdout: string
  stderr: string
}
function runStep(
  label: string,
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; allowNonZero?: boolean; cwd?: string } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const cwd = opts.cwd ?? ROOT
    const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000 // 默认 10 分钟
    const started = Date.now()
    let stdout = ''
    let stderr = ''
    let done = false
    const isWin = process.platform === 'win32'
    // Windows：npx → npx.cmd；tsx / playwright / vitest 可直接由 npx 解析
    const bin = isWin && cmd === 'npx' ? 'npx.cmd' : cmd
    log(
      'STEP',
      `${label}\n       命令：${bin} ${args.join(' ')}\n       CWD：${cwd}`,
    )
    const proc: ChildProcessWithoutNullStreams = spawn(bin, args, {
      cwd,
      shell: isWin,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NODE_ENV: 'test',
        CI: process.env.CI || '',
      },
    })
    proc.stdout.on('data', (d) => {
      const s = String(d)
      stdout += s
      try {
        streams.log.write(s)
      } catch {
        /* ignore */
      }
    })
    proc.stderr.on('data', (d) => {
      const s = String(d)
      stderr += s
      try {
        streams.log.write(`[STDERR] ${s}`)
      } catch {
        /* ignore */
      }
    })
    const timer = setTimeout(() => {
      if (done) return
      done = true
      const msg = `\n[TIMEOUT] 命令超过 ${timeoutMs}ms 被终止`
      stderr += msg
      try {
        streams.log.write(msg + '\n')
      } catch {
        /* ignore */
      }
      try {
        proc.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      resolve({ code: 124, durationMs: Date.now() - started, stdout, stderr })
    }, timeoutMs)
    proc.on('error', (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      const msg = `\n[SPAWN ERROR] ${err.message}`
      stderr += msg
      try {
        streams.log.write(msg + '\n')
      } catch {
        /* ignore */
      }
      resolve({ code: 127, durationMs: Date.now() - started, stdout, stderr })
    })
    proc.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({
        code: opts.allowNonZero ? code ?? 0 : code ?? 0,
        durationMs: Date.now() - started,
        stdout,
        stderr,
      })
    })
  })
}

/* ============================================================
 * 三步定义
 * ========================================================== */
interface StepDef {
  id: string
  title: string
  cmd: string
  args: string[]
  timeoutMs: number
  hint?: string
}
const STEPS: StepDef[] = [
  {
    id: 'step1-useMediaQuery-unit',
    title: 'Step 1/3：useMediaQuery 单元测试（Vitest）',
    cmd: 'npx',
    args: ['vitest', 'run', 'src/hooks/useMediaQuery.test.ts', '--reporter=verbose', '--no-coverage'],
    timeoutMs: 5 * 60 * 1000,
    hint: '若 jsdom 环境报错：确认 devDependencies 中 jsdom 已安装；项目已在 package.json 声明。',
  },
  {
    id: 'step2-circular-deps',
    title: 'Step 2/3：循环依赖检查（madge）',
    cmd: 'npx',
    args: ['tsx', 'scripts/verify-circular-deps.ts'],
    timeoutMs: 10 * 60 * 1000,
    hint: '若 madge 未安装：运行 npm i -D madge；如无 Graphviz 会自动以 Mermaid 为回退方案。',
  },
  {
    id: 'step3-e2e',
    title: 'Step 3/3：E2E 响应式 + z-index（Playwright）',
    cmd: 'npx',
    args: [
      'playwright',
      'test',
      'e2e/use-mediaquery-zindex-e2e.spec.ts',
      '--reporter=list',
      '--workers=1',
    ],
    timeoutMs: 20 * 60 * 1000,
    hint: '若浏览器未安装：先运行 npx playwright install chromium；Playwright 会自动启 Vite dev server。',
  },
]

/* ============================================================
 * MAIN
 * ========================================================== */
interface StepReport {
  id: string
  title: string
  ok: boolean
  code: number
  durationSec: number
  tail: string
  hint?: string
}
async function main(): Promise<number> {
  log('INFO', `FinSightV9 三件套验证开始（${DATE_STR}）`)
  log('INFO', `详细日志：${LOG_FILE}`)
  const reports: StepReport[] = []
  let overallOk = true

  for (const def of STEPS) {
    const res = await runStep(def.title, def.cmd, def.args, { timeoutMs: def.timeoutMs })
    const ok = res.code === 0
    if (!ok) overallOk = false
    const combinedTail = [
      res.stdout.length > 0
        ? `--- stdout (最后 1500 字符) ---\n${res.stdout.slice(-1500)}`
        : '',
      res.stderr.length > 0
        ? `--- stderr (最后 1500 字符) ---\n${res.stderr.slice(-1500)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
    reports.push({
      id: def.id,
      title: def.title,
      ok,
      code: res.code,
      durationSec: Math.round(res.durationMs / 1000),
      tail: combinedTail || '(无输出)',
      hint: def.hint,
    })
    log(ok ? 'OK' : 'ERROR', `${def.title} ${ok ? 'PASS' : `FAIL (exit=${res.code})`} 耗时 ${Math.round(res.durationMs / 1000)}s`)
    if (!ok && def.hint) {
      log('WARN', `  💡 故障排查提示：${def.hint}`)
    }
    console.log()
  }

  // 汇总 Markdown
  const totalSec = reports.reduce((s, r) => s + r.durationSec, 0)
  const md = `# 三件套验证汇总报告 (${DATE_STR})

## 总览

| 项目 | 结果 |
|---|---|
| 总体结论 | ${overallOk ? '✅ 全部通过 (3/3)' : `❌ 失败 (${reports.filter((r) => r.ok).length}/3 通过)`} |
| 总耗时 | ${Math.floor(totalSec / 60)}m ${totalSec % 60}s |
| 详细日志 | \`${path.relative(ROOT, LOG_FILE)}\` |

## 分步骤结果

${reports
  .map(
    (r) =>
      `### ${r.ok ? '✅' : '❌'} ${r.title}\n` +
      `- 退出码：\`${r.code}\`\n` +
      `- 耗时：\`${r.durationSec}s\`\n` +
      (r.hint ? `- 提示：${r.hint}\n` : '') +
      `\n<details>\n` +
      `<summary>输出尾部（点击展开）</summary>\n\n` +
      `\`\`\`\n${r.tail}\n\`\`\`\n\n` +
      `</details>\n`,
  )
  .join('\n\n')}

## 产出物清单

| 名称 | 路径 |
|---|---|
| 运行日志 | \`outputs/${path.basename(LOG_FILE)}\` |
| 本报告 | \`outputs/${path.basename(SUMMARY_FILE)}\` |
| Step2 - 循环依赖 Markdown 报告 | \`outputs/circular-deps-report-${DATE_STR.slice(0, 8)}.md\` |
| Step2 - Graphviz SVG 可视化（若有 Graphviz） | \`outputs/circular-deps-graph.svg\` |
| Step2 - Mermaid 回退可视化 | \`outputs/circular-deps-graph.html\` |
| Step3 - Playwright artifacts（失败时自动生成） | \`e2e/test-artifacts-temp/\` |

## 运行

\`\`\`bash
npx tsx scripts/verify-three-fixes.ts
\`\`\`
`
  fs.writeFileSync(SUMMARY_FILE, md, 'utf-8')
  log('INFO', `📄 汇总报告已写入：${SUMMARY_FILE}`)
  log('INFO', '')
  log(overallOk ? 'OK' : 'ERROR', overallOk ? '三件套全部通过 ✅' : '三件套存在失败项 ❌（详见上方分步骤与报告）')
  return overallOk ? 0 : 7
}

main()
  .then((exitCode) => {
    // 刷新日志流
    try {
      streams.log.end(() => process.exit(exitCode))
    } catch {
      process.exit(exitCode)
    }
  })
  .catch((e) => {
    log('ERROR', `[FATAL] 未捕获异常：${e instanceof Error ? e.stack || e.message : String(e)}`)
    try {
      streams.log.end(() => process.exit(99))
    } catch {
      process.exit(99)
    }
  })
