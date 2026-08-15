/**
 * Confluence / 内部 Wiki 部署脚本
 * 将 component-naming-conventions.md 和相关报告部署到团队 Wiki
 *
 * 使用方式:
 *   npx tsx scripts/deploy/deploy-to-confluence.ts
 *
 * 环境变量:
 *   CONFLUENCE_URL       - Confluence 实例 URL (e.g., https://company.atlassian.net)
 *   CONFLUENCE_TOKEN     - API Token (Basic auth base64 或 PAT)
 *   CONFLUENCE_SPACE     - Space Key (e.g., 'ENG' for Engineering)
 *   CONFLUENCE_PARENT_ID - 父页面 ID (可选)
 *
 * CI 集成:
 *   已配置在 .github/workflows/wiki-naming-conventions-sync.yml 中
 *   每次 push 到 main 或每日定时任务会自动触发
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DOC_PATH = join(ROOT, 'docs', 'guides', 'standards', 'component-naming-conventions.md')
const REPORT_JSON_PATH = join(ROOT, 'outputs', 'naming-conventions-report.json')
const EXEMPT_REPORT_PDF = join(ROOT, 'outputs', 'exempt-files-analysis-report.pdf')
const EXEMPT_REPORT_MD = join(ROOT, 'outputs', 'exempt-files-analysis-report.md')
const DEPLOY_DIR = join(ROOT, 'outputs', 'wiki-deploy')

// ─── Confluence API 封装 ───
interface ConfluencePage {
  id: string
  type: 'page'
  title: string
  space: { key: string }
  body: {
    storage: {
      value: string
      representation: 'storage'
    }
  }
  ancestors?: { id: string }[]
  metadata?: {
    properties?: Record<string, unknown>
  }
  version?: { number: number }
}

interface DeployConfig {
  url: string
  token: string
  space: string
  parentId?: string
}

function getConfig(): DeployConfig {
  const url = process.env.CONFLUENCE_URL
  const token = process.env.CONFLUENCE_TOKEN
  const space = process.env.CONFLUENCE_SPACE
  const parentId = process.env.CONFLUENCE_PARENT_ID

  if (!url || !token || !space) {
    console.log('ℹ️  Confluence 环境变量未配置，生成离线部署包')
    console.log('   设置以下环境变量可启用自动部署:')
    console.log('   - CONFLUENCE_URL: Confluence 实例地址')
    console.log('   - CONFLUENCE_TOKEN: API Token')
    console.log('   - CONFLUENCE_SPACE: Space Key')
    console.log('   - CONFLUENCE_PARENT_ID: 父页面 ID（可选）')
    return { url: '', token: '', space: '', parentId }
  }

  return { url, token, space, parentId }
}

async function confluenceRequest(
  config: DeployConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.url}/wiki/rest/api${path}`
  const headers: Record<string, string> = {
    'Authorization': `Basic ${config.token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

async function findPageByTitle(
  config: DeployConfig,
  title: string
): Promise<ConfluencePage | null> {
  const query = encodeURI(`title="${title}" AND space="${config.space}"`)
  const res = await confluenceRequest(config, `/content?expand=version&limit=1&query=${query}`)

  if (!res.ok) {
    console.warn(`⚠️  查询 Confluence 页面失败: ${res.status}`)
    return null
  }

  const data = await res.json()
  if (data.results && data.results.length > 0) {
    return data.results[0]
  }
  return null
}

async function createPage(
  config: DeployConfig,
  title: string,
  content: string,
  parentId?: string
): Promise<ConfluencePage | null> {
  const body: Partial<ConfluencePage> = {
    type: 'page',
    title,
    space: { key: config.space },
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
  }

  if (parentId) {
    body.ancestors = [{ id: parentId }]
  }

  const res = await confluenceRequest(config, '/content', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`❌ 创建页面失败: ${res.status} ${await res.text()}`)
    return null
  }

  return res.json()
}

async function updatePage(
  config: DeployConfig,
  pageId: string,
  title: string,
  content: string,
  newVersion: number
): Promise<void> {
  const body: Partial<ConfluencePage> = {
    version: { number: newVersion },
    title,
    type: 'page',
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
  }

  const res = await confluenceRequest(config, `/content/${pageId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`❌ 更新页面失败: ${res.status} ${await res.text()}`)
  } else {
    console.log(`✅ 页面已更新 (v${newVersion})`)
  }
}

// ─── Markdown → Confluence Storage Format ───
function markdownToConfluence(md: string): string {
  let html = md

  // Headers
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>')

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<ac:structured-macro ac:name="code" ac:schema-version="1"><ac:parameter ac:name="language">${lang}</ac:parameter><ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body></ac:structured-macro>`
  })

  // Tables
  html = html.replace(/\|([^\n]+)\|/g, (match) => {
    return '<th>' + match.replace(/\|\s*([^\n|]+?)\s*/g, (_, cell) => `${cell}</th>`) + '</th>'
  })

  // Replace th-th with td for body rows
  html = html.replace(/<th>([^<]+)<\/th><\/th>/g, '<td>$1</td>')

  // Blockquotes
  html = html.replace(/^> (.*$)/gm, '<blockquote><p>$1</p></blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr/>')

  // Lists
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>')
  html = html.replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')

  // Wrap in a paragraph
  const lines = html.split('\n')
  const processed = lines.map((line: string) => {
    if (line.startsWith('<') || line.trim() === '') return line
    return `<p>${line}</p>`
  })

  return processed.join('\n')
}

