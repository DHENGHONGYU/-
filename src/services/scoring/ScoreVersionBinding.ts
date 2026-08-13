/**
 * @module ScoreVersionBinding
 * @description 评分版本绑定（P1 修复 R13：评分与输入数据版本不对应）
 *
 * 每次评分必须记录：
 * 1. 输入数据的版本号（dataVersion）
 * 2. 输入数据的 snapshot hash
 * 3. 评分引擎版本号
 * 4. 权重配置版本号
 *
 * 确保评分结果可复现、可审计。
 *
 * @doc V9-DOC-QUALITY-013
 */

// ── 类型定义 ──

/** 输入数据快照 */
export interface InputSnapshot {
  /** 数据版本号 */
  dataVersion: number
  /** 各维度数据 hash */
  dimensionHashes: Record<string, string>
  /** 快照时间 */
  snapshotAt: number
}

/** 评分引擎版本 */
export interface EngineVersion {
  /** 引擎名称 */
  name: string
  /** 版本号 */
  version: string
  /** 权重配置 hash */
  weightHash: string
  /** 模型配置 hash */
  configHash: string
}

/** 评分版本绑定 */
export interface ScoreVersionBinding {
  /** 输入数据快照 */
  input: InputSnapshot
  /** 引擎版本 */
  engine: EngineVersion
  /** 评分时间 */
  scoredAt: number
  /** 绑定 hash（用于验证一致性） */
  bindingHash: string
}

// ── 工具函数 ──

/**
 * 简单 hash 函数（非加密，用于数据一致性校验）
 */
function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * 计算对象的 hash
 */
export function hashObject(obj: Record<string, unknown>): string {
  return simpleHash(JSON.stringify(obj, Object.keys(obj).sort()))
}

/**
 * 创建输入数据快照
 *
 * @param dataVersion - 数据版本号
 * @param dimensions - 各维度数据 { 'market': {...}, 'fundamental': {...}, ... }
 * @returns 输入快照
 */
export function createInputSnapshot(
  dataVersion: number,
  dimensions: Record<string, Record<string, unknown> | null>,
): InputSnapshot {
  const dimensionHashes: Record<string, string> = {}

  for (const [dimName, dimData] of Object.entries(dimensions)) {
    if (dimData) {
      dimensionHashes[dimName] = hashObject(dimData)
    } else {
      dimensionHashes[dimName] = 'null'
    }
  }

  return {
    dataVersion,
    dimensionHashes,
    snapshotAt: Date.now(),
  }
}

/**
 * 创建引擎版本
 *
 * @param version - 引擎版本号
 * @param weights - 权重配置
 * @param config - 其他配置
 * @returns 引擎版本
 */
export function createEngineVersion(
  version: string,
  weights: Record<string, Record<string, number>>,
  config: Record<string, unknown> = {},
): EngineVersion {
  const weightHash = hashObject(
    Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, Object.fromEntries(Object.entries(v))]),
    ),
  )

  const configHash = hashObject(config)

  return {
    name: 'V6-IntelligentScore',
    version,
    weightHash,
    configHash,
  }
}

/**
 * 创建评分版本绑定
 *
 * @param input - 输入快照
 * @param engine - 引擎版本
 * @returns 版本绑定
 */
export function createScoreVersionBinding(
  input: InputSnapshot,
  engine: EngineVersion,
): ScoreVersionBinding {
  const bindingInput = JSON.stringify({
    dataVersion: input.dataVersion,
    dimensionHashes: input.dimensionHashes,
    engineVersion: engine.version,
    weightHash: engine.weightHash,
    configHash: engine.configHash,
  })

  return {
    input,
    engine,
    scoredAt: Date.now(),
    bindingHash: simpleHash(bindingInput),
  }
}

/**
 * 验证评分版本绑定一致性
 *
 * 两次评分如果输入数据和引擎版本相同，则 bindingHash 应该相同
 */
export function verifyBindingConsistency(
  binding1: ScoreVersionBinding,
  binding2: ScoreVersionBinding,
): {
  consistent: boolean
  differences: string[]
} {
  const differences: string[] = []

  if (binding1.input.dataVersion !== binding2.input.dataVersion) {
    differences.push(`dataVersion: ${binding1.input.dataVersion} vs ${binding2.input.dataVersion}`)
  }

  if (binding1.engine.version !== binding2.engine.version) {
    differences.push(`engineVersion: ${binding1.engine.version} vs ${binding2.engine.version}`)
  }

  if (binding1.engine.weightHash !== binding2.engine.weightHash) {
    differences.push('weightHash 不一致')
  }

  if (binding1.engine.configHash !== binding2.engine.configHash) {
    differences.push('configHash 不一致')
  }

  for (const dim of Object.keys(binding1.input.dimensionHashes)) {
    const hash1 = binding1.input.dimensionHashes[dim]
    const hash2 = binding2.input.dimensionHashes[dim]
    if (hash1 !== hash2) {
      differences.push(`维度 ${dim} 数据 hash 不一致: ${hash1} vs ${hash2}`)
    }
  }

  return {
    consistent: differences.length === 0,
    differences,
  }
}

/**
 * 对比评分结果与输入数据版本
 *
 * 检查评分结果的 dataVersion 是否与当前数据版本一致
 */
export function checkScoreDataVersion(
  scoreDataVersion: number,
  currentDataVersion: number,
): {
  consistent: boolean
  message: string
} {
  if (scoreDataVersion === currentDataVersion) {
    return { consistent: true, message: '评分版本与数据版本一致' }
  }

  if (scoreDataVersion < currentDataVersion) {
    return {
      consistent: false,
      message: `评分版本(${scoreDataVersion}) 落后于数据版本(${currentDataVersion})，建议重新评分`,
    }
  }

  return {
    consistent: false,
    message: `评分版本(${scoreDataVersion}) 超前于数据版本(${currentDataVersion})，数据可能被回滚`,
  }
}