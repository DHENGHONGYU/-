/**
 * 指标模块索引
 * 统一导出所有技术指标计算引擎
 */

export { computeEMA, computeMultiEMA, EMA_COLORS, DEFAULT_EMA_PERIODS } from './ema'
export type { EMAParams, EMAResult } from './ema'

export { computeBollinger, BOLL_COLORS, DEFAULT_BOLL_PARAMS } from './bollinger'
export type { BollingerParams, BollingerResult } from './bollinger'

export { computeRSI, RSI_COLORS, DEFAULT_RSI_PARAMS } from './rsi'
export type { RSIParams, RSIResult } from './rsi'

export { computeMACD, getLatestMACD, MACD_COLORS } from './macd'
export type { MACDParams, MACDResult } from './macd'

export { computeKDJ, getLatestKDJ, KDJ_COLORS } from './kdj'
export type { KDJParams, KDJResult } from './kdj'

export { downsampleCandlestick, downsampleLineData, getAdaptiveTargetPoints, DEFAULT_DOWNSAMPLE_CONFIG } from './downsample'
export type { DownsampleConfig } from './downsample'

export { computeVolumeProfile, VOLUME_PROFILE_COLORS, DEFAULT_VOLUME_PROFILE_PARAMS } from './volumeProfile'
export type { VolumeProfileParams, VolumeProfileResult, VolumeProfileBar } from './volumeProfile'