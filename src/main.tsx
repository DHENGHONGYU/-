import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLogLevel, getLogger } from '@/lib/logger'
import App from './App'
import { installGlobalErrorHandler } from '@/components/organisms/shared/installGlobalErrorHandler'
// 提前导入并初始化 themeStore，确保在 React 首屏渲染前应用持久化主题
import { useThemeStore } from '@/store/themeStore'
import { verifyDesignTokensOnReady } from '@/lib/designTokenVerifier'
import './index.css'

// V5 Apple Business Design Tokens 加载验证（仅开发环境，生产构建 tree-shake 移除）
verifyDesignTokensOnReady()

useThemeStore.getState()

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const LOG_LEVEL = (import.meta.env.VITE_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'

setLogLevel(LOG_LEVEL)

const logger = getLogger()

async function bootstrap(): Promise<void> {
  try {
    logger.info('[main] 开始应用启动流程')

    installGlobalErrorHandler()

    const { setStrategyAnalyzers } = await import('@/core/databridgeStrategyRouter')
    const { setFeedbackServices } = await import('@/core/feedbackOrchestrator')
    const { setPipelineServices } = await import('@/core/pipelineScheduler')
    const { setScoreTriggerServices, scoreAutoTrigger } = await import('@/services/scoring/scoreAutoTrigger')
    const { setIndustryAnalysisServices } = await import('@/services/scoring/v6ScoreService')
    const {
      runFullIndustryAnalysis,
      getStockIndustryV4Analysis,
      invalidateIndustryCache,
      v4ToIndustryScoreData,
      runFullIndustryAnalysisEnhanced,
      getStockIndustryV4AnalysisEnhanced,
    } = await import('@/services/analysis/industryAnalysisService')

    const { analyze: analyzeHotSector } = await import('@/services/scoring/hotSectorAnalyzer')
    const { detect: detectRotation } = await import('@/services/scoring/rotationSignalDetector')
    const { analyze: analyzeValuePit } = await import('@/services/scoring/valuePitAnalyzer')
    const { runV6Score, getV6ScoreQuality } = await import('@/services/scoring/v6ScoreService')
    const { fetchStockBasic, fetchStockKline, fetchFinancial } = await import('@/services/fetcher/fetcherService')

    setStrategyAnalyzers({
      analyzeHotSector,
      detectRotation,
      analyzeValuePit,
    })

    setFeedbackServices({
      runV6Score,
      getV6ScoreQuality,
      fetchStockBasic,
      fetchStockKline,
      fetchFinancial,
    })

    setPipelineServices({
      runV6Score,
    })

    setScoreTriggerServices({ runV6Score })
    scoreAutoTrigger.start()

    // v2.9.0: 行业分析服务注入
    setIndustryAnalysisServices({
      runFullIndustryAnalysis,
      getStockIndustryV4Analysis,
      invalidateIndustryCache,
      v4ToIndustryScoreData,
      // v2.9.5 增强版
      runFullIndustryAnalysisEnhanced,
      getStockIndustryV4AnalysisEnhanced,
    })

    logger.info('[main] Core 层服务注册完成')

    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Root element not found')
    }

    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    logger.info('[main] 应用启动完成')
  } catch (error) {
    logger.error('[main] 应用启动失败', { error })
    throw error
  }
}

void bootstrap()
