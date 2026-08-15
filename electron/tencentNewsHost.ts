/**
 * Electron 主进程承载：腾讯新闻 CLI（tencent-news）
 *
 * 渲染进程（Chromium）无 child_process，无法直接调用 CLI；
 * 故 CLI 必须由 Electron main（Node）承载，渲染进程经 IPC（preload 暴露的 window.tencentnews）调用。
 * 与 src 侧 TencentNewsCliBridge 同构：每次调用 spawn 子进程，超时即杀，stdout 原样返回（由渲染侧解析文本）。
 *
 * 设计：CLI 为「按需调用」型（非长驻服务），因此 TencentNewsHost 不在启动时拉起常驻进程，
 * 仅在收到 IPC 请求时 spawn，并返回 stdout 文本。启动期做一次轻量能力探测（bin 落盘存在性）并缓存 health，
 * 不触发网络请求，避免阻塞主进程启动。
 *
 * @module electron/tencentNewsHost
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import { getLogger } from './logger'

const logger = getLogger('tencentnews-host')

/** 单次调用超时（ms） */
const DEFAULT_TIMEOUT_MS = 20_000

export interface TencentNewsHealth {
  available: boolean
  bin: string
  note: string
}

/** 解析 CLI bin：TENCENT_NEWS_CLI env → %HOME%/.tencent-news-cli/bin/（预装落盘位） → PATH 兜底 */
function resolveBin(): string {
  const envBin = process.env.TENCENT_NEWS_CLI
  if (envBin && envBin.length > 0) return envBin
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
  if (!home) return 'tencent-news-cli'
  const exe = process.platform === 'win32' ? 'tencent-news-cli.exe' : 'tencent-news-cli'
  return `${home}/.tencent-news-cli/bin/${exe}`
}

/**
 * 腾讯新闻 CLI 宿主（Electron main）
 */
export class TencentNewsHost {
  private readonly bin: string
  private readonly timeoutMs: number
  private health: TencentNewsHealth = { available: false, bin: '', note: '未初始化' }

  constructor() {
    this.bin = resolveBin()
    this.timeoutMs = Number(process.env.TENCENT_NEWS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
    this.health.bin = this.bin
  }

  /** 应用启动时调用（非阻塞）：做一次轻量能力探测（bin 落盘存在性），结果缓存 */
  async init(): Promise<void> {
    logger.info('[TencentNewsHost] 初始化（探测 CLI 可用性）', { bin: this.bin })
    try {
      await access(this.bin)
      this.health = { available: true, bin: this.bin, note: 'CLI 探测成功（bin 落盘存在）' }
      logger.info('[TencentNewsHost] CLI 可用')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.health = { available: false, bin: this.bin, note: `CLI 未找到: ${msg}` }
      // 不阻断主进程启动：CLI 不可用时采集舱会自动降级到其它源
      logger.warn('[TencentNewsHost] CLI 不可用（不影响主进程启动，采集舱将降级）', { note: this.health.note })
    }
  }

  getHealth(): TencentNewsHealth {
    return this.health
  }

  /** 渲染进程经 IPC 调用：在 main（Node）中 spawn CLI 并返回 stdout 文本 */
  async invoke(command: string, args = ''): Promise<string> {
    const fullArgs = [...this.tokenize(command), ...this.tokenize(args)]
    logger.debug('[TencentNewsHost] invoke', { bin: this.bin, fullArgs })
    const child = spawn(this.bin, fullArgs, {
      env: { ...process.env, NO_COLOR: '1', PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return this.collect(child)
  }

  private tokenize(s: string): string[] {
    if (!s.trim()) return []
    return (s.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((m) => m.replace(/^["']|["']$/g, ''))
  }

  private collect(child: ChildProcess): Promise<string> {
    return new Promise((resolve, reject) => {
      const outChunks: Buffer[] = []
      const errChunks: Buffer[] = []
      child.stdout?.on('data', (c: Buffer | string) => outChunks.push(typeof c === 'string' ? Buffer.from(c, 'latin1') : c))
      child.stderr?.on('data', (c: Buffer | string) => errChunks.push(typeof c === 'string' ? Buffer.from(c, 'latin1') : c))
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`CLI 超时（>${this.timeoutMs}ms）`))
      }, this.timeoutMs)
      child.on('error', (err: Error) => {
        clearTimeout(timer)
        reject(new Error(`spawn 失败: ${err.message}`))
      })
      child.on('close', (code: number | null) => {
        clearTimeout(timer)
        if (code === 0) resolve(Buffer.concat(outChunks).toString('utf-8'))
        else {
          const tail = Buffer.concat(errChunks.length > 0 ? errChunks : outChunks).toString('utf-8').slice(-300)
          reject(new Error(`非零退出 code=${String(code)}: ${tail}`))
        }
      })
    })
  }
}
