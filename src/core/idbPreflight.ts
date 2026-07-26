/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033]
 * IndexedDB 预检模块
 *
 * 在 dataBridge.init() 前检查浏览器是否支持 IndexedDB，
 * 以及存储空间是否充足。支持降级到内存模式。
 */

export interface IDBCapability {
  supported: boolean
  estimatedQuota: number | null
  estimatedUsage: number | null
  available: boolean
  reason: string | null
}

export async function checkIDBCapability(): Promise<IDBCapability> {
  if (typeof indexedDB === 'undefined') {
    return {
      supported: false,
      estimatedQuota: null,
      estimatedUsage: null,
      available: false,
      reason: '当前浏览器不支持 IndexedDB',
    }
  }

  try {
    const testResult = await testIDBWritable()
    if (!testResult.writable) {
      return {
        supported: true,
        estimatedQuota: null,
        estimatedUsage: null,
        available: false,
        reason: `IndexedDB 可写性测试失败: ${testResult.error}`,
      }
    }
  } catch {
    return {
      supported: true,
      estimatedQuota: null,
      estimatedUsage: null,
      available: false,
      reason: 'IndexedDB 预检异常',
    }
  }

  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate() as unknown as {
        quota?: number
        usage?: number
        usageDetails?: Record<string, number>
      }
      const usageMB = (estimate.usageDetails?.indexedDB ?? 0) / (1024 * 1024)
      const quotaMB = (estimate.quota ?? 0) / (1024 * 1024)

      if (quotaMB - usageMB < 50) {
        return {
          supported: true,
          estimatedQuota: estimate.quota ?? null,
          estimatedUsage: estimate.usage ?? null,
          available: true,
          reason: `存储空间不足: 剩余 ${Math.round(quotaMB - usageMB)}MB`,
        }
      }

      return {
        supported: true,
        estimatedQuota: estimate.quota ?? null,
        estimatedUsage: estimate.usage ?? null,
        available: true,
        reason: null,
      }
    }
  } catch {
    // storage.estimate 不支持，忽略
  }

  return {
    supported: true,
    estimatedQuota: null,
    estimatedUsage: null,
    available: true,
    reason: null,
  }
}

function testIDBWritable(): Promise<{ writable: boolean; error: string | null }> {
  return new Promise((resolve) => {
    const testDbName = `__v9_idb_probe_${Date.now()}`
    const request = indexedDB.open(testDbName, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore('probe')
    }

    request.onsuccess = () => {
      const db = request.result
      try {
        const tx = db.transaction('probe', 'readwrite')
        const store = tx.objectStore('probe')
        store.put({ test: true }, 'key')
        tx.oncomplete = () => {
          db.close()
          indexedDB.deleteDatabase(testDbName)
          resolve({ writable: true, error: null })
        }
        tx.onerror = () => {
          db.close()
          indexedDB.deleteDatabase(testDbName)
          resolve({ writable: false, error: '写入事务失败' })
        }
      } catch (err) {
        db.close()
        indexedDB.deleteDatabase(testDbName)
        resolve({ writable: false, error: err instanceof Error ? err.message : String(err) })
      }
    }

    request.onerror = () => {
      resolve({ writable: false, error: request.error?.message ?? '打开数据库失败' })
    }

    setTimeout(() => {
      resolve({ writable: false, error: '连接超时' })
    }, 5000)
  })
}