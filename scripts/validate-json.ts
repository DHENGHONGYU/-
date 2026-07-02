#!/usr/bin/env tsx

import * as fs from 'node:fs'
import * as path from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ROOT = process.cwd()

const IGNORE_DIRS = new Set([
  'node_modules',
  'coverage',
  'dist',
  '.git',
  'build',
  '.vscode',
  'dogfood-output',
])

const IGNORE_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
])

interface JsonBlock {
  content: string
  lineNumber: number
  file: string
}

interface ValidationError {
  type: 'format' | 'schema'
  file: string
  line: number
  message: string
  code?: string
  path?: string
}

interface ValidationResult {
  passed: boolean
  totalFiles: number
  totalBlocks: number
  errors: ValidationError[]
  stats: {
    mdFiles: number
    jsonFiles: number
    jsonBlocksInMd: number
    formatErrors: number
    schemaErrors: number
  }
}

function collectMdFiles(dir: string): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) {
        result.push(...collectMdFiles(fullPath))
      }
    } else if (entry.endsWith('.md')) {
      result.push(fullPath)
    }
  }
  return result
}

function collectJsonFiles(dir: string): string[] {
  const result: string[] = []
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) {
        result.push(...collectJsonFiles(fullPath))
      }
    } else if (entry.endsWith('.json') && !IGNORE_FILES.has(entry)) {
      result.push(fullPath)
    }
  }
  return result
}

function cleanJsonContent(content: string): string {
  let cleaned = content
  
  cleaned = cleaned
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf('//')
      if (commentIndex === -1) return line
      const beforeComment = line.substring(0, commentIndex)
      const hasStringBefore = beforeComment.match(/["']/)
      if (!hasStringBefore) return beforeComment.trimEnd()
      return line
    })
    .join('\n')
  
  cleaned = cleaned.replace(/\.\.\./g, '')
  
  const firstOpenBrace = cleaned.indexOf('{')
  const firstOpenBracket = cleaned.indexOf('[')
  const startIndex = Math.min(
    firstOpenBrace >= 0 ? firstOpenBrace : Infinity,
    firstOpenBracket >= 0 ? firstOpenBracket : Infinity
  )
  
  if (startIndex === Infinity) {
    return cleaned
  }
  
  let balance = 0
  const charArray = cleaned.substring(startIndex).split('')
  const closingChar = cleaned[startIndex] === '{' ? '}' : ']'
  
  for (let i = 0; i < charArray.length; i++) {
    const char = charArray[i]
    
    if (char === '{' || char === '[') {
      balance++
    } else if (char === '}' || char === ']') {
      balance--
      if (balance === 0) {
        return cleaned.substring(startIndex, startIndex + i + 1)
      }
    }
  }
  
  return cleaned.substring(startIndex)
}

function extractJsonBlocks(mdContent: string, filePath: string): JsonBlock[] {
  const blocks: JsonBlock[] = []
  const regex = /```json\n([\s\S]*?)\n```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(mdContent)) !== null) {
    const content = cleanJsonContent(match[1])
    const lineNumber = mdContent.substring(0, match.index).split('\n').length
    blocks.push({ content, lineNumber, file: filePath })
  }
  return blocks
}

function validateJsonFormat(content: string): { valid: boolean; error?: Error } {
  try {
    JSON.parse(content)
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err as Error }
  }
}

function loadSchemas(ajv: Ajv): Map<string, object> {
  const schemaMap = new Map<string, object>()
  const schemaDir = path.join(ROOT, 'src', 'schema')
  
  if (!fs.existsSync(schemaDir)) {
    console.log('  [INFO] Schema directory not found: src/schema')
    return schemaMap
  }

  for (const entry of fs.readdirSync(schemaDir)) {
    const fullPath = path.join(schemaDir, entry)
    if (entry.endsWith('.json')) {
      try {
        const schema = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
        const schemaName = entry.replace('.json', '')
        ajv.addSchema(schema, schemaName)
        schemaMap.set(schemaName, schema)
      } catch (err) {
        console.log(`  [WARN] Failed to load schema: ${entry}`)
      }
    }
  }
  
  return schemaMap
}

function inferSchema(filePath: string): string | null {
  const basename = path.basename(filePath).toLowerCase()
  
  if (basename.includes('stock') || basename.includes('pool')) return 'stock'
  if (basename.includes('score') || basename.includes('rating')) return 'score'
  if (basename.includes('holding') || basename.includes('portfolio')) return 'holdings'
  if (basename.includes('signal') || basename.includes('strategy')) return 'signal'
  if (basename.includes('order') || basename.includes('trade')) return 'order'
  if (basename.includes('news') || basename.includes('article')) return 'news'
  if (basename.includes('config') || basename.includes('setting')) return 'config'
  
  return null
}

function validateJsonAgainstSchema(
  content: string,
  filePath: string,
  lineNumber: number,
  ajv: Ajv,
  schemaMap: Map<string, object>
): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (schemaMap.size === 0) {
    return errors
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return errors
  }

  const schemaName = inferSchema(filePath)
  if (!schemaName || !ajv.getSchema(schemaName)) {
    return errors
  }

  const validate = ajv.getSchema(schemaName)!
  const valid = validate(parsed)
  
  if (!valid && validate.errors) {
    for (const err of validate.errors) {
      errors.push({
        type: 'schema',
        file: filePath,
        line: lineNumber,
        message: err.message || 'Unknown schema error',
        code: err.keyword,
        path: err.instancePath || undefined,
      })
    }
  }

  return errors
}

