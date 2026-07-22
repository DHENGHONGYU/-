#!/usr/bin/env tsx
/**
 * scaffold-domain.ts — 「入」阶段标准强制原型（评估 how-to-add-* 升级为代码生成器）
 *
 * 设计意图（对标优秀案例 "Code generators enforce standards from the moment a project is born"）：
 *   新增 domain 时，用生成器固化「目录命中 + 命名命中 + 引用注册」标准，替代纯文档 how-to-add-*。
 *
 * 安全策略（避免污染 src/ 触发 audit:deadcode / lint）：
 *   - 默认 dry-run：仅打印将创建的目录树 + 手动注册清单（来自 how-to-add-service / how-to-add-store）。
 *   - --write 时写入 `scripts/.scaffold-preview/<layer>/<name>/`（非 src/、非发布路径），供审阅后手动落地。
 *   - 绝不自动写入任何 registry / store / index，避免破坏性自动注册。
 *
 * 用法：
 *   tsx scripts/other/scaffold-domain.ts <domainName> [--layer=services|store|components|pages] [--write]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Layer = 'services' | 'store' | 'components' | 'pages'

const LAYER_ROOT: Record<Layer, string> = {
  services: 'src/services',
  store: 'src/store',
  components: 'src/components',
  pages: 'src/pages',
}

function parseArgs(argv: string[]): { name: string; layer: Layer; write: boolean } {
  const positional = argv.slice(2).filter((a) => !a.startsWith('--'))
  const name = positional[0]
  if (!name) {
    console.error('用法: tsx scripts/other/scaffold-domain.ts <domainName> [--layer=services] [--write]')
    process.exit(1)
  }
  let layer: Layer = 'services'
  let write = false
  for (const a of argv.slice(2)) {
    if (a.startsWith('--layer=')) layer = a.slice('--layer='.length) as Layer
    else if (a === '--write') write = true
  }
  if (!(layer in LAYER_ROOT)) {
    console.error(`--layer 必须是: ${Object.keys(LAYER_ROOT).join(' | ')}`)
    process.exit(1)
  }
  return { name, layer, write }
}

function buildTree(name: string, layer: Layer): string[] {
  const root = `${LAYER_ROOT[layer]}/${name}`
  switch (layer) {
    case 'services':
      return [
        `${root}/index.ts`,
        `${root}/${name}.service.ts`,
        `${root}/${name}.types.ts`,
      ]
    case 'store':
      return [`${root}/index.ts`, `${root}/${name}Store.ts`, `${root}/${name}Store.test.ts`]
    case 'components':
      return [`${root}/index.ts`, `${root}/${name}.tsx`]
    case 'pages':
      return [`${root}/index.ts`, `${root}/${name}Page.tsx`]
  }
}

function stubFor(file: string): string {
  if (file.endsWith('.tsx')) {
    return `// AUTO-SCAFFOLD (preview) — 审阅后落地到 src/\nimport { FC } from 'react'\n\nexport const Placeholder: FC = () => null\n`
  }
  if (file.endsWith('.test.ts')) {
    return `// AUTO-SCAFFOLD (preview) — 审阅后落地到 src/\nimport { describe, it, expect } from 'vitest'\n\ndescribe('placeholder', () => { it('todo', () => { expect(true).toBe(true) }) })\n`
  }
  return `// AUTO-SCAFFOLD (preview) — 审阅后落地到 src/\nexport {}\n`
}

function main(): void {
  const { name, layer, write } = parseArgs(process.argv)
  const files = buildTree(name, layer)

  console.log(`[scaffold-domain] layer=${layer} name=${name}`)
  console.log('[scaffold-domain] 将创建目录树:')
  for (const f of files) console.log(`  + ${f}`)

  console.log('\n[scaffold-domain] 手动注册清单（来自 how-to-add-*）:')
  const checklist: Record<Layer, string[]> = {
    services: [
      '在 modules/ 或对应 config 注册 service 导出',
      '更新 module-sync-checklist 十域同步',
      '跑 audit:layers + audit:acl-consistency + tsc:prod',
    ],
    store: [
      '在 reserved-stores 注册表登记（如适用）',
      'Zustand 响应式铁律：组件用 hook 订阅，禁裸 getState()',
      '跑 audit:reserved-stores + audit:layers',
    ],
    components: [
      'atomic 边界合规（atoms/molecules/organisms）',
      '跑 audit:atomic',
    ],
    pages: ['pages 仅依赖 store/services，禁直连 dataLayer', '跑 audit:layers'],
  }
  for (const step of checklist[layer]) console.log(`  [ ] ${step}`)

  if (!write) {
    console.log('\n[scaffold-domain] dry-run 完成（加 --write 生成预览桩到 scripts/.scaffold-preview/）。')
    return
  }

  const base = join('scripts/.scaffold-preview', layer, name)
  mkdirSync(base, { recursive: true })
  for (const f of files) {
    const rel = f.replace(`${LAYER_ROOT[layer]}/${name}/`, '')
    const target = join(base, rel)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, stubFor(f))
    console.log(`  ✓ 写入 ${target}`)
  }
  console.log(`\n[scaffold-domain] 预览桩已生成于 ${base}/（非 src/，审阅后手动落地并删除本目录）。`)
}

main()
