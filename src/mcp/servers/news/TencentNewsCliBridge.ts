/**
 * TencentNewsCliBridge — 封装 tencent-news-cli 调用（腾讯新闻资讯数据源）
 *
 * 职责（对应技术方案 §4.2，M1 交付物）：
 * - 以 child_process 在 Node 宿主进程调用 CLI（预装 bin：%HOME%/.tencent-news-cli/bin/）
 * - stdout 自适应编码解码（严格 UTF-8 → 严格 gb18030 → 宽松 UTF-8），杜绝中文乱码
 * - 超时即杀（绝不挂起采集主链）
 * - 错误映射为 CliError，供 MCP Server 转 ToolResult.isError
 *
 * ## 编码实测（2026-08-15，v1.0.14，管道原始字节）
 * CLI stdout 实为 **UTF-8**（首字节 E6 98 BF = 「是」，严格 UTF-8 校验通过）；
 * 技术方案早期在 GBK 控制台（chcp 936）观察到的「GBK 输出」实为 UTF-8 字节被按
 * GBK 显示产生的误判（鏄吘璁 = 是腾讯 的 UTF-8 字节按 GBK 解读）。
 * 但 CLI 版本迭代或经 PowerShell 中转时输出仍可能为真 GBK，故桥接层按
 * 「严格 UTF-8 → 严格 gb18030（GBK 完整超集）→ 宽松 UTF-8」自适应解码，
 * 两种编码均正确处理（同 scripts/lib/encoding.ts 已验证范式）。
 *
 * 关键实现约束：先拼接全部 stdout 原始字节再一次性解码——多字节序列可能被
 * stream chunk 从中间切断（如 GBK 双字节被切成 1+1），逐 chunk 解码会产生
 * U+FFFD 且使编码探测误判。
 *
 * 进程约束：本桥接必须运行在 Node（Electron main / 本地 MCP Host），
 * 浏览器渲染进程无 child_process。采用动态 import('node:child_process')，
 * 不可用时抛 CliError('unavailable')，由上层优雅降级到既有资讯链（§5.4）。
 *
 * @module mcp/servers/news/TencentNewsCliBridge
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 非零退出时错误 tail 的最大展示长度（字符） */
const ERROR_TAIL_MAX_CHARS = 300

/** CLI 调用错误分类 */
export type CliErrorKind = 'spawn' | 'timeout' | 'nonzero' | 'empty' | 'unavailable'

/** CLI 调用错误（spawn 失败 / 超时 / 非零退出 / 空输出 / 环境不可用） */
export class CliError extends Error {
  readonly kind: CliErrorKind
  constructor(message: string, kind: CliErrorKind) {
    super(message)
    this.name = 'CliError'
    this.kind = kind
  }
}

/** 渲染进程经 preload 暴露的腾讯新闻 IPC 调用入口（Electron main 承载 CLI） */
interface TencentNewsIpcApi {
  invoke: (command: string, args: string) => Promise<string>
  health: () => Promise<{ available: boolean; bin: string; note: string }>
}
interface WindowWithTencentNews {
  tencentnews?: TencentNewsIpcApi
}

/**
 * 自适应解码 CLI stdout/stderr 原始字节。
 *
 * 判定顺序（确定性判据，非启发式）：
 * 1. 严格 UTF-8：整段合法即认定 UTF-8（UTF-8 结构约束远强于 GBK，整段合法几乎不可能是巧合）；
 * 2. 严格 gb18030：GBK 的完整超集（Node ICU / Chromium 均内置），覆盖真 GBK 输出场景；
 * 3. 宽松 UTF-8 保底：坏字节 → U+FFFD，绝不抛错（错误 tail 展示用）。
 *
 * ASCII 输出三种解码结果一致，天然幂等。
 */
export function decodeCliBytes(buf: Buffer): string {
  if (buf.length === 0) return ''
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    // 非 UTF-8，回退 GBK
  }
  try {
    return new TextDecoder('gb18030', { fatal: true }).decode(buf)
  } catch {
    // 既非 UTF-8 亦非 GBK，宽松保底
  }
  return new TextDecoder('utf-8').decode(buf)
}

