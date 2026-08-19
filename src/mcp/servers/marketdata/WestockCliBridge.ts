/**
 * WestockCliBridge — 封装 westock-data-skillhub CLI 调用（腾讯自选股数据源）
 *
 * 职责（对应技术方案 §4.3）：
 * - 以 child_process 在 Node 宿主进程调用 CLI，获取腾讯自选股结构化数据
 * - 超时即杀（绝不挂起采集主链）
 * - stdout 容错解析（剥离日志行，取首个合法 JSON 文档）
 * - 错误映射为 CliError，供 MCP Server 转 ToolResult.isError
 *
 * 进程约束：本桥接必须运行在 Node（Electron main / 本地 MCP Host），
 * 浏览器渲染进程无 child_process。因此采用动态 import('node:child_process')
 * 并在不可用时标记 source 不可用，由上层优雅降级到既有数据源（§5.4）。
 *
 * @module mcp/servers/marketdata/WestockCliBridge
 */

import { getLogger } from '@/lib/logger'
import { DEFAULT_REQUEST_TIMEOUT_MS } from '@/config/timeouts'

const logger = getLogger()

/**
 * Electron 渲染进程中由 preload 暴露的 westock IPC API（window.westock）。
 * 渲染进程（Chromium）无 child_process，CLI 必须由 Electron main 承载，经 IPC 调用。
 */
interface WestockIpcApi {
  invoke: (command: string, args: string) => Promise<string>
  health: () => Promise<{ available: boolean; bin: string; note: string }>
}
interface WindowWithWestock {
  westock?: WestockIpcApi
}

/** CLI 调用错误分类 */
export type CliErrorKind = 'spawn' | 'timeout' | 'parse' | 'nonzero' | 'unavailable'

/** CLI 调用错误（非零退出 / 解析失败 / 超时 / 环境不可用） */
export class CliError extends Error {
  readonly kind: CliErrorKind
  constructor(message: string, kind: CliErrorKind) {
    super(message)
    this.name = 'CliError'
    this.kind = kind
  }
}

/** 解析后的 CLI 调用结果 */
export interface CliInvocationResult {
  /** 解析出的 JSON 对象（可能嵌套） */
  data: unknown
  /** CLI 标准输出原始文本（调试用） */
  raw: string
}

export interface WestockCliBridgeOptions {
  /** CLI 二进制：默认 'npx'，可配置为预装的 bin 路径（去 npx 冷启动，见 §9） */
  bin?: string
  /** npx 包名（bin 为 npx 时使用） */
  pkg?: string
  /** 单次调用超时（ms），缺省 DEFAULT_REQUEST_TIMEOUT_MS */
  timeoutMs?: number
  /** 解析前扫描的最大行数（跨行 JSON 容错） */
  maxScanLines?: number
}

type ChildProcessModule = typeof import('node:child_process')

/**
 * 腾讯自选股 CLI 桥接器（单例化使用）。
 *
 * @example
 * const bridge = new WestockCliBridge({ bin: '/opt/westock/bin/westock-data-skillhub' })
 * const { data } = await bridge.invoke('kline', 'sh600519 --period day --limit 60')
 */
export class WestockCliBridge {
  private readonly bin: string
  private readonly pkg: string
  private readonly timeoutMs: number
  private readonly maxScanLines: number

  /** 带缓存的 child_process 模块引用（undefined = 当前环境不可用） */
  private cpModule: ChildProcessModule | null | undefined

  constructor(options: WestockCliBridgeOptions = {}) {
    this.bin = options.bin ?? 'npx'
    this.pkg = options.pkg ?? 'westock-data-skillhub@1.0.5'
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.maxScanLines = options.maxScanLines ?? 200
  }

