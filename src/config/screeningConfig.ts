/**
 * 筛选引擎配置
 *
 * 集中管理 candidate → screened → deepDive 的晋升阈值，禁止在引擎内部硬编码。
 */

export interface ScreeningThresholds {
  /**
   * candidate → screened 的最低 V6 综合分（0-5）
   */
  minV6ScoreForScreened: number
  /**
   * screened → deepDive 的最低 V6 综合分（0-5）
   */
  minV6ScoreForDeepDive: number
  /**
   * screened → deepDive 的最低 LLM 智能评分（0-100）
   *
   * V6 分或 LLM 分任一满足即可晋升 deepDive。
   */
  minIntelligentScoreForDeepDive: number
  /**
   * 晋升 screened 是否要求基础数据已采集
   */
  requireBasicForScreened: boolean
  /**
   * 晋升 screened 是否要求 K线数据已采集
   */
  requireKlineForScreened: boolean
  /**
   * 晋升 deepDive 是否要求财务数据已采集
   */
  requireFinanceForDeepDive: boolean
}

export interface ScreeningConfig {
  version: string
  thresholds: ScreeningThresholds
}

export function getDefaultScreeningConfig(): ScreeningConfig {
  return {
    version: '1.2.0',
    thresholds: {
      minV6ScoreForScreened: 3.0,
      minV6ScoreForDeepDive: 4.0,
      minIntelligentScoreForDeepDive: 70,
      requireBasicForScreened: true,
      requireKlineForScreened: true,
      requireFinanceForDeepDive: true,
    },
  }
}