// ─── 生成部署包 ───
function generateDeployPackage(): void {
  if (!existsSync(DEPLOY_DIR)) {
    mkdirSync(DEPLOY_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString()
  const docContent = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : ''
  const exemptMd = existsSync(EXEMPT_REPORT_MD) ? readFileSync(EXEMPT_REPORT_MD, 'utf8') : ''

  // 1. Wiki 元数据
  const metadata = {
    deployed_at: timestamp,
    document: 'component-naming-conventions',
    source_file: DOC_PATH,
    exempt_report: EXEMPT_REPORT_MD,
    exempt_report_pdf: EXEMPT_REPORT_PDF,
    ci_commands: {
      check: 'npm run audit:naming',
      json: 'npm run audit:naming:json',
      fix: 'npm run fix:fileoverview',
    },
    auto_update: {
      enabled: true,
      trigger: ['push to main', 'daily 03:00 CST'],
      workflow: '.github/workflows/wiki-naming-conventions-sync.yml',
    },
    confluence: {
      title: '组件命名规范与文档模板标准',
      space: process.env.CONFLUENCE_SPACE || 'ENG',
      labels: ['component', 'naming', 'ci', 'standards'],
    },
  }

  writeFileSync(join(DEPLOY_DIR, 'wiki-metadata.json'), JSON.stringify(metadata, null, 2))
  console.log('✅ wiki-metadata.json 已生成')

  // 2. Confluence Storage Format 转换
  if (docContent) {
    const confluenceHtml = markdownToConfluence(docContent)
    writeFileSync(join(DEPLOY_DIR, 'confluence-payload.html'), confluenceHtml)
    console.log('✅ confluence-payload.html 已生成 (Confluence Storage Format)')
  }

  // 3. 豁免报告 Confluence 版本
  if (exemptMd) {
    const exemptHtml = markdownToConfluence(exemptMd)
    writeFileSync(join(DEPLOY_DIR, 'exempt-report-confluence.html'), exemptHtml)
    console.log('✅ exempt-report-confluence.html 已生成')
  }

  // 4. 部署指南
  const deployGuide = `# Confluence 部署指南

## 自动部署

本项目已配置 GitHub Actions 自动部署流水线：

### 触发条件
1. **Push 到 main**: 当 \`docs/guides/standards/component-naming-conventions.md\` 变更时
2. **每日定时**: 北京时间 03:00 自动运行命名审计并更新报告
3. **手动触发**: 通过 \`workflow_dispatch\` 手动触发

### 需要的 Secrets
在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 |
|--------|------|
| \`CONFLUENCE_URL\` | Confluence 实例地址 |
| \`CONFLUENCE_TOKEN\` | Confluence API Token |
| \`CONFLUENCE_SPACE\` | Confluence Space Key |
| \`CONFLUENCE_PARENT_ID\` | 父页面 ID（可选） |

## 手动部署

### 方式一：使用脚本

\`\`\`bash
# 设置环境变量后运行
export CONFLUENCE_URL="https://your-instance.atlassian.net"
export CONFLUENCE_TOKEN="your-api-token"
export CONFLUENCE_SPACE="ENG"
npx tsx scripts/deploy/deploy-to-confluence.ts
\`\`\`

### 方式二：手动上传

1. 将 \`outputs/wiki-deploy/confluence-payload.html\` 的内容复制
2. 在 Confluence 中创建/编辑目标页面
3. 切换到"存储格式"视图（Storage Format）
4. 粘贴内容并保存

### 部署产物

| 文件 | 用途 |
|------|------|
| \`wiki-metadata.json\` | 部署元数据（时间戳、CI 命令、标签） |
| \`confluence-payload.html\` | 文档的 Confluence Storage Format 版本 |
| \`exempt-report-confluence.html\` | 豁免报告的 Confluence Storage Format 版本 |
| \`..exempt-files-analysis-report.pdf\` | 豁免报告 PDF 附件 |

## 页面结构建议

\`\`\`
📘 FinSightV9 工程规范
  ├── 组件命名规范 (本页面)
  ├── 代码规范基础
  ├── 四层架构说明
  └── 质量门禁
\`\`\`

## 自动更新机制

### GitHub Actions Workflow
文件: \`.github/workflows/wiki-naming-conventions-sync.yml\`

### 每日定时检查
- Cron: \`0 19 * * *\` (UTC 19:00 = 北京时间 03:00)
- 运行命名审计并生成 JSON 报告
- 上传报告作为 artifact（保留 7 天）

### Push 触发更新
- 当命名规范文档或检查脚本变更时
- 自动更新 Confluence 页面并在 GitHub Issue 中发布通知

## 验证

部署完成后：
1. 访问 Confluence 页面确认内容正确
2. 检查页面历史版本确认变更已记录
3. 运行 \`npm run audit:naming\` 验证本地合规性
`

  writeFileSync(join(DEPLOY_DIR, 'DEPLOY-GUIDE.md'), deployGuide)
  console.log('✅ DEPLOY-GUIDE.md 已生成')

  // 5. 汇总
  const summary = {
    status: 'ready-for-deployment',
    artifacts: [
      { file: 'wiki-metadata.json', size: Buffer.byteLength(JSON.stringify(metadata, null, 2)) },
      { file: 'confluence-payload.html', size: existsSync(join(DEPLOY_DIR, 'confluence-payload.html')) ? readFileSync(join(DEPLOY_DIR, 'confluence-payload.html')).length : 0 },
      { file: 'exempt-report-confluence.html', size: existsSync(join(DEPLOY_DIR, 'exempt-report-confluence.html')) ? readFileSync(join(DEPLOY_DIR, 'exempt-report-confluence.html')).length : 0 },
      { file: 'DEPLOY-GUIDE.md', size: Buffer.byteLength(deployGuide) },
    ],
    next_steps: [
      '配置 GitHub Secrets 以启用 Confluence 自动部署',
      '或手动将 confluence-payload.html 内容粘贴到 Confluence',
      '设置 CONFLUENCE_PARENT_ID 以指定父页面',
    ],
  }

  writeFileSync(join(DEPLOY_DIR, 'deploy-summary.json'), JSON.stringify(summary, null, 2))
  console.log('✅ deploy-summary.json 已生成')

  console.log('\n📦 部署包生成完成: outputs/wiki-deploy/')
  console.log('   使用 DEPLOY-GUIDE.md 中的说明进行 Confluence 部署')
}

// ─── 主函数 ───
async function main(): Promise<void> {
  const config = getConfig()

  generateDeployPackage()

  if (config.url && config.token && config.space) {
    console.log('\n🚀 开始 Confluence 部署...')

    const docTitle = '组件命名规范与文档模板标准'
    const docContent = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : ''
    const confluenceHtml = markdownToConfluence(docContent)

    // 查找现有页面
    const existing = await findPageByTitle(config, docTitle)

    if (existing) {
      const currentVersion = existing.version?.number || 1
      console.log(`📄 找到现有页面 (v${currentVersion})`)
      await updatePage(config, existing.id, docTitle, confluenceHtml, currentVersion + 1)
    } else {
      console.log('📄 创建新页面...')
      const page = await createPage(config, docTitle, confluenceHtml, config.parentId)
      if (page) {
        console.log(`✅ 新页面已创建: ${page.id}`)
      }
    }

    console.log('\n📮 部署完成！')
  } else {
    console.log('\nℹ️  离线部署包已生成，等待配置 Confluence 环境变量后自动部署')
    console.log('   运行以下命令配置环境:')
    console.log('   set CONFLUENCE_URL=https://your-instance.atlassian.net')
    console.log('   set CONFLUENCE_TOKEN=your-api-token')
    console.log('   set CONFLUENCE_SPACE=ENG')
  }
}

main().catch((err) => {
  console.error('❌ 部署脚本执行失败:', err)
  process.exit(1)
})