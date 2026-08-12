/**
 * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
 */
export const HYBRID_PROOFREAD_CONFIG = {
  api: {
    baseUrl: 'https://api.example.com/security',
    hashVerifyEndpoint: '/api/v1/feature/hash/verify',
    hashRiskDetailsEndpoint: '/api/v1/feature/hash/risk-details',
    rulesVersionEndpoint: '/api/v1/rules/version',
    rulesDownloadEndpoint: '/api/v1/rules/download',
    performanceReportEndpoint: '/api/v1/metrics/performance',
  },
  hash: {
    algorithm: 'sha256' as const,
    batchSize: 50,
    maxFileSizeBytes: 10 * 1024 * 1024,
  },
  rules: {
    defaultVersion: '1.0.0',
    syncIntervalMs: 24 * 60 * 60 * 1000,
    cacheKey: 'hybrid-proofread-rules',
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  },
  scanning: {
    defaultExcludes: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.lock',
      '*.log',
    ],
    defaultIncludes: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.vue',
      '**/*.json',
      '**/*.gradle',
      '**/*.xml',
      '**/.env*',
    ],
    maxConcurrentFiles: 10,
    timeoutPerFileMs: 5000,
  },
  performance: {
    collectionIntervalMs: 60 * 1000,
    maxSamples: 100,
  },
  security: {
    tlsMinVersion: '1.3' as const,
    allowedOrigins: ['https://api.example.com'],
  },
} as const

export type HybridProofreadConfig = typeof HYBRID_PROOFREAD_CONFIG

export const HYBRID_PROOFREAD_DEFAULT_RULES: Array<{
  rule_id: string
  name: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info'
  pattern: string
  category: 'sensitive_data' | 'hardcoded_secret' | 'directory_structure' | 'dependency_vulnerability' | 'code_quality' | 'security_best_practice'
  action_type: 'block' | 'warn' | 'info'
  file_pattern?: string
}> = [
  {
    rule_id: 'R001',
    name: 'Hardcoded API Key',
    description: '检测硬编码的 API Key 或密钥',
    severity: 'critical',
    pattern: /api[_-]?key\s*=\s*['"]([A-Za-z0-9]{16,})['"]/.source,
    category: 'hardcoded_secret',
    action_type: 'block',
  },
  {
    rule_id: 'R002',
    name: 'Hardcoded Password',
    description: '检测硬编码的密码',
    severity: 'critical',
    pattern: /password\s*[:=]\s*['"]([^'"]{6,})['"]/.source,
    category: 'hardcoded_secret',
    action_type: 'block',
  },
  {
    rule_id: 'R003',
    name: 'Sensitive File Exposed',
    description: '检测敏感配置文件',
    severity: 'high',
    pattern: /\.(env|pem|key|cert)$/.source,
    category: 'sensitive_data',
    action_type: 'warn',
    file_pattern: '**/.*',
  },
  {
    rule_id: 'R004',
    name: 'Insecure Dependency',
    description: '检测已知不安全的依赖版本',
    severity: 'high',
    pattern: /(lodash|moment)\s*@\s*(1\.|2\.)/.source,
    category: 'dependency_vulnerability',
    action_type: 'warn',
    file_pattern: '**/package.json',
  },
  {
    rule_id: 'R005',
    name: 'Missing License File',
    description: '检测项目是否缺少 LICENSE 文件',
    severity: 'info',
    pattern: /^LICENSE$/.source,
    category: 'security_best_practice',
    action_type: 'info',
  },
  {
    rule_id: 'R006',
    name: 'Console Log Security Risk',
    description: '检测可能泄露敏感信息的 console.log',
    severity: 'medium',
    pattern: /console\.(log|warn|error)\s*\(\s*['"][^'"]*(password|token|secret|key)['"]/.source,
    category: 'code_quality',
    action_type: 'warn',
  },
  {
    rule_id: 'R007',
    name: 'HTTP URL Usage',
    description: '检测使用 HTTP 而非 HTTPS 的 URL',
    severity: 'medium',
    pattern: /http:\/\/[^"]+/.source,
    category: 'security_best_practice',
    action_type: 'warn',
  },
  {
    rule_id: 'R008',
    name: 'SQL Injection Risk',
    description: '检测可能导致 SQL 注入的字符串拼接',
    severity: 'critical',
    pattern: /(select|insert|update|delete)\s*.*\+\s*['"]/.source,
    category: 'sensitive_data',
    action_type: 'block',
  },
]