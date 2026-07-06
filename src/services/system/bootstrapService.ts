import { db } from '@/data/db'
import { initPWA } from '@/services/pwa/registerServiceWorker'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 应用启动初始化服务。
 *
 * 职责：集中管理 L1/L2 基础设施的启动顺序，避免 L5/L4 入口组件直接操作数据层。
 * 初始化链路：IndexedDB → PWA Service Worker → （未来：缓存预热、降级队列重放）
 */
export async function initializeApp(): Promise<void> {
  await db.init()
  logger.info('[bootstrapService] IndexedDB initialized')

  // PWA Service Worker 注册（仅生产环境生效）
  initPWA()
  logger.info('[bootstrapService] PWA initialization triggered')
}