  /**
   * 调用一个 SKILL 命令并返回解析后的 JSON。
   *
   * @param command SKILL 子命令（如 'kline'、'report list'）
   * @param args 命令参数（空格分隔字符串，如 'sh600519 --period day --limit 60'）
   * @returns 解析后的 JSON 结果
   * @throws {CliError} 任一环节失败
   */
  async invoke(command: string, args = ''): Promise<CliInvocationResult> {
    // 全局参数 --raw：要求 CLI 以 JSON 输出（否则默认 markdown 表格，parseJson 无法解析）。
    const argTokens = [...this.tokenize(args)]
    if (!argTokens.includes('--raw')) argTokens.push('--raw')
    const rawArgs = argTokens.join(' ')

    // Electron 渲染进程：CLI 由 main 进程承载，经 IPC 调用（渲染进程无 child_process）
    const ipc = this.resolveIpcTarget()
    if (ipc) {
      const raw = await ipc(command, rawArgs)
      const data = this.parseJson(raw)
      return { data, raw }
    }

    const cp = await this.loadChildProcess()
    // 复合子命令（如 'fund flow' / 'report list' / 'macro indicator'）必须拆成多个 argv 元素，
    // 否则 CLI 会把 'fund flow' 当成单字面值参数而失效。
    const cmdTokens = this.tokenize(command)
    const fullArgs =
      this.bin === 'npx'
        ? ['-y', this.pkg, ...cmdTokens, ...argTokens]
        : [...cmdTokens, ...argTokens]

    logger.info(`[WestockCliBridge] invoke: ${this.bin} ${fullArgs.join(' ')}`)

    const child = cp.spawn(this.bin, fullArgs, {
      env: this.buildEnv(),
      windowsHide: true,
      // shell:true 解决 Windows 下 spawn('npx') 找不到 npx.exe（npm 仅提供 npx.cmd）的 ENOENT 问题；
      // 参数均为受控的 code/flag 字符串，无注入风险。
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdout = await this.collect(child)
    const data = this.parseJson(stdout)
    return { data, raw: stdout }
  }

  /**
   * 探测 CLI 桥接是否可用（仅校验 child_process 可加载，不真正拉数）。
   * 供 check_health / 资源解析使用。
   */
  async isAvailable(): Promise<boolean> {
    if (this.resolveIpcTarget()) return true
    try {
      await this.loadChildProcess()
      return true
    } catch {
      return false
    }
  }

  /** 解析 Electron 渲染进程经 preload 暴露的 westock IPC 调用入口（无则 null → 走 child_process/降级） */
  private resolveIpcTarget(): ((command: string, args: string) => Promise<string>) | null {
    const g = globalThis as unknown as { window?: WindowWithWestock }
    const api = g.window?.westock?.invoke
    return typeof api === 'function' ? api : null
  }

  // ── 内部方法 ──

  private async loadChildProcess(): Promise<ChildProcessModule> {
    if (this.cpModule !== undefined) {
      if (this.cpModule === null) throw new CliError('child_process 不可用（非 Node 环境），腾讯自选股源降级到既有数据源', 'unavailable')
      return this.cpModule
    }
    try {
      const mod = await import('node:child_process')
      this.cpModule = mod
      return mod
    } catch {
      this.cpModule = null
      throw new CliError('child_process 不可用（非 Node 环境），腾讯自选股源降级到既有数据源', 'unavailable')
    }
  }

  /** 构造子进程环境变量（注入 WB_NO_COLOR 保证纯 JSON 输出；非 Node 环境退化为空对象） */
  private buildEnv(): NodeJS.ProcessEnv {
    const g = globalThis as unknown as { process?: { env?: NodeJS.ProcessEnv } }
    const base = g.process?.env ? { ...g.process.env } : {}
    return { ...base, WB_NO_COLOR: '1', NODE_NO_WARNINGS: '1' }
  }

  /** 将参数字符串安全切分为 argv（按空白切分，保留引号内内容） */
  private tokenize(args: string): string[] {
    if (!args.trim()) return []
    const matches = args.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
    return matches.map((m) => m.replace(/^["']|["']$/g, ''))
  }

  /** 收集 stdout，超时即杀子进程并 reject（绝不挂起主链） */
  private collect(child: import('node:child_process').ChildProcess): Promise<string> {
    return new Promise((resolve, reject) => {
      let out = ''
      let errOut = ''
      child.stdout?.on('data', (chunk: Buffer | string) => {
        out += chunk.toString()
      })
      child.stderr?.on('data', (chunk: Buffer | string) => {
        errOut += chunk.toString()
      })

      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new CliError(`CLI 调用超时（>${this.timeoutMs}ms），已终止子进程`, 'timeout'))
      }, this.timeoutMs)

      child.on('error', (err: Error) => {
        clearTimeout(timer)
        reject(new CliError(`CLI spawn 失败: ${err.message}`, 'spawn'))
      })

      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve(out)
        } else {
          const tail = (errOut || out).slice(-300)
          reject(new CliError(`CLI 非零退出 code=${String(code)}：${tail}`, 'nonzero'))
        }
      })
    })
  }

  /** 容错解析：剥离日志/前导文本，取首个合法 JSON 文档（对象或数组，支持跨行） */
  private parseJson(raw: string): unknown {
    if (!raw?.trim()) throw new CliError('CLI 返回空输出', 'parse')
    const trimmed = raw.trim()
    // 先尝试整段解析
    try {
      return JSON.parse(trimmed)
    } catch {
      // 忽略，进入逐行/逐段扫描
    }
    // 扫描首个以 { 或 [ 开头的 JSON 片段（CLI 可能混入日志行）
    const lines = trimmed.split(/\r?\n/)
    const startIndex = lines.findIndex((l) => l.trim().startsWith('{') || l.trim().startsWith('['))
    if (startIndex === -1) throw new CliError(`CLI 输出无 JSON 片段: ${raw.slice(0, 200)}`, 'parse')
    const upper = Math.min(lines.length, startIndex + this.maxScanLines)
    for (let i = startIndex + 1; i <= upper; i++) {
      const candidate = lines.slice(startIndex, i).join('\n').trim()
      try {
        return JSON.parse(candidate)
      } catch {
        // 继续扩大范围
      }
    }
    throw new CliError(`CLI 输出无法解析为 JSON: ${raw.slice(0, 200)}`, 'parse')
  }
}

/** 全局默认 CLI 桥接单例（运行时可通过 env WESTOCK_BIN 指定预装 bin 以去 npx 冷启动） */
const g = globalThis as unknown as { process?: { env?: NodeJS.ProcessEnv } }
export const westockCliBridge = new WestockCliBridge({
  bin: g.process?.env?.WESTOCK_BIN && g.process.env.WESTOCK_BIN.length > 0 ? g.process.env.WESTOCK_BIN : 'npx',
})
