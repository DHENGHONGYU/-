/**
 * Electron 预加载脚本
 *
 * 在渲染进程加载前执行，建立安全的 IPC 桥梁
 * 通过 contextBridge 暴露受限的 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { WestockHealth } from './westockHost'
import type { TencentNewsHealth } from './tencentNewsHost'

// ============================================================
// 安全 IPC 桥梁
// ============================================================

const sidecarAPI = {
  getStatus: (): Promise<string> => ipcRenderer.invoke('sidecar:status'),
  getHealth: (): Promise<{
    status: string
    embeddingLoaded: boolean
    modelId: string
    ports: { daemon: number; embedding: number; collector: number } | null
  }> => ipcRenderer.invoke('sidecar:health'),
  restart: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('sidecar:restart'),
  getPorts: (): Promise<{
    daemon: number
    embedding: number
    collector: number
  } | null> => ipcRenderer.invoke('sidecar:ports'),
}

/** 文件同步 IPC：采集资料写入本地文件夹 */
const fileSyncAPI = {
  writeFiles: (params: {
    rootDir: string
    files: Array<{ relativePath: string; content: string }>
  }): Promise<{ success: boolean; rootDir: string; writtenCount: number; error?: string }> =>
    ipcRenderer.invoke('fileSync:writeFiles', params),
}

/** 腾讯自选股 CLI 宿主（Electron main 承载，渲染进程经 IPC 调用） */
const westockAPI = {
  invoke: (command: string, args: string): Promise<string> =>
    ipcRenderer.invoke('westock:invoke', command, args),
  health: (): Promise<WestockHealth> => ipcRenderer.invoke('westock:health'),
}

/** 腾讯新闻 CLI 宿主（Electron main 承载，渲染进程经 IPC 调用） */
const tencentNewsAPI = {
  invoke: (command: string, args: string): Promise<string> =>
    ipcRenderer.invoke('tencentnews:invoke', command, args),
  health: (): Promise<TencentNewsHealth> => ipcRenderer.invoke('tencentnews:health'),
}

// 暴露到渲染进程的 API
contextBridge.exposeInMainWorld('sidecar', sidecarAPI)
contextBridge.exposeInMainWorld('fileSync', fileSyncAPI)
contextBridge.exposeInMainWorld('westock', westockAPI)
contextBridge.exposeInMainWorld('tencentnews', tencentNewsAPI)

// 类型声明（供渲染进程使用）
export type SidecarAPI = typeof sidecarAPI
export type FileSyncAPI = typeof fileSyncAPI
export type WestockAPI = typeof westockAPI
export type TencentNewsAPI = typeof tencentNewsAPI
