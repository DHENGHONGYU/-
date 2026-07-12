/**
 * scaffold-widget — 一键添加 Widget 脚手架
 *
 * 用法：npm run scaffold:widget <id> <title> <category>
 *   id:       小驼峰 widget 标识，如 "stockAlerts"
 *   title:    中文标题，如 "股票预警"
 *   category: 分类：analysis|strategy|ai|监控|交易分析 等（默认 "analysis"）
 *
 * 自动完成：
 *   1. 创建 src/cockpit/widgets/XxxWidget.tsx
 *   2. 注册到 widgetRegistry.ts
 *   3. 添加到 DEFAULT_WIDGET_CONFIG
 *   4. 添加到 WIDGET_DEFAULT_DATA_SOURCE
 *   5. 添加到 defaultLayout
 *
 * 创建后执行 npm run audit:widget-registry 验证一致性。
 */
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const ROOT = process.cwd()

// ============================================================
// 工具函数
// ============================================================

function kebabToPascal(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '')
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function read(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf-8')
}

function write(file: string, content: string): void {
  fs.writeFileSync(path.join(ROOT, file), content, 'utf-8')
}

function exists(file: string): boolean {
  return fs.existsSync(path.join(ROOT, file))
}

// ============================================================
// 参数解析
// ============================================================

const args = process.argv.slice(2)
const widgetId = args[0]?.trim()

if (!widgetId) {
  console.error('用法: npm run scaffold:widget <id> <title?> <category?>')
  console.error('  id:       小驼峰，如 "stockAlerts"')
  console.error('  title:    中文标题（可选，默认用 id 转中文）')
  console.error('  category: 分类（可选，默认 "analysis"）')
  process.exit(1)
}

const widgetTitle = args[1] || widgetId.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
const widgetCategory = args[2] || 'analysis'
const widgetPascal = toPascalCase(widgetId.charAt(0).toUpperCase() + widgetId.slice(1)) + 'Widget'
const componentName = widgetPascal.replace('Widget', '') + 'Widget'

// 确定正确的 PascalCase：先把 widgetId 按驼峰分割，每段首字母大写
const componentPascal = widgetId
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .split(/[\s_-]+/)
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join('') + 'Widget'

const FILE_WIDGET = `src/cockpit/widgets/${componentPascal}.tsx`
const FILE_REGISTRY = 'src/cockpit/core/widgetRegistry.ts'
const FILE_CONSTANTS = 'src/constants/cockpit.constants.ts'

// ============================================================
// 1. 创建 Widget 组件文件
// ============================================================

if (exists(FILE_WIDGET)) {
  console.log(`⚠️  ${FILE_WIDGET} 已存在，跳过创建`)
} else {
  const template = `/**
 * ${componentPascal.replace('Widget', '')}Widget — ${widgetTitle}
 *
 * @module cockpit/widgets/${componentPascal}
 * @description ${widgetTitle} 展示 Widget
 *
 * @architecture 四步集成契约
 * 1. 类型定义：${widgetId} 的数据类型
 * 2. Store：use${toPascalCase(widgetId)}Store
 * 3. Service：${widgetId}Service
 * 4. UI 集成：本组件
 *
 * @compliance
 * - 颜色规范：使用 COLOR_TOKENS / STOCK_COLOR_TOKENS
 * - 事件清理：useEffect cleanup 调用对应 cleanup
 * - 日志埋点：核心分支有 logger.info
 * - 零硬编码：所有阈值提取为常量
 */

import { memo, useEffect } from 'react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { getLogger } from '@/lib/logger'
import type { WidgetConfig } from '@/types/modules/widget.types'

const logger = getLogger()

interface ${componentPascal.replace('Widget', '')}WidgetProps {
  config: WidgetConfig
}

export const ${componentPascal} = memo(function ${componentPascal}({
  config,
}: ${componentPascal.replace('Widget', '')}WidgetProps) {
  useEffect(() => {
    logger.info('[${componentPascal}] 组件挂载', { widgetId: config.widgetId })
    return () => {
      logger.info('[${componentPascal}] 组件卸载', { widgetId: config.widgetId })
    }
  }, [config.widgetId])

  return (
    <WidgetStateShell
      title={config.title}
      visualState="ready"
    >
      <div className="p-4">
        <p>${widgetTitle}</p>
      </div>
    </WidgetStateShell>
  )
})

export default ${componentPascal}
`
  write(FILE_WIDGET, template)
  console.log(`✅ 已创建 ${FILE_WIDGET}`)
}

