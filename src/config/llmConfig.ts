export interface LlmConfig {
  baseURL: string
  apiKey: string
  model: string
}

export function getDefaultLlmConfig(): LlmConfig {
  return {
    baseURL: import.meta.env.VITE_LLM_BASE_URL ?? '',
    apiKey: import.meta.env.VITE_LLM_API_KEY ?? '',
    model: import.meta.env.VITE_LLM_MODEL ?? 'deepseek-chat',
  }
}
