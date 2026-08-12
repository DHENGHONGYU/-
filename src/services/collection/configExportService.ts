/**
 * @module configExportService
 * @description 配置模板导出/导入服务
 *
 * 提供配置模板的 JSON 格式导出与导入功能，支持：
 * - 单配置导出（生成包含元数据的 JSON 文件）
 * - JSON 文件导入（校验格式版本、重名检测）
 * - 浏览器端文件下载
 *
 * 导出文件格式：
 * {
 *   "meta": { "exportVersion": "1.0", "exportedAt": 1234567890, "sourceName": "高频行情监控" },
 *   "config": { ...PersistedWizardConfig }
 * }
  * @doc [V9-DOC-BACK-012, V9-DOC-DATA-047, V9-DOC-BACK-021, V9-DOC-DATA-068, V9-DOC-FRONT-020]
*/

import { getLogger } from '@/lib/logger'
import type { PersistedWizardConfig, ExportedConfigFile, ConfigExportMeta } from '@/types/modules/collection.types'
import { validateConfigName } from '@/lib/validation'

const logger = getLogger()

const EXPORT_VERSION = '1.0'

/**
 * 将配置转换为导出文件结构
 */
export function buildExportFile(config: PersistedWizardConfig): ExportedConfigFile {
  const meta: ConfigExportMeta = {
    exportVersion: EXPORT_VERSION,
    exportedAt: Date.now(),
    sourceName: config.name,
  }
  return { meta, config }
}

/**
 * 将配置导出为 JSON Blob
 */
export function exportConfigToJSON(config: PersistedWizardConfig): Blob {
  const exportFile = buildExportFile(config)
  const jsonString = JSON.stringify(exportFile, null, 2)
  return new Blob([jsonString], { type: 'application/json' })
}

/**
 * 从文件解析导出的配置
 */
export async function importConfigFromJSON(file: File): Promise<ExportedConfigFile> {
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as ExportedConfigFile
    
    if (!parsed.meta || !parsed.config) {
      throw new Error('导入文件格式不正确')
    }
    
    if (parsed.meta.exportVersion !== EXPORT_VERSION) {
      logger.warn('[configExportService] 导入配置版本不匹配', {
        fileVersion: parsed.meta.exportVersion,
        currentVersion: EXPORT_VERSION,
      })
    }
    
    return parsed
  } catch (err) {
    logger.error('[configExportService] 导入配置解析失败', { error: err })
    throw new Error('导入文件解析失败')
  }
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(config: PersistedWizardConfig): string {
  const name = config.name.replace(/[\\/:*?"<>|]/g, '_')
  const date = new Date().toISOString().split('T')[0]
  return `${name}_config_${date}.json`
}

/**
 * 触发浏览器下载文件
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 导出配置并自动下载
 */
export function exportAndDownloadConfig(config: PersistedWizardConfig): void {
  logger.info('[configExportService] 导出配置', {
    configId: config.id,
    name: config.name,
    format: 'json',
    version: EXPORT_VERSION,
  })
  
  const blob = exportConfigToJSON(config)
  const filename = generateExportFilename(config)
  downloadBlob(blob, filename)
}

/**
 * 导入配置前的校验
 * @returns { ok: true } 或 { ok: false, error: string }
 */
export function validateImportedConfig(
  config: PersistedWizardConfig,
  existingNames: string[],
): { ok: true } | { ok: false; error: string } {
  const nameValidation = validateConfigName(config.name)
  if (!nameValidation.valid) {
    return { ok: false, error: nameValidation.error ?? '名称校验失败' }
  }
  
  if (existingNames.includes(config.name)) {
    return { ok: false, error: `配置名称 "${config.name}" 已存在` }
  }
  
  return { ok: true }
}
