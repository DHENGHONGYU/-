/**
 * @fileoverview 批量操作限流队列
 *
 * 控制并发操作数量，防止 IndexedDB 热 key 竞争。
 * 适用于 dataBridge.query / forward 等需要限流的场景。
 *
 * @module lib/batchQueue
 * @created 2026-07-13 R3
 */

const DEFAULT_CONCURRENCY = 10

/**
 * 将一组任务分批次执行，每批次最多 concurrency 个并行。
 *
 * @param items  任务数组
 * @param fn     每个元素的异步处理函数
 * @param concurrency  并发数（默认 10）
 * @returns 按输入顺序排列的结果数组
 */
export async function batchQueue<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  while (index < items.length) {
    const batch = items.slice(index, index + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((item, i) => fn(item, index + i)),
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        // 失败时推入 undefined 占位，调用方自行处理 null
        results.push(undefined as unknown as R)
      }
    }
    index += concurrency
  }

  return results
}

/**
 * 创建带限流的 map 函数，可复用同一 concurrency 设置。
 */
export function createBatchQueue(concurrency: number = DEFAULT_CONCURRENCY) {
  return <T, R>(items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> =>
    batchQueue(items, fn, concurrency)
}