// ============================================================
// 2. 注册到 widgetRegistry.ts
// ============================================================

let registryContent = read(FILE_REGISTRY)

// 查找插入点：在 systemArchitecture 注册之后（或最后一条注册之后）
const insertAfter = 'component: () => import(\'@/cockpit/widgets/SignalMonitorWidget\'),\n      },\n    ]'
const registryEntry = `component: () => import('@/cockpit/widgets/SignalMonitorWidget'),
      },
      {
        meta: {
          id: '${widgetId}',
          name: DEFAULT_WIDGET_CONFIG.${widgetId}.title,
          category: DEFAULT_WIDGET_CONFIG.${widgetId}.category,
          description: '${widgetTitle}',
          defaultSize: DEFAULT_WIDGET_CONFIG.${widgetId}.size,
          defaultDataSource: WIDGET_DEFAULT_DATA_SOURCE.${widgetId},
        },
        component: () => import('@/cockpit/widgets/${componentPascal}'),
      },
    ]`

if (registryContent.includes(widgetId)) {
  console.log(`⚠️  widgetRegistry.ts 中已存在 '${widgetId}'，跳过注册`)
} else {
  // 检查是否已插入过
  registryContent = registryContent.replace(insertAfter, registryEntry)
  write(FILE_REGISTRY, registryContent)
  console.log(`✅ widgetRegistry.ts — 已注册 '${widgetId}'`)
}

// ============================================================
// 3. 添加到 DEFAULT_WIDGET_CONFIG
// ============================================================

let constantsContent = read(FILE_CONSTANTS)

const configAnchor = '  // ============================================================\n  // 系统监控与高级分析 Widget\n  // ============================================================'
const configEntry = `  ${widgetId}: {
    title: '${widgetTitle}',
    size: WIDGET_SIZE.FULL_WIDTH,
    category: '${widgetCategory}',
  },
${configAnchor}`

if (constantsContent.includes(`  ${widgetId}: {`)) {
  console.log(`⚠️  DEFAULT_WIDGET_CONFIG 中已存在 '${widgetId}'，跳过`)
} else {
  constantsContent = constantsContent.replace(configAnchor, configEntry)
  console.log(`✅ DEFAULT_WIDGET_CONFIG — 已添加 '${widgetId}'`)
}

// ============================================================
// 4. 添加到 WIDGET_DEFAULT_DATA_SOURCE
// ============================================================

const dataSourceAnchor = '  // 系统监控与高级分析 Widget 数据源'
const dataSourceEntry = `  ${widgetId}: {
    type: ACTIVE_DATA_SOURCE,
    mode: COLLECTION_MODE.ONCE,
    interval: 0,
    endpoint: '/${widgetCategory}/${widgetId}',
    enabled: true,
  },
${dataSourceAnchor}`

if (constantsContent.includes(`${widgetId}: {\n    type:`)) {
  console.log(`⚠️  WIDGET_DEFAULT_DATA_SOURCE 中已存在 '${widgetId}'，跳过`)
} else {
  constantsContent = constantsContent.replace(dataSourceAnchor, dataSourceEntry)
  console.log(`✅ WIDGET_DEFAULT_DATA_SOURCE — 已添加 '${widgetId}'`)
}

write(FILE_CONSTANTS, constantsContent)

// ============================================================
// 5. 添加到 defaultLayout
// ============================================================

// 重新读取（constants 可能变了，但 registry 可能会变）
registryContent = read(FILE_REGISTRY)

// 在 valuePit 布局行之后插入
const layoutInsertPoint = "{ widgetId: 'valuePit', position: { x: 0, y: 29 } },"
const layoutEntry = `{ widgetId: 'valuePit', position: { x: 0, y: 29 } },
      { widgetId: '${widgetId}', position: { x: 0, y: 30 } },`

if (registryContent.includes(`{ widgetId: '${widgetId}'`)) {
  console.log(`⚠️  defaultLayout 中已存在 '${widgetId}'，跳过`)
} else {
  registryContent = registryContent.replace(layoutInsertPoint, layoutEntry)
  write(FILE_REGISTRY, registryContent)
  console.log(`✅ defaultLayout — 已添加 '${widgetId}'`)
}

// ============================================================
// 6. 验证
// ============================================================

console.log('\n=== 脚手架完成 ===')
console.log('运行 npm run audit:widget-registry 验证一致性：')
try {
  execSync('npm run audit:widget-registry', { cwd: ROOT, stdio: 'inherit' })
} catch {
  console.log('⚠️ 审计发现不一致，请手动检查以上输出')
}
