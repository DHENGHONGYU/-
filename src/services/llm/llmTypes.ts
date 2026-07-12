export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface LlmResponse {
  content: string
  model: string
  usage?: LlmUsage
}

export interface LlmStreamChunk {
  content: string
  isDone: boolean
  usage?: LlmUsage
}

export type LlmStreamCallback = (chunk: LlmStreamChunk) => void
