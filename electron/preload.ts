/**
 * Electron 预加载脚本
 *
 * 在渲染进程加载前执行，建立安全的 IPC 桥梁
 * 通过 contextBridge 暴露受限的 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron'

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

// 暴露到渲染进程的 API
contextBridge.exposeInMainWorld('sidecar', sidecarAPI)
contextBridge.exposeInMainWorld('fileSync', fileSyncAPI)

// 类型声明（供渲染进程使用）
export type SidecarAPI = typeof sidecarAPI
export type FileSyncAPI = typeof fileSyncAPI
