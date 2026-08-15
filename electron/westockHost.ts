/**
 * Electron 主进程承载：腾讯自选股 CLI（westock-data-skillhub）
 *
 * 渲染进程（Chromium）无 child_process，无法直接调用 CLI；
 * 故 CLI 必须由 Electron main（Node）承载，渲染进程经 IPC（preload 暴露的 window.westock）调用。
 * 与 src 侧 WestockCliBridge 同构：每次调用 spawn 子进程，超时即杀，stdout 原样返回（由渲染侧解析 JSON）。
 *
 * 设计：CLI 为「按需调用」型（非长驻服务），因此 WestockHost 不在启动时拉起常驻进程，
 * 仅在收到 IPC 请求时 spawn，并返回 stdout 文本。启动期做一次轻量能力探测并缓存 health。
 *
 * @module electron/westockHost
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { getLogger } from './logger'

const logger = getLogger('westock-host')

/** CLI 包名（与 WestockCliBridge 保持一致） */
const PKG = 'westock-data-skillhub@1.0.5'
/** 单次调用超时（ms） */
const DEFAULT_TIMEOUT_MS = 25_000

export interface WestockHealth {
  available: boolean
  bin: string
  note: string
}

/**
 * 腾讯自选股 CLI 宿主（Electron main）
 */
export class WestockHost {
  private readonly bin: string
  private readonly timeoutMs: number
  private health: WestockHealth = { available: false, bin: '', note: '未初始化' }

  constructor() {
    this.bin = process.env.WESTOCK_BIN && process.env.WESTOCK_BIN.length > 0 ? process.env.WESTOCK_BIN : 'npx'
    this.timeoutMs = Number(process.env.WESTOCK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
    this.health.bin = this.bin
  }

  /** 应用启动时调用（非阻塞）：做一次轻量能力探测，结果缓存 */
  async init(): Promise<void> {
    logger.info('[WestockHost] 初始化（探测 CLI 可用性）', { bin: this.bin })
    try {
      await this.invoke('search', '茅台 --type stock')
      this.health = { available: true, bin: this.bin, note: 'CLI 探测成功' }
      logger.info('[WestockHost] CLI 可用')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.health = { available: false, bin: this.bin, note: `CLI 探测失败: ${msg}` }
      // 不阻断主进程启动：CLI 不可用时采集舱会自动降级到其它源
      logger.warn('[WestockHost] CLI 不可用（不影响主进程启动，采集舱将降级）', { note: this.health.note })
    }
  }

  getHealth(): WestockHealth {
    return this.health
  }

  /** 渲染进程经 IPC 调用：在 main（Node）中 spawn CLI 并返回 stdout 文本 */
  async invoke(command: string, args = ''): Promise<string> {
    // 全局参数 --raw：要求 CLI 输出 JSON（渲染侧 WestockCliBridge.parseJson 依赖此）。
    const argTokens = [...this.tokenize(args)]
    if (!argTokens.includes('--raw')) argTokens.push('--raw')
    const fullArgs =
      this.bin === 'npx'
        ? ['-y', PKG, ...this.tokenize(command), ...argTokens]
        : [...this.tokenize(command), ...argTokens]

    logger.debug('[WestockHost] invoke', { bin: this.bin, fullArgs })
    const child = spawn(this.bin, fullArgs, {
      env: { ...process.env, WB_NO_COLOR: '1', NODE_NO_WARNINGS: '1' },
      windowsHide: true,
      // shell:true 解决 Windows 下 spawn('npx') 找不到 npx.exe（npm 仅提供 npx.cmd）的 ENOENT
      shell: true,
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
      let out = ''
      let errOut = ''
      child.stdout?.on('data', (c: Buffer | string) => {
        out += c.toString()
      })
      child.stderr?.on('data', (c: Buffer | string) => {
        errOut += c.toString()
      })
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
        if (code === 0) resolve(out)
        else reject(new Error(`非零退出 code=${String(code)}: ${(errOut || out).slice(-300)}`))
      })
    })
  }
}
