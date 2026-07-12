import type { QualityGate } from '@/types/modules/doc-validation.types'

export type CheckTier = 'P0' | 'P1' | 'P2'

export interface CheckDefinition {
  readonly name: string
  readonly tier: CheckTier
  readonly script: string
  readonly description: string
  readonly blocking: boolean
  readonly timeoutMinutes?: number
}

export interface QualityGateConfig {
  readonly thresholds: QualityGate
  readonly checks: readonly CheckDefinition[]
  readonly tierDefinitions: {
    readonly [key in CheckTier]: {
      readonly level: string
      readonly description: string
      readonly requiredPass: boolean
    }
  }
}

export const QUALITY_GATE_CONFIG: Readonly<QualityGateConfig> = {
  thresholds: {
    minCoverage: 0.8,
    minFreshness: 60,
    maxBrokenLinks: 0,
    minContractMatch: 1.0,
  },

  tierDefinitions: {
    P0: {
      level: 'critical',
      description: '阻塞性检查 — 任何失败都会阻止合并',
      requiredPass: true,
    },
    P1: {
      level: 'important',
      description: '重要检查 — 需要修复但可临时放行',
      requiredPass: false,
    },
    P2: {
      level: 'advisory',
      description: '建议性检查 — 用于持续改进',
      requiredPass: false,
    },
  },

  checks: [
    {
      name: 'lint',
      tier: 'P0',
      script: 'npm run lint',
      description: 'ESLint 代码风格检查',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'typecheck',
      tier: 'P0',
      script: 'npm run tsc:prod',
      description: 'TypeScript 类型检查',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'test',
      tier: 'P0',
      script: 'npm run test:clean',
      description: '单元测试执行',
      blocking: true,
      timeoutMinutes: 15,
    },
    {
      name: 'coverage',
      tier: 'P1',
      script: 'npm run test:ci',
      description: '测试覆盖率检查',
      blocking: false,
      timeoutMinutes: 20,
    },
    {
      name: 'audit:layers',
      tier: 'P0',
      script: 'npm run audit:layers',
      description: '分层架构调用检查',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:hardcode',
      tier: 'P0',
      script: 'npm run audit:hardcode',
      description: '硬编码颜色检查',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:deadcode',
      tier: 'P1',
      script: 'npm run audit:deadcode',
      description: '死代码检查',
      blocking: false,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:docs',
      tier: 'P0',
      script: 'npm run audit:docs',
      description: '文档同步检查',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:semantic',
      tier: 'P0',
      script: 'npm run audit:semantic',
      description: '语义验证',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:routes',
      tier: 'P0',
      script: 'npm run audit:routes',
      description: '路由注册验证',
      blocking: true,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:mcp',
      tier: 'P1',
      script: 'npm run audit:mcp',
      description: 'MCP 权限矩阵验证',
      blocking: false,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:jsdoc',
      tier: 'P2',
      script: 'npm run audit:jsdoc',
      description: 'JSDoc 完整性检查',
      blocking: false,
      timeoutMinutes: 10,
    },
    {
      name: 'audit:complexity',
      tier: 'P2',
      script: 'npm run audit:complexity',
      description: '代码复杂度检查',
      blocking: false,
      timeoutMinutes: 10,
    },
    {
      name: 'dependency-check',
      tier: 'P1',
      script: 'npm run audit:dependencies',
      description: '依赖分析（循环依赖/未使用依赖）',
      blocking: false,
      timeoutMinutes: 15,
    },
    {
      name: 'contract-validation',
      tier: 'P0',
      script: 'npm run test:clean -- --reporter=verbose',
      description: '接口契约验证',
      blocking: true,
      timeoutMinutes: 15,
    },
  ],
}

export function getChecksByTier(tier: CheckTier): readonly CheckDefinition[] {
  return QUALITY_GATE_CONFIG.checks.filter((check) => check.tier === tier)
}

export function getBlockingChecks(): readonly CheckDefinition[] {
  return QUALITY_GATE_CONFIG.checks.filter((check) => check.blocking)
}

export function isTierBlocking(tier: CheckTier): boolean {
  return QUALITY_GATE_CONFIG.tierDefinitions[tier].requiredPass
}