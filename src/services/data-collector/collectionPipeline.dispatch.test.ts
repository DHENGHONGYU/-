/**
 * @fileoverview collectionPipeline dispatch 完整性回归测试
 *
 * 2026-08-21 接线修复（维度 10-14 恒报「未知采集模式」）的防回归护栏：
 * DIMENSION_TO_MODE 中每个已配置维度的 mode 必须存在 dispatch 分支。
 * 若未来新增维度只配 mode 不接 dispatch，本测试立即失败。
 */

import { describe, it, expect } from 'vitest'
import { resolveDimensionMode, NON_QUOTE_MODES } from './collectionPipeline'
import { DEFAULT_DIMENSIONS } from '@/config/collectConfig'

/** runSingleTraceImpl 中实际存在分支的 mode 全集 */
const DISPATCHED_MODES: ReadonlySet<string> = new Set([
  'quote',
  'kline',
  'financial',
  ...NON_QUOTE_MODES,
])

describe('collectionPipeline dispatch 完整性（2026-08-21 接线修复回归）', () => {
  it('所有已配置维度的 mode 都必须有 dispatch 分支，不得落入「未知采集模式」', () => {
    for (const dim of DEFAULT_DIMENSIONS) {
      const mode = resolveDimensionMode(dim.code)
      expect(
        DISPATCHED_MODES.has(mode),
        `维度 ${dim.code}（${dim.name}）mode=${mode} 无 dispatch 分支`,
      ).toBe(true)
    }
  })

  it('维度 10-16（P0/P1 新增维度）全部走 handleNonQuoteMode', () => {
    for (const code of ['10', '11', '12', '13', '14', '15', '16']) {
      const mode = resolveDimensionMode(code)
      expect(
        NON_QUOTE_MODES.has(mode),
        `维度 ${code} mode=${mode} 未纳入 NON_QUOTE_MODES`,
      ).toBe(true)
    }
  })
})
