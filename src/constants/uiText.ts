/**
 * @fileoverview UI 文本常量（barrel re-export）
 *
 * 原单文件 uiText.ts（1192 行），现拆分为 6 个子模块，本文件作为统一入口。
 *
 * 拆分结构（2026-07-07）：
 * - uiText/uiText.common.ts: 通用 UI 文本（loading/error/confirm 等）
 * - uiText/uiText.analysis.ts: 分析舱业务域（回测/评分/资讯/行业/因子等）
 * - uiText/uiText.input.ts: 输入舱业务域（数据采集/导入/测试/知识库）
 * - uiText/uiText.trading.ts: 交易舱业务域（持仓/策略）
 * - uiText/uiText.cockpit.ts: 驾驶舱业务域（舱室名称/复盘/交易分析）
 * - uiText/uiText.errors.ts: 错误消息（网络/验证/输入/回测/评分等）
 * - uiText.ts（本文件）: barrel re-export，保持原 API 兼容
 *
 * 使用方式：
 * import { UI_TEXT } from '@/constants/uiText'
 * <span>{UI_TEXT.common.loading}</span>
 *
 * @module constants/uiText
 * @updated 2026-07-07 - 拆分为多模块，保持原 API 兼容
  * @doc []
*/

import { common } from './uiText/uiText.common'
import { analysis } from './uiText/uiText.analysis'
import { input } from './uiText/uiText.input'
import { trading } from './uiText/uiText.trading'
import { cockpit } from './uiText/uiText.cockpit'
import { errors } from './uiText/uiText.errors'

export const UI_TEXT = {
  common,
  analysis,
  input,
  trading,
  cockpit,
  errors,
} as const

export type UiTextKey = typeof UI_TEXT
