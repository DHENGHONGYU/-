#!/usr/bin/env tsx
/**
 * cleanup-storage.ts — 统一存储占用清理脚本
 *
 * 背景：项目磁盘占用曾达 5.13GB，其中 98% 为缓存/依赖/测试产物。
 *   现有 cleanup-temp.ts 仅清理 temp/ 目录，cleanup-reports.ts 仅清理部分报告，
 *   test-results/、outputs/*.log、.tmp/、backend/wheels/、verdaccio-storage/、
 *   .hf_cache 重复缓存等大目录完全未被覆盖。
 *
 * 清理分级：
 *   safe  — 测试产物、日志、覆盖率报告、本地 npm 缓存（可随时重跑/重装生成）
 *   deep  — 额外清理需重建的大项（Linux wheel 包、HF 重复模型缓存）
 *
 * 安全策略：
 *   1. 默认 dry-run（只列出将删除的项及大小），加 --execute 才真正删除
 *   2. --deep 启用 deep 级清理（默认仅 safe）
 *   3. 绝不触碰 src/、docs/、scripts/、.git/、package-lock.json 等代码资产
 *   4. 删除目录内容时保留目录本身（避免破坏工具链期望的路径存在性）
 *
 * 用法：
 *   tsx scripts/cleanup-storage.ts                 # safe dry-run
 *   tsx scripts/cleanup-storage.ts --execute       # safe 实际执行
 *   tsx scripts/cleanup-storage.ts --deep --execute # deep 实际执行
 *   tsx scripts/cleanup-storage.ts --report         # 仅输出存储占用报告
 */
import { existsSync, readdirSync, statSync, rmSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── 类型定义 ──────────────────────────────────────────────────────────────────

type CleanLevel = 'safe' | 'deep'
type CleanMode = 'directory' | 'contents' | 'glob'

interface CleanTarget {
  path: string
  description: string
  level: CleanLevel
  mode: CleanMode
  /** glob 模式下的文件匹配后缀（仅 mode='glob' 时生效） */
  patterns?: string[]
}

// ── 清理目标配置 ──────────────────────────────────────────────────────────────
// safe 级：测试产物 / 日志 / 覆盖率 / 本地缓存（全部可重建，无运行依赖）
// deep 级：需重建的大项（Linux wheel / HF 重复缓存）

const TARGETS: CleanTarget[] = [
  // ── safe 级 ──
  {
    path: 'test-results',
    description: 'Playwright 测试运行产物（截图/trace视频）',
    level: 'safe',
    mode: 'directory',
  },
  {
    path: 'coverage',
    description: 'Istanbul 覆盖率 HTML 报告',
    level: 'safe',
    mode: 'directory',
  },
  {
    path: '.tmp',
    description: '临时文件与 embedding 服务日志',
    level: 'safe',
    mode: 'directory',
  },
  {
    path: 'verdaccio-storage',
    description: '本地 Verdaccio npm 私有包缓存',
    level: 'safe',
    mode: 'directory',
  },
  {
    path: 'dist',
    description: '前端构建产物（npm run build 可重建）',
    level: 'safe',
    mode: 'directory',
  },
  {
    path: 'outputs',
    description: 'AI 测试/治理产物输出目录中的日志文件',
    level: 'safe',
    mode: 'glob',
    patterns: ['*.log'],
  },
  {
    path: 'playwright-report',
    description: 'Playwright HTML 测试报告',
    level: 'safe',
    mode: 'directory',
  },

  // ── deep 级 ──
  {
    path: 'backend/wheels',
    description: 'Linux 平台 PyTorch wheel 包（Windows 开发环境无法使用）',
    level: 'deep',
    mode: 'directory',
  },
  {
    path: '.hf_cache/models--BAAI--bge-large-zh-v1.5',
    description: 'HuggingFace 模型重复缓存（非 hub 标准格式那份，hub/ 下保留）',
    level: 'deep',
    mode: 'directory',
  },
]

// ── 工具函数 ──────────────────────────────────────────────────────────────────

const MB = 1024 * 1024

function parseArgs(argv: string[]): { execute: boolean; deep: boolean; reportOnly: boolean } {
  let execute = false
  let deep = false
  let reportOnly = false
  for (const a of argv.slice(2)) {
    if (a === '--execute') execute = true
    else if (a === '--deep') deep = true
    else if (a === '--report') reportOnly = true
    else if (a === '-h' || a === '--help') {
      printUsage()
      process.exit(0)
    }
  }
  return { execute, deep, reportOnly }
}

function printUsage(): void {
  console.log(`
FinSightV9 存储占用清理脚本

用法:
  tsx scripts/cleanup-storage.ts                  # safe 级 dry-run（仅检查）
  tsx scripts/cleanup-storage.ts --execute        # safe 级实际执行
  tsx scripts/cleanup-storage.ts --deep --execute # deep 级实际执行
  tsx scripts/cleanup-storage.ts --report         # 仅输出存储占用报告

选项:
  --execute   实际执行删除（默认 dry-run）
  --deep      启用 deep 级清理（含需重建的大项）
  --report    仅输出存储占用报告，不执行任何清理
  -h, --help  显示帮助

安全保证:
  - 默认 dry-run，不会删除任何文件
  - 绝不触碰 src/ docs/ scripts/ .git/ package-lock.json
  - safe 级仅清理可随时重建的测试产物/日志/缓存
`)
}

/** 递归计算目录/文件大小（字节） */
function getSize(targetPath: string): number {
  if (!existsSync(targetPath)) return 0
  const stat = statSync(targetPath)
  if (stat.isFile()) return stat.size
  let total = 0
  try {
    for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
      const full = join(targetPath, entry.name)
      if (entry.isDirectory()) {
        total += getSize(full)
      } else {
        total += statSync(full).size
      }
    }
  } catch {
    // 权限/路径过长等异常，返回已累计值
  }
  return total
}

