import { db } from '@/data/db'

/**
 * 应用启动初始化服务。
 *
 * 职责：集中管理 L1/L2 基础设施的启动顺序，避免 L5/L4 入口组件直接操作数据层。
 * 当前仅负责 IndexedDB 初始化，未来可扩展：缓存预热、离线检测、降级队列重放等。
 */
export async function initializeApp(): Promise<void> {
  await db.init()
}
