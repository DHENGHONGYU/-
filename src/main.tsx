import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLogLevel, getLogger } from '@/lib/logger'
import App from './App'
import { installGlobalErrorHandler } from '@/components/organisms/shared/installGlobalErrorHandler'
import './index.css'
import './generated/tokens.css'

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

bootstrap()
