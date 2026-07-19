/**
 * @fileoverview 简单可播种的伪随机数生成器（mulberry32）
 *
 * 用于性能压测等需要可重复结果的场景。未传 seed 时使用 Math.random。
 *
 * @module lib/seededRandom
 * @created 2026-07-13
/** 创建一个可播种的随机数生成器，返回 [0,1) 之间的数 */
export function createSeededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 在 [min, max] 之间取随机整数 */
export function randInt(min: number, max: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

/** Fisher-Yates 洗牌 */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const sh = [...arr]
  for (let i = sh.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const si = sh[i]
    const sj = sh[j]
    if (si == null || sj == null) continue
    sh[i] = sj
    sh[j] = si
  }
  return sh
}

/** 随机选取 N 个元素 */
export function pickRandom<T>(arr: T[], count: number, rng?: () => number): T[] {
  return shuffle(arr, rng).slice(0, count)
}
