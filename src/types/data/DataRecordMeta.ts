/**
 * @module DataRecordMeta
 * @description 数据记录元数据
 *
 * 附加到每条数据记录上的元信息，用于标识数据来源、可靠性等级与采集上下文。
 * 被 MockDataBadge、APISchemaValidator、CrossSourceValidation 等模块消费。
 *
 * @doc V9-DOC-QUALITY-003
 */

/** 数据记录元数据 */
export interface DataRecordMeta {
  /** 数据来源标识（如 'tencent'、'sina'、'tushare'、'mock' 等） */
  source?: string

  /** 是否为 Mock（模拟）数据 */
  isMock?: boolean

  /** 数据可靠性等级 */
  reliability: 'real' | 'mock' | 'degraded'

  /** Mock 数据的原因说明（当 isMock 为 true 或 reliability 为 'mock' 时填写） */
  mockReason?: string

  /** 数据采集时间戳（毫秒） */
  collectedAt?: number

  /** 输入数据版本号 */
  dataVersion?: number
}
