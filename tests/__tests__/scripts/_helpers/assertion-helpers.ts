import { expect } from 'vitest'

export interface Violation {
  filePath: string
  line: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  category: string
}

export interface Warning {
  filePath: string
  line: number
  message: string
}

export interface Summary {
  totalViolations: number
  totalWarnings: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
}

export interface AuditReport {
  violations: Violation[]
  warnings: Warning[]
  summary: Summary
}

export function expectReportStructure(report: unknown): void {
  expect(report).toBeDefined()
  expect(report).toBeInstanceOf(Object)
  const r = report as AuditReport
  expect(r.violations).toBeDefined()
  expect(Array.isArray(r.violations)).toBe(true)
  expect(r.warnings).toBeDefined()
  expect(Array.isArray(r.warnings)).toBe(true)
  expect(r.summary).toBeDefined()
  expect(r.summary).toBeInstanceOf(Object)
  expect(r.summary.totalViolations).toBeDefined()
  expect(typeof r.summary.totalViolations).toBe('number')
  expect(r.summary.totalWarnings).toBeDefined()
  expect(typeof r.summary.totalWarnings).toBe('number')
}

export function expectNoViolations(report: unknown): void {
  expectReportStructure(report)
  const r = report as AuditReport
  expect(r.violations.length).toBe(0)
  expect(r.summary.totalViolations).toBe(0)
}

export function expectViolationCount(report: unknown, count: number): void {
  expectReportStructure(report)
  const r = report as AuditReport
  expect(r.violations.length).toBe(count)
  expect(r.summary.totalViolations).toBe(count)
}

export function expectViolationInFile(report: unknown, filePath: string): void {
  expectReportStructure(report)
  const r = report as AuditReport
  const violationsInFile = r.violations.filter(v => v.filePath.includes(filePath))
  expect(violationsInFile.length).toBeGreaterThan(0)
}

export function expectSeverityDistribution(report: unknown, distribution: Record<string, number>): void {
  expectReportStructure(report)
  const r = report as AuditReport
  for (const [severity, expectedCount] of Object.entries(distribution)) {
    expect(r.summary.bySeverity[severity]).toBe(expectedCount)
  }
}

export function expectCategoryDistribution(report: unknown, distribution: Record<string, number>): void {
  expectReportStructure(report)
  const r = report as AuditReport
  for (const [category, expectedCount] of Object.entries(distribution)) {
    expect(r.summary.byCategory[category]).toBe(expectedCount)
  }
}

export function expectWarningCount(report: unknown, count: number): void {
  expectReportStructure(report)
  const r = report as AuditReport
  expect(r.warnings.length).toBe(count)
  expect(r.summary.totalWarnings).toBe(count)
}

export function expectWarningInFile(report: unknown, filePath: string): void {
  expectReportStructure(report)
  const r = report as AuditReport
  const warningsInFile = r.warnings.filter(w => w.filePath.includes(filePath))
  expect(warningsInFile.length).toBeGreaterThan(0)
}
