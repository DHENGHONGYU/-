/**
 * Electron 主进程入口
 *
 * 方案B: Electron + 本地 Python Sidecar
 *
 * 职责：
 * - 创建 BrowserWindow 并加载前端应用
 * - 启动/停止 Python Sidecar
 * - 注册 IPC 处理器
 * - 系统托盘
 * - 应用生命周期管理
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { PythonSidecar } from './sidecar'
import { createProxyHandler } from './proxy'
import { WestockHost } from './westockHost'
import { TencentNewsHost } from './tencentNewsHost'
import { getLogger } from './logger'

/** 安全写入文件：自动创建父目录，避免 ENOENT */
function safeWriteFileSync(filePath: string, data: string | NodeJS.ArrayBufferView, options: fs.WriteFileOptions = 'utf-8'): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, data, options)
}

const logger = getLogger('main')

// ============================================================
// 全局状态
// ============================================================

let mainWindow: BrowserWindow | null = null
let sidecar: PythonSidecar | null = null
let westockHost: WestockHost | null = null
let tencentNewsHost: TencentNewsHost | null = null
let tray: Tray | null = null

// ============================================================
// 窗口创建
// ============================================================

function createWindow(): void {
  logger.info('Creating main window...')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'FinSightV9 智能投研复盘系统',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 开发模式加载 Vite dev server，生产模式加载打包文件
  if (process.env.VITE_DEV_SERVER_URL) {
    logger.info('Loading from Vite dev server...', { url: process.env.VITE_DEV_SERVER_URL })
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
    logger.info('Loading from file...', { path: indexPath })
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 阻止导航到外部域名
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault()
    }
  })
}

// ============================================================
// 系统托盘
// ============================================================

function createTray(): void {
  // 使用 16x16 透明图标
  const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png')
  let icon: Electron.NativeImage
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('FinSightV9')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: (): void => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    {
      label: 'Sidecar 状态',
      click: async (): Promise<void> => {
        if (sidecar) {
          const health = await sidecar.getHealth()
          logger.info('Sidecar health', health)
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: (): void => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    } else {
      createWindow()
    }
  })
}

// ============================================================
// IPC 处理器
// ============================================================

