/**
 * Python Sidecar 生命周期管理
 *
 * 方案B: Electron + 本地 Python Sidecar
 *
 * 职责：
 * - 定位 PyInstaller 打包的 v9-python-sidecar.exe（生产）或 Python 源码（开发）
 * - spawn 子进程，传递端口配置
 * - 轮询健康检查端点，等待服务就绪
 * - 进程崩溃自动重启
 * - 应用退出时优雅关闭
 *
 * 架构：
 *   Sidecar 内含三个服务：
 *   - Embedding Daemon (port 8765) — 单进程持有模型
 *   - Embedding Service (port 8001) — FastAPI 转发层
 *   - AKShare Collector  (port 8000) — 数据采集服务
 *
 * @module electron/sidecar
 */

import { spawn, ChildProcess } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as net from 'node:net'
import { app } from 'electron'
import { getLogger } from './logger'

const logger = getLogger('sidecar')

// ============================================================
// 类型
// ============================================================

export type SidecarStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface SidecarPorts {
  daemon: number
  embedding: number
  collector: number
}

export interface SidecarHealth {
  status: string
  embeddingLoaded: boolean
  modelId: string
  ports: SidecarPorts | null
}

// ============================================================
// 配置
// ============================================================

/** 默认端口（与 vite.config.ts proxy 保持一致） */
const DEFAULT_PORTS: SidecarPorts = {
  daemon: 8765,
  embedding: 8001,
  collector: 8000,
}

/** 健康检查轮询间隔 */
const HEALTH_CHECK_INTERVAL_MS = 1500
/** 健康检查超时 */
const HEALTH_CHECK_TIMEOUT_MS = 120_000
/** 崩溃后自动重启延迟 */
const RESTART_DELAY_MS = 3000
/** 最大重启次数 */
const MAX_RESTART_COUNT = 3

// ============================================================
// PythonSidecar 类
// ============================================================

export class PythonSidecar {
  private process: ChildProcess | null = null
  private status: SidecarStatus = 'stopped'
  private ports: SidecarPorts
  private restartCount = 0
  private logFile: string
  private isStopping = false

  constructor() {
    this.ports = { ...DEFAULT_PORTS }
    // 日志文件存到 userData 目录
    const logDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    this.logFile = path.join(logDir, 'sidecar.log')
  }

  // --------------------------------------------------------
  // 公开 API
  // --------------------------------------------------------

  getStatus(): SidecarStatus {
    return this.status
  }

  getPorts(): SidecarPorts {
    return { ...this.ports }
  }