export interface TencentNewsCliBridgeOptions {
  /** CLI 二进制路径：缺省按 TENCENT_NEWS_CLI env → %HOME%/.tencent-news-cli/bin/ 解析 */
  bin?: string
  /** 单次调用超时（ms），缺省 20s（CLI 含 HTTPS 往返，低于请求级 5s 缺省） */
  timeoutMs?: number
}

type ChildProcessModule = typeof import('node:child_process')

/**
 * 腾讯新闻 CLI 桥接器。
 *
 * @example
 * const bridge = new TencentNewsCliBridge()
 * const text = await bridge.invoke('hot')            // 热点（需先 apikey-set）
 * const text2 = await bridge.invoke('search', '数据要素 --limit 20')
 */
export class TencentNewsCliBridge {
  private readonly binOverride: string | undefined
  private readonly timeoutMs: number

  /** 带缓存的 child_process 模块引用（undefined = 当前环境不可用） */
  private cpModule: ChildProcessModule | null | undefined

  constructor(options: TencentNewsCliBridgeOptions = {}) {
    this.binOverride = options.bin
    this.timeoutMs = options.timeoutMs ?? 20_000
  }

  /**
   * 调用一个 CLI 子命令并返回解码后的标准输出文本。
   *
   * @param command 子命令（如 'hot'、'search'、'morning'、'apikey-get'）
   * @param args 命令参数（空格分隔字符串，如 '数据要素 --limit 20'）
   * @param options.timeoutMs 单次调用超时覆盖（ms）；缺省用实例级 timeoutMs（默认 20s）。
   *        用于上游天然缓慢的命令（如 jiaozhen 事实核查，常态 >20s），避免误杀。
   * @returns 解码后的 stdout 文本（编码自适应，见 decodeCliBytes）
   * @throws {CliError} spawn 失败 / 超时 / 非零退出 / 空输出 / 非 Node 环境
   */
  async invoke(command: string, args = '', options: { timeoutMs?: number } = {}): Promise<string> {
    // Electron 渲染进程无 child_process：优先走 preload 暴露的 IPC 入口（main 进程承载 CLI）
    const ipc = this.resolveIpcTarget()
    if (ipc) return ipc(command, args)
    const cp = await this.loadChildProcess()
    const argv = [command, ...this.tokenize(args)]
    const bin = this.resolveBin()

    logger.info(`[TencentNewsCliBridge] invoke: ${bin} ${argv.join(' ')}`)

    const child = cp.spawn(bin, argv, {
      env: this.buildEnv(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const buf = await this.collect(child, options.timeoutMs)
    if (buf.length === 0) throw new CliError('CLI 返回空输出', 'empty')
    return decodeCliBytes(buf)
  }

  /**
   * 探测 CLI 桥接是否可用（child_process 可加载且 bin 落盘存在）。
   * 供 check_health / 资源解析使用，不真正拉数。
   */
  async isAvailable(): Promise<boolean> {
    if (this.resolveIpcTarget()) return true
    try {
      await this.loadChildProcess()
    } catch {
      return false
    }
    try {
      const fs = await import('node:fs/promises')
      await fs.access(this.resolveBin())
      return true
    } catch {
      return false
    }
  }

  /** 解析 Electron 渲染进程经 preload 暴露的腾讯新闻 IPC 调用入口（无则 null → 走 child_process/降级） */
  private resolveIpcTarget(): ((command: string, args: string) => Promise<string>) | null {
    const g = globalThis as unknown as { window?: WindowWithTencentNews }
    const api = g.window?.tencentnews?.invoke
    return typeof api === 'function' ? api : null
  }

  // ── 内部方法 ──

  private async loadChildProcess(): Promise<ChildProcessModule> {
    if (this.cpModule !== undefined) {
      if (this.cpModule === null)
        throw new CliError('child_process 不可用（非 Node 环境），腾讯新闻源降级到既有资讯链', 'unavailable')
      return this.cpModule
    }
    try {
      const mod = await import('node:child_process')
      this.cpModule = mod
      return mod
    } catch {
      this.cpModule = null
      throw new CliError('child_process 不可用（非 Node 环境），腾讯新闻源降级到既有资讯链', 'unavailable')
    }
  }

  /** 解析 CLI bin：显式覆盖 → TENCENT_NEWS_CLI env → %HOME%/.tencent-news-cli/bin/（预装落盘位） */
  private resolveBin(): string {
    if (this.binOverride && this.binOverride.length > 0) return this.binOverride
    const g = globalThis as unknown as { process?: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform } }
    const envBin = g.process?.env?.TENCENT_NEWS_CLI
    if (envBin && envBin.length > 0) return envBin
    const home = g.process?.env?.USERPROFILE ?? g.process?.env?.HOME ?? ''
    if (!home.length) return 'tencent-news-cli' // PATH 兜底
    const exe = g.process?.platform === 'win32' ? 'tencent-news-cli.exe' : 'tencent-news-cli'
    // 正斜杠在 Windows API 层同样合法，避免引入 node:path（保持与渲染进程共存的纯模块）
    return `${home}/.tencent-news-cli/bin/${exe}`
  }

  /** 构造子进程环境变量（剥离终端色码等干扰；非 Node 环境退化为空对象） */
  private buildEnv(): NodeJS.ProcessEnv {
    const g = globalThis as unknown as { process?: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform } }
    const base = g.process?.env ? { ...g.process.env } : {}
    return { ...base, NO_COLOR: '1', PYTHONIOENCODING: 'utf-8' }
  }

  /** 将参数字符串安全切分为 argv（按空白切分，保留引号内内容） */
  private tokenize(args: string): string[] {
    if (!args.trim()) return []
    const matches = args.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
    return matches.map((m) => m.replace(/^["']|["']$/g, ''))
  }

  /**
   * 收集 stdout 原始字节（先缓存 Buffer 分片，close 后一次性 concat + 解码，
   * 保证跨 chunk 的多字节序列不被切断）。超时即杀子进程并 reject。
   * @param timeoutMsOverride 覆盖实例级超时（用于上游天然缓慢的命令，如 jiaozhen）
   */
  private collect(child: import('node:child_process').ChildProcess, timeoutMsOverride?: number): Promise<Buffer> {
    const effectiveTimeout = timeoutMsOverride && timeoutMsOverride > 0 ? timeoutMsOverride : this.timeoutMs
    return new Promise((resolve, reject) => {
      const outChunks: Buffer[] = []
      const errChunks: Buffer[] = []
      child.stdout?.on('data', (chunk: Buffer | string) => {
        outChunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'latin1') : chunk)
      })
      child.stderr?.on('data', (chunk: Buffer | string) => {
        errChunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'latin1') : chunk)
      })

      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new CliError(`CLI 调用超时（>${effectiveTimeout}ms），已终止子进程`, 'timeout'))
      }, effectiveTimeout)

      child.on('error', (err: Error) => {
        clearTimeout(timer)
        reject(new CliError(`CLI spawn 失败: ${err.message}`, 'spawn'))
      })

      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        const out = Buffer.concat(outChunks)
        if (code === 0) {
          resolve(out)
        } else {
          const tailBuf = errChunks.length > 0 ? Buffer.concat(errChunks) : out
          const tail = decodeCliBytes(tailBuf).slice(-ERROR_TAIL_MAX_CHARS)
          reject(new CliError(`CLI 非零退出 code=${String(code)}：${tail}`, 'nonzero'))
        }
      })
    })
  }
}

/** 全局默认 CLI 桥接单例（bin 经 TENCENT_NEWS_CLI env 或预装路径解析） */
export const tencentNewsCliBridge = new TencentNewsCliBridge()
