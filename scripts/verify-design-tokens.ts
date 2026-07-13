#!/usr/bin/env node
/**
 * @fileoverview 设计令牌映射校验脚本
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const FIGMA_TO_PROJECT_PATH = resolve(rootDir, 'design-tokens', 'figma-to-project.json')
const PROJECT_TO_FIGMA_PATH = resolve(rootDir, 'design-tokens', 'project-to-figma.json')
const TOKENS_PATH = resolve(rootDir, 'design-tokens', 'tokens.json')

export interface MappingEntry {
  figma: string
  project: string
  themeAware: boolean
  usage: string
}

export interface FigmaToProjectFile {
  mappings: MappingEntry[]
}

export interface VerificationReport {
  valid: boolean
  errors: string[]
  warnings: string[]
  summary: {
    totalMappings: number
    themeAwareCount: number
    nonThemeAwareCount: number
    duplicateFigmaNames: number
    duplicateProjectPaths: number
    unknownLayers: number
  }
  generatedAt: string
}

const KNOWN_LAYERS = [
  'THEME_TOKENS',
  'COLOR_TOKENS',
  'COLOR_SHADES',
  'STOCK_COLOR_TOKENS',
  'CHART_PALETTE',
  'SPACING_TOKENS',
  'SEMANTIC_COLOR_ROLES',
  'TYPOGRAPHY_SCALE',
  'ELEVATION',
  'LAYOUT_TOKENS',
  'DARK',
  'HOVER',
  'FOCUS',
  'FILL',
  'GRADIENT',
]

function loadJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`文件不存在: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function getLayer(projectPath: string): string {
  return projectPath.split('.')[0] ?? ''
}

function validateMapping(entry: MappingEntry, index: number): string[] {
  const errors: string[] = []
  if (!entry.figma || typeof entry.figma !== 'string') {
    errors.push(`[条目 ${index}] figma 变量名缺失或类型错误`)
  }
  if (!entry.project || typeof entry.project !== 'string') {
    errors.push(`[条目 ${index}] project 路径缺失或类型错误`)
  }
  if (typeof entry.themeAware !== 'boolean') {
    errors.push(`[条目 ${index}] themeAware 必须为布尔值`)
  }
  if (!entry.usage || typeof entry.usage !== 'string') {
    errors.push(`[条目 ${index}] usage 描述缺失或类型错误`)
  }
  return errors
}

export function validate(checkOnly = false): VerificationReport {
  const report: VerificationReport = {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      totalMappings: 0,
      themeAwareCount: 0,
      nonThemeAwareCount: 0,
      duplicateFigmaNames: 0,
      duplicateProjectPaths: 0,
      unknownLayers: 0,
    },
    generatedAt: new Date().toISOString(),
  }

  try {
    const figmaToProject = loadJson<FigmaToProjectFile>(FIGMA_TO_PROJECT_PATH)
    const mappings = figmaToProject.mappings ?? []
    report.summary.totalMappings = mappings.length

    mappings.forEach((entry, index) => {
      report.errors.push(...validateMapping(entry, index))
    })

    const figmaCount = new Map<string, number>()
    const projectCount = new Map<string, number>()
    mappings.forEach((entry) => {
      figmaCount.set(entry.figma, (figmaCount.get(entry.figma) ?? 0) + 1)
      projectCount.set(entry.project, (projectCount.get(entry.project) ?? 0) + 1)
      if (entry.themeAware) {
        report.summary.themeAwareCount += 1
      } else {
        report.summary.nonThemeAwareCount += 1
      }
    })

    figmaCount.forEach((count, name) => {
      if (count > 1) {
        report.summary.duplicateFigmaNames += 1
        report.errors.push(`Figma 变量名重复: "${name}" 出现 ${count} 次`)
      }
    })

    projectCount.forEach((count, path) => {
      if (count > 1) {
        report.summary.duplicateProjectPaths += 1
        report.errors.push(`Project 路径重复: "${path}" 出现 ${count} 次`)
      }
    })

    mappings.forEach((entry) => {
      const layer = getLayer(entry.project)
      if (!KNOWN_LAYERS.includes(layer)) {
        report.summary.unknownLayers += 1
        report.warnings.push(`未知令牌层级: "${layer}"（${entry.project}）`)
      }
    })

    const projectToFigma = {
      $schema: 'https://design-tokens.github.io/community-group/format/',
      $description: 'V9 代码令牌到 Figma / MasterGo 设计变量的反向映射（Project → Figma）',
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      mappings: mappings
        .map((entry) => ({
          project: entry.project,
          figma: entry.figma,
          themeAware: entry.themeAware,
          usage: entry.usage,
        }))
        .sort((a, b) => a.project.localeCompare(b.project)),
    }

    if (!checkOnly) {
      writeFileSync(PROJECT_TO_FIGMA_PATH, `${JSON.stringify(projectToFigma, null, 2)}\n`, 'utf-8')
    }

    if (!existsSync(TOKENS_PATH)) {
      report.warnings.push(`未找到设计变量源文件: ${TOKENS_PATH}`)
    }

    report.valid = report.errors.length === 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report.valid = false
    report.errors.push(message)
  }

  return report
}

function main(): void {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check-only')

  const report = validate(checkOnly)

  console.log(JSON.stringify(report, null, 2))

  if (!report.valid) {
    console.error(`\n❌ 设计令牌映射校验失败，共 ${report.errors.length} 个错误。`)
    process.exit(1)
  }

  console.log(`\n✅ 设计令牌映射校验通过，共 ${report.summary.totalMappings} 条映射。`)
  if (!checkOnly) {
    console.log(`📝 已生成反向映射文件: design-tokens/project-to-figma.json`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
