/**
 * localFilePersistService 单元测试
 *
 * 覆盖「采集即时落盘」全部分支（永不抛错契约）：
 *   - 总开关关闭 → config-disabled
 *   - 维度未登记 → dimension-unregistered
 *   - 无 window.fileSync（纯浏览器/测试环境）→ browser-env
 *   - Electron 环境写入成功 → written:true + 路径与信封内容断言
 *   - Electron 返回 success:false / 抛异常 → written:false 且不向上传播
 *   - 命名模板 {symbol}/{date}/{dimension} 占位符替换（经 resolveCollectionFilePath）
 *
 * @module localFilePersistService.test
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  persistCollectedDataToLocalFile,
  type LocalFilePersistInput,
} from '@/services/data-collector/localFilePersistService'
import {
  COLLECTION_FILE_STORAGE,
  resolveCollectionFilePath,
} from '@/config/collectionFileStorage'
import type { ElectronFileSyncAPI } from '@/services/data-collector/collectedDataSyncService'

// ============================================================
// Fixtures
// ============================================================

function makeInput(overrides: Partial<LocalFilePersistInput> = {}): LocalFilePersistInput {
  return {
    symbol: '600519.SH',
    dimensionCode: '10',
    data: { sectors: [{ name: '白酒', changePct: 2.3 }] },
    source: 'westock',
    collectedAt: Date.UTC(2026, 7, 22, 8, 0, 0), // 2026-08-22
    ...overrides,
  }
}

function installFileSyncMock(impl?: ElectronFileSyncAPI['writeFiles']): ReturnType<typeof vi.fn> {
  const writeFiles = vi.fn(async (params: { rootDir: string; files: Array<{ relativePath: string; content: string }> }) => ({
    success: true,
    rootDir: params.rootDir,
    writtenCount: params.files.length,
  }))
  window.fileSync = { writeFiles: impl ?? writeFiles }
  return writeFiles
}

afterEach(() => {
  delete window.fileSync
  vi.restoreAllMocks()
})

// ============================================================
// 分支覆盖
// ============================================================

describe('persistCollectedDataToLocalFile', () => {
  it('无 window.fileSync（浏览器环境）→ browser-env，不抛错', async () => {
    const result = await persistCollectedDataToLocalFile(makeInput())
    expect(result.written).toBe(false)
    expect(result.reason).toBe('browser-env')
  })

  it('维度未登记文件夹配置 → dimension-unregistered', async () => {
    installFileSyncMock()
    const result = await persistCollectedDataToLocalFile(makeInput({ dimensionCode: '99' }))
    expect(result.written).toBe(false)
    expect(result.reason).toBe('dimension-unregistered')
  })

  it('Electron 环境写入成功 → written:true，路径符合 {symbol}/{folder}/{file} 约定', async () => {
    const writeFiles = installFileSyncMock()
    const result = await persistCollectedDataToLocalFile(makeInput())

    expect(result.written).toBe(true)
    expect(result.path).toBe(
      'outputs/collected-data/600519.SH/10_热门板块/600519.SH_2026-08-22.json',
    )

    expect(writeFiles).toHaveBeenCalledTimes(1)
    const call = writeFiles.mock.calls[0]![0] as {
      rootDir: string
      files: Array<{ relativePath: string; content: string }>
    }
    expect(call.rootDir).toBe('outputs/collected-data')
    expect(call.files).toHaveLength(1)
    expect(call.files[0]!.relativePath).toBe('600519.SH/10_热门板块/600519.SH_2026-08-22.json')

    // 信封结构：_meta + data 同一份数据
    const envelope = JSON.parse(call.files[0]!.content) as {
      _meta: Record<string, unknown>
      data: { sectors: Array<{ name: string }> }
    }
    expect(envelope._meta['symbol']).toBe('600519.SH')
    expect(envelope._meta['dimensionCode']).toBe('10')
    expect(envelope._meta['source']).toBe('westock')
    expect(envelope._meta['version']).toBe('1.0.0')
    expect(envelope.data.sectors[0]!.name).toBe('白酒')
  })

  it('Electron 返回 success:false → written:false，不抛错', async () => {
    installFileSyncMock(async () => ({ success: false, rootDir: '', writtenCount: 0, error: 'disk full' }))
    const result = await persistCollectedDataToLocalFile(makeInput())
    expect(result.written).toBe(false)
    expect(result.reason).toBe('write-failed')
  })

  it('Electron 写入抛异常 → written:false，异常不向上传播', async () => {
    installFileSyncMock(async () => {
      throw new Error('ipc broken')
    })
    const result = await persistCollectedDataToLocalFile(makeInput())
    expect(result.written).toBe(false)
    expect(result.reason).toBe('write-failed')
  })

  it('总开关关闭 → config-disabled（16 维配置本身 enabled 也不写）', async () => {
    const original = COLLECTION_FILE_STORAGE.enabled
    try {
      ;(COLLECTION_FILE_STORAGE as { enabled: boolean }).enabled = false
      const writeFiles = installFileSyncMock()
      const result = await persistCollectedDataToLocalFile(makeInput())
      expect(result.written).toBe(false)
      expect(result.reason).toBe('config-disabled')
      expect(writeFiles).not.toHaveBeenCalled()
    } finally {
      ;(COLLECTION_FILE_STORAGE as { enabled: boolean }).enabled = original
    }
  })

  it('source 缺省时信封标记 unknown', async () => {
    const writeFiles = installFileSyncMock()
    await persistCollectedDataToLocalFile(makeInput({ source: undefined }))
    const call = writeFiles.mock.calls[0]![0] as { files: Array<{ content: string }> }
    const envelope = JSON.parse(call.files[0]!.content) as { _meta: Record<string, unknown> }
    expect(envelope._meta['source']).toBe('unknown')
  })
})

// ============================================================
// 配置层：文件夹接口
// ============================================================

describe('collectionFileStorage 配置接口', () => {
  it('16 个维度全部登记且默认启用（应采都采）', () => {
    const codes = Object.keys(COLLECTION_FILE_STORAGE.dimensions)
    expect(codes).toHaveLength(16)
    for (const code of codes) {
      const cfg = COLLECTION_FILE_STORAGE.dimensions[code]!
      expect(cfg.enabled).toBe(true)
      expect(cfg.folder).toMatch(/^\d{2}_/)
      expect(cfg.filePattern).toContain('{symbol}')
    }
  })

  it('resolveCollectionFilePath 替换 {symbol}/{date}/{dimension} 占位符', () => {
    const at = Date.UTC(2026, 7, 22)
    const resolved = resolveCollectionFilePath('02', '000001.SZ', at)
    expect(resolved).not.toBeNull()
    expect(resolved!.rootDir).toBe('outputs/collected-data')
    expect(resolved!.relativePath).toBe('000001.SZ/02_K线数据/000001.SZ_2026-08-22.json')
  })

  it('未知维度 → null（禁止兜底硬编码路径）', () => {
    expect(resolveCollectionFilePath('99', '000001.SZ')).toBeNull()
  })
})
