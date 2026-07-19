/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066, V9-DOC-BACK-023]
 */
import type { ZodSchema } from 'zod'
import type { LlmStructuredOptions } from '@/services/llm/llmTypes'

/** SKILL 执行状态 */
export type SkillExecutionStatus = 'success' | 'partial' | 'failed' | 'blocked'

/** SKILL 执行元信息 */
export interface SkillExecutionMeta {
  /** 执行开始时间戳 */
  startedAt: number
  /** 执行耗时（毫秒） */
  durationMs: number
  /** 调用 LLM 的模型名 */
  model?: string
  /** Token 消耗 */
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * SKILL 统一输出结构。
 *
 * 每个 SKILL 无论内部是 LLM、规则计算还是混合逻辑，对外都必须返回此结构，
 * 以便编排器统一处理失败降级、置信度聚合与 trace 记录。
 */
export interface SkillResult<T = unknown> {
  /** SKILL 唯一标识 */
  skillId: string
  /** 执行状态 */
  status: SkillExecutionStatus
  /** 结构化输出数据 */
  data?: T
  /** 原始 LLM 文本（LLM SKILL 可选填充） */
  rawText?: string
  /** 置信度（0-1，undefined 表示 N/D） */
  confidence?: number
  /** 证据/来源列表 */
  evidence: string[]
  /** 错误信息（失败时） */
  error?: string
  /** 执行元信息 */
  meta: SkillExecutionMeta
}

/** SKILL 输入上下文 */
export interface SkillContext {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  stockName?: string
  /** 用户原始意图 */
  userIntent?: string
  /** 上游 SKILL 输出（按 skillId 索引） */
  upstreamResults?: Record<string, SkillResult>
  /** 任意附加参数 */
  params?: Record<string, unknown>
}

/** SKILL 执行选项 */
export interface SkillExecutionOptions {
  /** 是否允许失败降级 */
  allowFallback?: boolean
  /** 是否启用 Self-Refine/CRITIC 自净 */
  enableSelfRefine?: boolean
  /** 最大重试次数 */
  maxRetries?: number
}

/** SKILL 执行器接口（允许返回原始对象，由 Registry 自动封装为 SkillResult） */
export type SkillExecutor<T = unknown> = (
  ctx: SkillContext,
  options?: SkillExecutionOptions,
) => Promise<SkillResult<T> | T>

/**
 * SKILL 定义。
 *
 * 与 `.agents/skills/{name}/SKILL.md` 中的 frontmatter 对齐，
 * 运行时由 SkillRegistry 将定义绑定到 TypeScript 执行器。
 */
export interface SkillDefinition<T = unknown> {
  /** 唯一标识 */
  name: string
  /** 人类可读名称 */
  title: string
  /** 触发时机描述 */
  description: string
  /** 输入 Schema */
  inputSchema: ZodSchema
  /** 输出 Schema */
  outputSchema: ZodSchema<T>
  /** 执行器 */
  executor: SkillExecutor<T>
  /** 是否依赖 LLM */
  requiresLlm: boolean
  /** 依赖的其他 SKILL */
  dependsOn?: string[]
  /** 默认执行选项 */
  defaultOptions?: SkillExecutionOptions
  /** 版本 */
  version: string
}

/** 从 SKILL 定义推导结构化输出选项 */
export function toStructuredOptions<T>(def: SkillDefinition<T>): LlmStructuredOptions<T> {
  return {
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: def.name,
        strict: true,
        schema: zodToJsonSchema(def.outputSchema),
      },
    },
    zodSchema: def.outputSchema,
  }
}

/**
 * 简易 Zod Schema 转 JSON Schema。
 *
 * Batch A 阶段使用运行时描述对象，避免引入额外依赖。
 * 后续可替换为 zod-to-json-schema 库。
 */
function zodToJsonSchema(schema: ZodSchema): Record<string, unknown> {
  const zodDef = schema as unknown as {
    _def?: { typeName?: string; shape?: () => Record<string, ZodSchema> }
  }
  if (zodDef._def?.typeName !== 'ZodObject') {
    return { type: 'object' }
  }

  const shape = zodDef._def.shape?.() ?? {}
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(value)
    if (!isOptionalLike(value)) {
      required.push(key)
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function isOptionalLike(field: ZodSchema): boolean {
  const def = (field as unknown as { _def?: { typeName?: string } })._def
  return def?.typeName === 'ZodOptional' || def?.typeName === 'ZodNullable'
}

function unwrapZodField(field: ZodSchema): ZodSchema {
  const def = (field as unknown as { _def?: { typeName?: string; innerType?: ZodSchema } })._def
  if (def?.typeName === 'ZodOptional' || def?.typeName === 'ZodNullable') {
    return def.innerType ?? field
  }
  return field
}

function zodFieldToJsonSchema(field: ZodSchema): Record<string, unknown> {
  const unwrapped = unwrapZodField(field)
  const def = (unwrapped as unknown as { _def?: { typeName?: string } })._def
  const typeName = def?.typeName

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' }
    case 'ZodNumber':
      return { type: 'number' }
    case 'ZodBoolean':
      return { type: 'boolean' }
    case 'ZodArray': {
      const itemSchema = (def as { type?: ZodSchema }).type
      return {
        type: 'array',
        items: itemSchema ? zodFieldToJsonSchema(itemSchema) : { type: 'string' },
      }
    }
    case 'ZodEnum':
      return { type: 'string', enum: (def as { values: string[] }).values }
    case 'ZodObject':
      return zodToJsonSchema(unwrapped)
    default:
      return { type: 'object' }
  }
}
