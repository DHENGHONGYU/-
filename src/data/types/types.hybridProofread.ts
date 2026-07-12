export type FileType = 'gradle_dep' | 'keystore' | 'env_file' | 'source_code' | 'config_file' | 'binary' | 'other'

export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 5

export type CheckStatus = 'safe' | 'risky' | 'unknown'

export interface FileHash {
  file_hash: string
  file_type: FileType
  file_path: string
  project_id: string
  last_modified: number
  size_bytes: number
}

export interface HashVerifyRequest {
  file_hash: string
  file_type: FileType
  project_id: string
}

export interface HashVerifyResponse {
  status: CheckStatus
  risk_level: RiskLevel
  cve_ids?: string[]
}

export interface RiskDetail {
  hash: string
  cve_id: string
  description: string
  remediation_advice: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  affected_version?: string
  published_date?: string
}

export interface RuleConfig {
  rule_id: string
  name: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info'
  pattern: string
  file_pattern?: string
  category: 'sensitive_data' | 'hardcoded_secret' | 'directory_structure' | 'dependency_vulnerability' | 'code_quality' | 'security_best_practice'
  action_type: 'block' | 'warn' | 'info'
  metadata?: Record<string, unknown>
}

export interface RulePackage {
  version: string
  release_date: string
  rules: RuleConfig[]
  checksum: string
  signature?: string
}

export interface RuleMatchResult {
  rule_id: string
  rule_name: string
  severity: RuleConfig['severity']
  category: RuleConfig['category']
  file_path: string
  line_number: number
  column_number: number
  match_text: string
  description: string
  action_type: RuleConfig['action_type']
}

export interface LocalScanResult {
  project_id: string
  scan_time: number
  total_files: number
  scanned_files: number
  skipped_files: number
  rule_matches: RuleMatchResult[]
  hashes: FileHash[]
}

export interface CloudRiskResult {
  project_id: string
  checked_at: number
  hash_count: number
  risky_count: number
  risks: RiskDetail[]
}

export interface ProofreadReport {
  id: string
  project_id: string
  project_name: string
  scan_time: number
  local_scan: LocalScanResult
  cloud_risk: CloudRiskResult | null
  overall_risk_level: RiskLevel
  total_issues: number
  critical_issues: number
  high_issues: number
  medium_issues: number
  low_issues: number
  summary: string
  recommendations: string[]
}

export interface PerformanceMetric {
  metric_type: 'cold_start' | 'memory_usage' | 'cpu_usage' | 'build_time'
  value: number
  unit: string
  timestamp: number
  device_info?: Record<string, string>
}

export interface RulesSyncResult {
  current_version: string
  latest_version: string
  updated: boolean
  downloaded_rules: number
  skipped_rules: number
}

export interface HashBatchVerifyRequest {
  hash_list: string[]
  project_id: string
}

export interface HashBatchVerifyResponse {
  results: Record<string, HashVerifyResponse>
}

export interface RiskDetailsRequest {
  hash_list: string[]
}

export interface RiskDetailsResponse {
  risks: RiskDetail[]
}