function formatMB(bytes: number): string {
  if (bytes === 0) return '0.00 MB'
  return `${(bytes / MB).toFixed(2)} MB`
}

/** 判断目标是否匹配当前清理级别 */
function matchesLevel(target: CleanTarget, deep: boolean): boolean {
  if (target.level === 'safe') return true
  return target.level === 'deep' && deep
}

/** 执行单个清理目标，返回释放的字节数 */
function cleanTarget(target: CleanTarget, execute: boolean): number {
  const absPath = resolve(target.path)

  if (!existsSync(absPath)) {
    console.log(`  ⊘ ${target.path} — 不存在，跳过`)
    return 0
  }

  const size = getSize(absPath)
  if (size === 0) {
    console.log(`  ⊘ ${target.path} — 已为空，跳过`)
    return 0
  }

  const action = execute ? '已删除' : '待删除(dry-run)'
  console.log(`  ${execute ? '✓' : '○'} ${target.path} — ${formatMB(size)} — ${action}`)
  console.log(`      └ ${target.description}`)

  if (!execute) return size

  // 实际执行删除
  try {
    if (target.mode === 'directory') {
      rmSync(absPath, { recursive: true, force: true })
    } else if (target.mode === 'glob') {
      // 仅删除匹配模式的文件，保留目录和其他文件
      const files = readdirSync(absPath, { withFileTypes: true })
      for (const f of files) {
        if (f.isFile() && target.patterns?.some((p) => f.name.endsWith(p.replace(/^\*/, '')))) {
          unlinkSync(join(absPath, f.name))
        }
      }
    } else if (target.mode === 'contents') {
      // 清空目录内容但保留目录本身
      const entries = readdirSync(absPath, { withFileTypes: true })
      for (const e of entries) {
        rmSync(join(absPath, e.name), { recursive: true, force: true })
      }
    }
    return size
  } catch (e) {
    console.error(`      ✗ 删除失败: ${(e as Error).message}`)
    return 0
  }
}

// ── 存储占用报告 ──────────────────────────────────────────────────────────────

interface DirStat {
  name: string
  sizeMB: number
}

function printStorageReport(): void {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  存储占用报告')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const root = process.cwd()
  const stats: DirStat[] = []

  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const size = getSize(join(root, entry.name))
      stats.push({ name: entry.name, sizeMB: size / MB })
    }
  } catch (e) {
    console.error(`扫描根目录失败: ${(e as Error).message}`)
    return
  }

  stats.sort((a, b) => b.sizeMB - a.sizeMB)

  const totalMB = stats.reduce((sum, s) => sum + s.sizeMB, 0)
  console.log('  目录                              大小(MB)    占比')
  console.log('  ─────────────────────────────────────────────────────────')
  for (const s of stats.slice(0, 15)) {
    const pct = totalMB > 0 ? ((s.sizeMB / totalMB) * 100).toFixed(1) : '0'
    const namePad = s.name.padEnd(32)
    const sizeStr = s.sizeMB.toFixed(2).padStart(10)
    console.log(`  ${namePad} ${sizeStr}  ${pct.padStart(6)}%`)
  }
  console.log('  ─────────────────────────────────────────────────────────')
  console.log(`  ${'总计'.padEnd(32)} ${totalMB.toFixed(2).padStart(10)} MB`)
  console.log('')
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

function main(): void {
  const { execute, deep, reportOnly } = parseArgs(process.argv)

  if (reportOnly) {
    printStorageReport()
    return
  }

  const modeLabel = deep ? 'deep' : 'safe'
  const actionLabel = execute ? '执行删除' : 'dry-run（仅检查）'

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`  FinSightV9 存储清理 — 级别: ${modeLabel} — 模式: ${actionLabel}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 清理前快照
  const beforeTargets = TARGETS.filter((t) => matchesLevel(t, deep))
  let totalReleasable = 0

  console.log('待清理目标:')
  for (const target of beforeTargets) {
    const size = getSize(target.path)
    totalReleasable += size
    const sizeStr = size > 0 ? formatMB(size) : '(不存在)'
    console.log(`  • ${target.path.padEnd(45)} ${sizeStr.padStart(12)}  [${target.level}]`)
  }
  console.log(`\n  可释放空间合计: ${formatMB(totalReleasable)}`)

  if (totalReleasable === 0) {
    console.log('\n✓ 无需清理，所有目标已为空或不存在。')
    return
  }

  if (!execute) {
    console.log('\n（dry-run 模式，加 --execute 实际删除；加 --deep 启用深度清理）')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return
  }

  // 实际执行
  console.log('\n执行清理:')
  let released = 0
  for (const target of beforeTargets) {
    released += cleanTarget(target, execute)
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`  清理完成 — 实际释放: ${formatMB(released)} / 预计: ${formatMB(totalReleasable)}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 清理后快照
  printStorageReport()
}

main()
