"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const sidecar_1 = require("./sidecar");
const proxy_1 = require("./proxy");
const logger_1 = require("./logger");
function safeWriteFileSync(filePath, data, options = 'utf-8') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data, options);
}
const logger = (0, logger_1.getLogger)('main');
let mainWindow = null;
let sidecar = null;
let tray = null;
function createWindow() {
    logger.info('Creating main window...');
    mainWindow = new electron_1.BrowserWindow({
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
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        logger.info('Loading from Vite dev server...', { url: process.env.VITE_DEV_SERVER_URL });
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
        logger.info('Loading from file...', { path: indexPath });
        mainWindow.loadFile(indexPath);
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
            event.preventDefault();
        }
    });
}
function createTray() {
    const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');
    let icon;
    if (fs.existsSync(iconPath)) {
        icon = electron_1.nativeImage.createFromPath(iconPath);
    }
    else {
        icon = electron_1.nativeImage.createEmpty();
    }
    tray = new electron_1.Tray(icon);
    tray.setToolTip('FinSightV9');
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized())
                        mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                }
                else {
                    createWindow();
                }
            },
        },
        {
            label: 'Sidecar 状态',
            click: async () => {
                if (sidecar) {
                    const health = await sidecar.getHealth();
                    logger.info('Sidecar health', health);
                }
            },
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            }
            else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
        else {
            createWindow();
        }
    });
}
function registerIpcHandlers() {
    electron_1.ipcMain.handle('sidecar:status', () => {
        return sidecar?.getStatus() ?? 'stopped';
    });
    electron_1.ipcMain.handle('sidecar:health', async () => {
        if (!sidecar)
            return { status: 'stopped', embeddingLoaded: false, modelId: '', ports: null };
        return sidecar.getHealth();
    });
    electron_1.ipcMain.handle('sidecar:restart', async () => {
        if (!sidecar)
            return { success: false, error: 'Sidecar not initialized' };
        try {
            await sidecar.restart();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    electron_1.ipcMain.handle('sidecar:ports', () => {
        return sidecar?.getPorts() ?? null;
    });
    function resolveSafeRootDir(requestRoot) {
        const projectRoot = path.resolve(__dirname, '..');
        const resolved = path.isAbsolute(requestRoot)
            ? requestRoot
            : path.join(projectRoot, requestRoot);
        const normalized = path.normalize(resolved);
        const safeOutputRoot = path.normalize(path.join(projectRoot, 'outputs'));
        if (normalized.startsWith(safeOutputRoot) || normalized.includes(`${path.sep}outputs${path.sep}`)) {
            return normalized;
        }
        return path.join(safeOutputRoot, path.basename(normalized));
    }
    electron_1.ipcMain.handle('fileSync:writeFiles', async (_event, params) => {
        const { rootDir, files } = params;
        if (!Array.isArray(files) || files.length === 0) {
            return { success: false, rootDir, writtenCount: 0, error: '文件列表为空' };
        }
        try {
            const safeRoot = resolveSafeRootDir(rootDir);
            logger.info('[fileSync:writeFiles] 开始写入', {
                requestedRoot: rootDir,
                safeRoot,
                fileCount: files.length,
            });
            let written = 0;
            for (const f of files) {
                const safeRelative = path.normalize(f.relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
                const fullPath = path.join(safeRoot, safeRelative);
                if (!path.normalize(fullPath).startsWith(safeRoot)) {
                    logger.warn('[fileSync:writeFiles] 跳过越权路径', { fullPath });
                    continue;
                }
                safeWriteFileSync(fullPath, f.content, 'utf-8');
                written++;
            }
            logger.info('[fileSync:writeFiles] 写入完成', { safeRoot, written });
            return { success: true, rootDir: safeRoot, writtenCount: written };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error('[fileSync:writeFiles] 写入失败', { error: msg });
            return { success: false, rootDir, writtenCount: 0, error: msg };
        }
    });
}
async function startSidecar() {
    logger.info('Starting Python Sidecar...');
    sidecar = new sidecar_1.PythonSidecar();
    try {
        await sidecar.start();
        logger.info('Python Sidecar started successfully');
    }
    catch (err) {
        logger.error('Failed to start Python Sidecar', err);
    }
}
async function stopSidecar() {
    if (sidecar) {
        logger.info('Stopping Python Sidecar...');
        await sidecar.stop();
        sidecar = null;
    }
}
electron_1.app.whenReady().then(async () => {
    const mode = process.env.VITE_DEV_SERVER_URL ? 'development' : 'production';
    logger.info('App ready, initializing...', {
        mode,
        VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL ?? '(not set)',
        V9_PYTHON_EXE: process.env.V9_PYTHON_EXE ?? '(not set)',
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        appPath: electron_1.app.getAppPath(),
    });
    registerIpcHandlers();
    if (!process.env.VITE_DEV_SERVER_URL) {
        logger.info('[Proxy] Production mode — creating Electron proxy handler');
        (0, proxy_1.createProxyHandler)(mainWindow);
    }
    else {
        logger.info('[Proxy] Development mode — Vite dev server handles proxy, skipping Electron proxy');
    }
    createWindow();
    createTray();
    startSidecar().catch((err) => {
        logger.error('Sidecar startup error', err);
    });
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', async (event) => {
    if (sidecar) {
        event.preventDefault();
        await stopSidecar();
        electron_1.app.quit();
    }
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
});
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
});
