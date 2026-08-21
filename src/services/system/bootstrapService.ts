/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { dataBridge } from '@/core/databridge'
import { initPWA } from '@/services/pwa/registerServiceWorker'
import { permissionRevocationService } from '@/services/rbac/permissionRevocationService'
import { seedDefaultStocks } from '@/services/system/seedService'
import { getLogger } from '@/lib/logger'
import { initOrchestration, stopOrchestration, getOrchestratorHealth } from '@/services/orchestration'
import { isLlmApiKeyConfigured } from '@/config/llmConfig'
import {
  isTushareTokenConfigured,
  isQwenApiKeyConfigured,
  isTushareTokenExpired,
  isQwenApiKeyExpired,
  getTushareTokenAgeDays,
  getQwenApiKeyAgeDays,
  type SecretHealthItem,
} from '@/config/secretConfig'

const logger = getLogger()

const MAX_SEED_RETRIES = 2
const SEED_RETRY_BASE_DELAY_MS = 500

export interface BootstrapHooks {
  onSeedFailure?: (error: string, retries: number) => void
  onOrchestrationFailure?: (error: string) => void
  onDataBridgeInitFailure?: (error: string) => void
}

export interface InitOptions {
  useMemoryFallback?: boolean
  hooks?: BootstrapHooks
}

export async function initializeApp(options?: InitOptions): Promise<void> {
  const { useMemoryFallback = false, hooks } = options ?? {}

  if (useMemoryFallback) {
    logger.warn('[bootstrapService] 使用内存降级模式')
  } else {
    try {
      await dataBridge.init()
      logger.info('[bootstrapService] IndexedDB initialized via DataBridge')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[bootstrapService] IndexedDB 初始化失败', { error: message })
      hooks?.onDataBridgeInitFailure?.(message)
      throw err
    }
  }

  initPWA()
  logger.info('[bootstrapService] PWA initialization triggered')

  permissionRevocationService.start()
  logger.info('[bootstrapService] RBAC permission revocation service started')

  checkSecretHealth()

  void seedWithRetry(hooks)

  try {
    initOrchestration()
    const failedOrchestrators = getOrchestratorHealth().filter((h) => h.status === 'failed')
    if (failedOrchestrators.length > 0) {
      const message = failedOrchestrators.map((f) => `${f.name}: ${f.errorMessage ?? 'unknown'}`).join('; ')
      logger.error('[bootstrapService] 编排器部分启动失败', { error: message })
      hooks?.onOrchestrationFailure?.(message)
    } else {
      logger.info('[bootstrapService] 编排器服务启动成功')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[bootstrapService] 编排器服务启动失败', { error: message })
    hooks?.onOrchestrationFailure?.(message)
  }
}

/**
 * 处理一次种子数据初始化失败：记录日志、判断是否耗尽重试，返回下次等待时长。
 * 抽取为独立辅助函数以压低重试循环内的嵌套深度。
 */
function buildSeedFailureOutcome(
  retryCount: number,
  errorMessage: string,
  hooks?: BootstrapHooks,
): { exhausted: boolean; retryDelayMs: number } {
  logger.error('[bootstrapService] 种子数据初始化失败', {
    error: errorMessage,
    retryCount,
  })

  if (retryCount >= MAX_SEED_RETRIES) {
    hooks?.onSeedFailure?.(errorMessage, retryCount)
    return { exhausted: true, retryDelayMs: 0 }
  }

  const retryDelayMs = SEED_RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1)
  logger.warn(`[bootstrapService] 种子数据重试第 ${retryCount} 次，${retryDelayMs}ms 后重试...`)
  return { exhausted: false, retryDelayMs }
}

async function seedWithRetry(hooks?: BootstrapHooks): Promise<void> {
  let retryCount = 0

  while (true) {
    try {
      await seedDefaultStocks()
      logger.info('[bootstrapService] 种子数据初始化成功')
      return
    } catch (err) {
      retryCount++
      const errorMessage = err instanceof Error ? err.message : String(err)
      const outcome = buildSeedFailureOutcome(retryCount, errorMessage, hooks)
      if (outcome.exhausted) return
      await new Promise((resolve) => setTimeout(resolve, outcome.retryDelayMs))
    }
  }
}

/**
 * 安全配置健康检查。
 * 启动时扫描所有密钥，对未配置 / 已过期的情况输出引导日志。
 * 不阻塞启动流程，仅做 console.warn 提示。
 */
function checkSecretHealth(): void {
  const checks: SecretHealthItem[] = [
    {
      name: '主 LLM API Key',
      configured: isLlmApiKeyConfigured(),
      expired: false, // 主 LLM Key 暂无 TTL 机制
      ageDays: 0,
      daysSinceVerification: -1,
    },
    {
      name: 'Tushare Token',
      configured: isTushareTokenConfigured(),
      expired: isTushareTokenExpired(),
      ageDays: getTushareTokenAgeDays(),
      daysSinceVerification: -1,
    },
    {
      name: 'Qwen API Key',
      configured: isQwenApiKeyConfigured(),
      expired: isQwenApiKeyExpired(),
      ageDays: getQwenApiKeyAgeDays(),
      daysSinceVerification: -1,
    },
  ]

  for (const item of checks) {
    if (!item.configured) {
      logger.warn(
        `[bootstrapService][安全配置] ${item.name} 未配置。` +
          '请在「系统设置 → 密钥管理」中配置，以启用完整功能。',
      )
    } else if (item.expired) {
      logger.warn(
        `[bootstrapService][安全配置] ${item.name} 已超过 ${item.ageDays} 天未轮换。` +
          '建议在「系统设置 → 密钥管理」中更新密钥以保障安全。',
      )
    }
  }

  const allConfigured = checks.every((c) => c.configured)
  if (allConfigured) {
    logger.info('[bootstrapService][安全配置] 所有密钥已配置，安全检查通过')
  }
}

/**
 * 应用关闭/热更新时的清理钩子。
 * 停止所有后台定时任务以防止内存泄漏或重复执行。
 */
export function shutdownApp(): void {
  stopOrchestration()
  logger.info('[bootstrapService] 编排器服务已停止')
  permissionRevocationService.stop()
  logger.info('[bootstrapService] RBAC permission revocation service stopped')
}