  async getHealth(): Promise<SidecarHealth> {
    if (this.status !== 'running') {
      return { status: 'stopped', embeddingLoaded: false, modelId: '', ports: null }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`http://127.0.0.1:${this.ports.embedding}/api/embed/health`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        return { status: 'unhealthy', embeddingLoaded: false, modelId: '', ports: this.ports }
      }

      const data = (await res.json()) as {
        status: string
        model_loaded: boolean
        model_id: string
      }

      return {
        status: data.status,
        embeddingLoaded: data.model_loaded,
        modelId: data.model_id,
        ports: this.ports,
      }
    } catch {
      return { status: 'unreachable', embeddingLoaded: false, modelId: '', ports: this.ports }
    }
  }

  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      logger.warn('Sidecar already running or starting')
      return
    }

    this.status = 'starting'
    this.isStopping = false

    // 选择空闲端口
    this.ports = await this.findFreePorts()

    const mode = process.env.VITE_DEV_SERVER_URL ? 'development' : 'production'
    logger.info('Starting Python Sidecar', {
      mode,
      ports: this.ports,
      portBinding: {
        daemon: `127.0.0.1:${this.ports.daemon} (Embedding Daemon)`,
        embedding: `127.0.0.1:${this.ports.embedding} (Embedding Service)`,
        collector: `127.0.0.1:${this.ports.collector} (AKShare Collector)`,
      },
    })

    const { exe, args, cwd, env } = this.resolveSidecarPath()

    // 创建日志写入流
    const logStream = fs.createWriteStream(this.logFile, { flags: 'a' })
    logStream.write(`\n${'='.repeat(60)}\n`)
    logStream.write(`[${new Date().toISOString()}] Starting sidecar\n`)
    logStream.write(`exe=${exe}\nargs=${args.join(' ')}\ncwd=${cwd}\n`)
    logStream.write(`${'='.repeat(60)}\n`)

    this.process = spawn(exe, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    // 捕获 stdout/stderr 写入日志文件
    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) {
        logStream.write(`[stdout] ${text}\n`)
        logger.debug('sidecar stdout', { text })
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) {
        logStream.write(`[stderr] ${text}\n`)
        logger.warn('sidecar stderr', { text })
      }
    })

    // 进程退出处理
    this.process.on('exit', (code, signal) => {
      logStream.write(`[${new Date().toISOString()}] Process exited: code=${code} signal=${signal}\n`)
      logStream.end()

      if (this.isStopping) {
        // 主动停止，不重启
        this.status = 'stopped'
        logger.info('Sidecar stopped gracefully')
        return
      }

      // 异常退出，尝试重启
      this.status = 'error'
      logger.error('Sidecar exited unexpectedly', { code, signal, restartCount: this.restartCount })

      if (this.restartCount < MAX_RESTART_COUNT) {
        this.restartCount++
        logger.info(`Auto-restarting in ${RESTART_DELAY_MS}ms (attempt ${this.restartCount})`)
        setTimeout(() => {
          this.start().catch((err) => {
            logger.error('Auto-restart failed', err)
          })
        }, RESTART_DELAY_MS)
      } else {
        logger.error('Max restart count reached, giving up')
      }
    })

    this.process.on('error', (err) => {
      logStream.write(`[error] ${err.message}\n`)
      logStream.end()
      this.status = 'error'
      logger.error('Sidecar process error', err)
    })

    // 等待服务就绪
    try {
      await this.waitForHealth()
      this.status = 'running'
      this.restartCount = 0
      logger.info('Python Sidecar is ready')
    } catch (err) {
      this.status = 'error'
      logger.error('Sidecar failed to become healthy', err)
      throw err
    }
  }

  async stop(): Promise<void> {
    this.isStopping = true

    if (!this.process) {
      this.status = 'stopped'
      return
    }

    logger.info('Stopping Python Sidecar...')

    // Windows 下使用 taskkill 确保子进程树被终止
    if (process.platform === 'win32' && this.process.pid) {
      try {
        spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      } catch (err) {
        logger.error('taskkill failed', err)
      }
    } else {
      this.process.kill('SIGTERM')
      // 3 秒后强制 kill
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 3000)
    }

    // 等待进程退出
    await new Promise<void>((resolve) => {
      if (!this.process) {
        resolve()
        return
      }
      const proc = this.process
      const onExit = (): void => resolve()
      proc.once('exit', onExit)
      // 超时保护
      setTimeout(() => {
        proc.removeListener('exit', onExit)
        resolve()
      }, 5000)
    })

    this.process = null
    this.status = 'stopped'
    logger.info('Python Sidecar stopped')
  }

  async restart(): Promise<void> {
    logger.info('Restarting Python Sidecar...')
    await this.stop()
    this.isStopping = false
    this.restartCount = 0
    await this.start()
  }

  // --------------------------------------------------------
  // 内部方法
  // --------------------------------------------------------

  /**
   * 查找三个空闲端口
   * 策略：优先使用默认端口，被占用则向上递增
   */
  private async findFreePorts(): Promise<SidecarPorts> {
    const daemon = await this.findFreePort(DEFAULT_PORTS.daemon)
    const embedding = await this.findFreePort(DEFAULT_PORTS.embedding)
    const collector = await this.findFreePort(DEFAULT_PORTS.collector)
    return { daemon, embedding, collector }
  }

  /** 检查指定端口是否空闲，空闲返回该端口，否则递增 */
  private findFreePort(startPort: number): Promise<number> {
    return new Promise((resolve) => {
      const tryPort = (port: number): void => {
        const tester = net.createServer()
        tester.once('error', () => {
          tryPort(port + 1)
        })
        tester.once('listening', () => {
          tester.close(() => resolve(port))
        })
        tester.listen(port, '127.0.0.1')
      }
      tryPort(startPort)
    })
  }

  /**
   * 解析 Sidecar 可执行文件路径
   *
   * 生产模式（无 VITE_DEV_SERVER_URL）：
   *   resources/v9-python-sidecar/v9-python-sidecar.exe
   *
   * 开发模式（VITE_DEV_SERVER_URL 已设置）：
   *   python backend/sidecar_entry.py --daemon-port 8765 ...
   */
  private resolveSidecarPath(): {
    exe: string
    args: string[]
    cwd: string
    env: Record<string, string>
  } {
    const env: Record<string, string> = {
      SIDECAR_DAEMON_PORT: String(this.ports.daemon),
      SIDECAR_EMBEDDING_PORT: String(this.ports.embedding),
      SIDECAR_COLLECTOR_PORT: String(this.ports.collector),
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
    }

    // 开发模式：VITE_DEV_SERVER_URL 已设置时，直接使用 Python 解释器运行源码
    if (process.env.VITE_DEV_SERVER_URL) {
      // __dirname 在编译后是 dist-electron/，项目根目录是其父目录
      const projectRoot = path.resolve(__dirname, '..')
      const pythonExe = process.env.V9_PYTHON_EXE ?? 'python'
      const entryScript = path.join(projectRoot, 'backend', 'sidecar_entry.py')

      logger.info('[Sidecar Path] Development mode path resolution', {
        mode: 'development',
        VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
        V9_PYTHON_EXE: process.env.V9_PYTHON_EXE,
        __dirname,
        projectRoot,
        pythonExe,
        entryScript,
        entryScriptExists: fs.existsSync(entryScript),
      })

      return {
        exe: pythonExe,
        args: [
          entryScript,
          '--daemon-port', String(this.ports.daemon),
          '--embedding-port', String(this.ports.embedding),
          '--collector-port', String(this.ports.collector),
        ],
        cwd: projectRoot,
        env,
      }
    }

    // 生产模式：使用 PyInstaller 打包的 exe
    const resourcePath = process.resourcesPath
    const sidecarDir = path.join(resourcePath, 'v9-python-sidecar')
    const exeName =
      process.platform === 'win32' ? 'v9-python-sidecar.exe' : 'v9-python-sidecar'
    const exe = path.join(sidecarDir, exeName)

    logger.info('[Sidecar Path] Production mode path resolution', {
      mode: 'production',
      resourcesPath: resourcePath,
      sidecarDir,
      exe,
      exeExists: fs.existsSync(exe),
    })

    return {
      exe,
      args: [
        '--daemon-port', String(this.ports.daemon),
        '--embedding-port', String(this.ports.embedding),
        '--collector-port', String(this.ports.collector),
      ],
      cwd: sidecarDir,
      env,
    }
  }

  /**
   * 轮询健康检查端点，等待 Sidecar 服务就绪
   */
  private async waitForHealth(): Promise<void> {
    const startTime = Date.now()
    const healthUrl = `http://127.0.0.1:${this.ports.embedding}/api/embed/health`

    logger.info(`Waiting for sidecar health at ${healthUrl}...`)

    while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(healthUrl, { signal: controller.signal })
        clearTimeout(timeout)

        if (res.ok) {
          const data = (await res.json()) as { status: string }
          if (data.status === 'ok' || data.status === 'ready') {
            logger.info('Sidecar health check passed')
            return
          }
        }
      } catch {
        // 服务尚未启动，继续轮询
      }

      await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS))
    }

    throw new Error(
      `Sidecar health check timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`
    )
  }
}