function generateReport(result: ValidationResult): string {
  let report = '\n'
  report += '============================================================\n'
  report += '              JSON Validation Report - validate-json.ts\n'
  report += '============================================================\n\n'
  
  report += 'STATS:\n'
  report += '------------------------------------------------------------\n'
  report += `  Markdown files:         ${result.stats.mdFiles}\n`
  report += `  JSON files:             ${result.stats.jsonFiles}\n`
  report += `  JSON blocks in MD:      ${result.stats.jsonBlocksInMd}\n`
  report += `  Format errors:          ${result.stats.formatErrors}\n`
  report += `  Schema errors:          ${result.stats.schemaErrors}\n\n`

  if (result.errors.length > 0) {
    report += 'ERROR DETAILS:\n'
    report += '------------------------------------------------------------\n'
    
    const formatErrors = result.errors.filter((e) => e.type === 'format')
    const schemaErrors = result.errors.filter((e) => e.type === 'schema')

    if (formatErrors.length > 0) {
      report += '\n  [FORMAT ERRORS] JSON.parse() failed\n'
      report += '  ---------------------------------------------------------\n'
      for (const err of formatErrors) {
        report += `    * ${path.relative(ROOT, err.file)}:${err.line}\n`
        report += `      ${err.message}\n\n`
      }
    }

    if (schemaErrors.length > 0) {
      report += '\n  [SCHEMA ERRORS] Schema validation failed\n'
      report += '  ---------------------------------------------------------\n'
      for (const err of schemaErrors) {
        report += `    * ${path.relative(ROOT, err.file)}:${err.line}\n`
        report += `      Field: ${err.path || 'unknown'}\n`
        report += `      Rule:  ${err.code || 'unknown'}\n`
        report += `      Reason: ${err.message}\n\n`
      }
    }
  } else {
    report += 'VALIDATION PASSED:\n'
    report += '------------------------------------------------------------\n'
    report += '  All JSON data is properly formatted and schema-valid.\n\n'
  }

  report += 'FIX GUIDANCE:\n'
  report += '------------------------------------------------------------\n'
  report += '  Format errors: Check JSON syntax (bracket pairing, commas, quotes)\n'
  report += '  Schema errors: Adjust field types and required fields per src/schema/*.json\n\n'

  return report
}

function main(): void {
  const result: ValidationResult = {
    passed: true,
    totalFiles: 0,
    totalBlocks: 0,
    errors: [],
    stats: {
      mdFiles: 0,
      jsonFiles: 0,
      jsonBlocksInMd: 0,
      formatErrors: 0,
      schemaErrors: 0,
    },
  }

  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)
  const schemaMap = loadSchemas(ajv)

  console.log('\nScanning project files...')

  const mdFiles = collectMdFiles(ROOT)
  result.stats.mdFiles = mdFiles.length
  console.log(`  Found ${mdFiles.length} Markdown files`)

  for (const mdFile of mdFiles) {
    const content = fs.readFileSync(mdFile, 'utf-8')
    const blocks = extractJsonBlocks(content, mdFile)
    result.stats.jsonBlocksInMd += blocks.length

    for (const block of blocks) {
      result.totalBlocks++
      
      const formatResult = validateJsonFormat(block.content)
      if (!formatResult.valid) {
        result.passed = false
        result.stats.formatErrors++
        result.errors.push({
          type: 'format',
          file: mdFile,
          line: block.lineNumber,
          message: formatResult.error?.message || 'Unknown format error',
        })
      } else {
        const schemaErrors = validateJsonAgainstSchema(
          block.content,
          mdFile,
          block.lineNumber,
          ajv,
          schemaMap
        )
        if (schemaErrors.length > 0) {
          result.passed = false
          result.stats.schemaErrors += schemaErrors.length
          result.errors.push(...schemaErrors)
        }
      }
    }
  }

  const jsonFiles = collectJsonFiles(ROOT)
  result.stats.jsonFiles = jsonFiles.length
  result.totalFiles += jsonFiles.length
  console.log(`  Found ${jsonFiles.length} JSON files`)

  for (const jsonFile of jsonFiles) {
    const content = fs.readFileSync(jsonFile, 'utf-8')
    
    const formatResult = validateJsonFormat(content)
    if (!formatResult.valid) {
      result.passed = false
      result.stats.formatErrors++
      result.errors.push({
        type: 'format',
        file: jsonFile,
        line: 1,
        message: formatResult.error?.message || 'Unknown format error',
      })
    } else {
      const schemaErrors = validateJsonAgainstSchema(
        content,
        jsonFile,
        1,
        ajv,
        schemaMap
      )
      if (schemaErrors.length > 0) {
        result.passed = false
        result.stats.schemaErrors += schemaErrors.length
        result.errors.push(...schemaErrors)
      }
    }
  }

  console.log(generateReport(result))

  if (!result.passed) {
    process.exit(1)
  }
}

main()