function registerIpcHandlers(): void {
  // 获取 Sidecar 状态
  ipcMain.handle('sidecar:status', () => {
    return sidecar?.getStatus() ?? 'stopped'
  })

  // 获取 Sidecar 健康
  ipcMain.handle('sidecar:health', async () => {
    if (!sidecar) return { status: 'stopped', embeddingLoaded: false, modelId: '', ports: null }
    return sidecar.getHealth()
  })

  // 重启 Sidecar
  ipcMain.handle('sidecar:restart', async () => {
    if (!sidecar) return { success: false, error: 'Sidecar not initialized' }
    try {
      await sidecar.restart()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 获取 Sidecar 端口
  ipcMain.handle('sidecar:ports', () => {
    return sidecar?.getPorts() ?? null
  })

  // ============================================================
  // 腾讯自选股 CLI 宿主（Electron main 承载，渲染进程经 IPC 调用）
  // ============================================================
  ipcMain.handle('westock:invoke', (_event, command: string, args: string) => {
    if (!westockHost) return Promise.reject(new Error('WestockHost 未初始化'))
    return westockHost.invoke(command, args)
  })
  ipcMain.handle('westock:health', () => {
    return westockHost?.getHealth() ?? { available: false, bin: '', note: '未初始化' }
  })

  // ============================================================
  // 腾讯新闻 CLI 宿主（Electron main 承载，渲染进程经 IPC 调用）
  // ============================================================
  ipcMain.handle('tencentnews:invoke', (_event, command: string, args: string) => {
    if (!tencentNewsHost) return Promise.reject(new Error('TencentNewsHost 未初始化'))
    return tencentNewsHost.invoke(command, args)
  })
  ipcMain.handle('tencentnews:health', () => {
    return tencentNewsHost?.getHealth() ?? { available: false, bin: '', note: '未初始化' }
  })

  // ============================================================
  // 文件同步 IPC：采集资料写入本地文件夹
  // ============================================================

  // 安全根目录白名单：只允许写入项目根下的 outputs/ 目录或绝对路径下的 outputs/
  function resolveSafeRootDir(requestRoot: string): string {
    const projectRoot = path.resolve(__dirname, '..')
    // 如果请求路径相对，基于项目根解析
    const resolved = path.isAbsolute(requestRoot)
      ? requestRoot
      : path.join(projectRoot, requestRoot)
    // 规范化并确保在安全边界内
    const normalized = path.normalize(resolved)
    const safeOutputRoot = path.normalize(path.join(projectRoot, 'outputs'))
    // 允许项目根 outputs/ 目录；若用户指定其他绝对路径需包含 /outputs/ 段
    if (normalized.startsWith(safeOutputRoot) || normalized.includes(`${path.sep}outputs${path.sep}`)) {
      return normalized
    }
    // 兜底：强制放到项目 outputs/ 下，防止越权写入
    return path.join(safeOutputRoot, path.basename(normalized))
  }

  ipcMain.handle(
    'fileSync:writeFiles',
    async (
      _event,
      params: {
        rootDir: string
        files: Array<{ relativePath: string; content: string }>
      },
    ): Promise<{ success: boolean; rootDir: string; writtenCount: number; error?: string }> => {
      const { rootDir, files } = params
      if (!Array.isArray(files) || files.length === 0) {
        return { success: false, rootDir, writtenCount: 0, error: '文件列表为空' }
      }
      try {
        const safeRoot = resolveSafeRootDir(rootDir)
        logger.info('[fileSync:writeFiles] 开始写入', {
          requestedRoot: rootDir,
          safeRoot,
          fileCount: files.length,
        })
        let written = 0
        for (const f of files) {
          // 防止路径穿越（例如 ../../etc/passwd）
          const safeRelative = path.normalize(f.relativePath).replace(/^(\.\.(\/|\\|$))+/, '')
          const fullPath = path.join(safeRoot, safeRelative)
          // 二次校验：最终路径仍在 safeRoot 之下
          if (!path.normalize(fullPath).startsWith(safeRoot)) {
            logger.warn('[fileSync:writeFiles] 跳过越权路径', { fullPath })
            continue
          }
          safeWriteFileSync(fullPath, f.content, 'utf-8')
          written++
        }
        logger.info('[fileSync:writeFiles] 写入完成', { safeRoot, written })
        return { success: true, rootDir: safeRoot, writtenCount: written }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('[fileSync:writeFiles] 写入失败', { error: msg })
        return { success: false, rootDir, writtenCount: 0, error: msg }
      }
    },
  )
}

// ============================================================
// 应用生命周期
// ============================================================

async function startSidecar(): Promise<void> {
  logger.info('Starting Python Sidecar...')
  sidecar = new PythonSidecar()
  try {
    await sidecar.start()
    logger.info('Python Sidecar started successfully')
  } catch (err) {
    logger.error('Failed to start Python Sidecar', err)
    // 不阻止应用启动，用户可以稍后重启 Sidecar
  }
}

async function stopSidecar(): Promise<void> {
  if (sidecar) {
    logger.info('Stopping Python Sidecar...')
    await sidecar.stop()
    sidecar = null
  }
}

app.whenReady().then(async () => {
  const mode = process.env.VITE_DEV_SERVER_URL ? 'development' : 'production'
  logger.info('App ready, initializing...', {
    mode,
    VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL ?? '(not set)',
    V9_PYTHON_EXE: process.env.V9_PYTHON_EXE ?? '(not set)',
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    appPath: app.getAppPath(),
  })

  // 注册 IPC 处理器
  registerIpcHandlers()

  // 设置 API 代理（开发模式下由 Vite 处理，生产模式下由 Electron 处理）
  if (!process.env.VITE_DEV_SERVER_URL) {
    logger.info('[Proxy] Production mode — creating Electron proxy handler')
    createProxyHandler(mainWindow)
  } else {
    logger.info('[Proxy] Development mode — Vite dev server handles proxy, skipping Electron proxy')
  }

  // 创建窗口
  createWindow()

  // 创建托盘
  createTray()

  // 启动 Sidecar（异步，不阻塞窗口显示）
  startSidecar().catch((err) => {
    logger.error('Sidecar startup error', err)
  })

  // 启动腾讯自选股 CLI 宿主（异步，不阻塞窗口显示；CLI 不可用时采集舱自动降级）
  westockHost = new WestockHost()
  westockHost.init().catch((err) => {
    logger.error('WestockHost init error', err)
  })

  // 启动腾讯新闻 CLI 宿主（异步，不阻塞窗口显示；CLI 不可用时采集舱自动降级）
  tencentNewsHost = new TencentNewsHost()
  tencentNewsHost.init().catch((err) => {
    logger.error('TencentNewsHost init error', err)
  })
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  // macOS 上不退出，其他平台退出
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  if (sidecar) {
    event.preventDefault()
    await stopSidecar()
    app.quit()
  }
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) })
})
