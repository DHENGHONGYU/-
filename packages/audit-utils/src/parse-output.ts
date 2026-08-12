export interface ParseResult<T> {
  data: T
  source: 'json' | 'regex' | 'default'
}

export function parseJsonOutput<T>(output: string): ParseResult<T | null> {
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0])
      return { data: json as T, source: 'json' }
    } catch {
      return { data: null, source: 'regex' }
    }
  }
  
  return { data: null, source: 'regex' }
}

export function parseNumberField<T>(
  output: string,
  jsonPath: (json: T) => number | undefined,
  regexPattern: string,
  defaultValue: number = 0,
): ParseResult<number> {
  const { data, source } = parseJsonOutput<T>(output)
  
  if (data && source === 'json') {
    const value = jsonPath(data)
    return { data: value ?? defaultValue, source: 'json' }
  }
  
  const match = output.match(regexPattern)
  if (match && match[1]) {
    return { data: parseInt(match[1], 10) || defaultValue, source: 'regex' }
  }
  
  return { data: defaultValue, source: 'default' }
}

export function parseBooleanField<T>(
  output: string,
  jsonPath: (json: T) => boolean | undefined,
  regexPattern: string,
  defaultValue: boolean = false,
): ParseResult<boolean> {
  const { data, source } = parseJsonOutput<T>(output)
  
  if (data && source === 'json') {
    const value = jsonPath(data)
    return { data: value ?? defaultValue, source: 'json' }
  }
  
  const match = output.match(regexPattern)
  if (match) {
    return { data: match[0].toLowerCase() === 'true' || match[1]?.toLowerCase() === 'true', source: 'regex' }
  }
  
  return { data: defaultValue, source: 'default' }
}

export interface AuditSummary {
  totalViolations?: number
  totalWarnings?: number
  violations?: number
  warnings?: number
  [key: string]: unknown
}

export function parseAuditOutput(output: string): ParseResult<AuditSummary> {
  const { data, source } = parseJsonOutput<AuditSummary>(output)
  
  if (data && source === 'json') {
    const summary = data.summary || data
    return { data: { ...summary, ...data }, source: 'json' }
  }
  
  const violations = (output.match(/违规数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/违规数:\s*(\d+)/) || [])[1]) : 0
  const warnings = (output.match(/警告数:\s*(\d+)/) || [])[1] ? parseInt((output.match(/警告数:\s*(\d+)/) || [])[1]) : 0
  
  return { data: { totalViolations: violations, totalWarnings: warnings }, source: 'regex' }
}

export function countKeywordOccurrences(output: string, keyword: string): number {
  return (output.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length
}

export function extractNumbers(output: string, pattern: RegExp): number[] {
  const matches = output.match(pattern)
  if (!matches) return []
  
  return matches.map(m => {
    const numMatch = m.match(/(\d+)/)
    return numMatch ? parseInt(numMatch[1], 10) : 0
  }).filter(n => n > 0)
}