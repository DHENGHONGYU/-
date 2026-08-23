#!/usr/bin/env node
/**
 * @file scripts/audit/audit-actions-pin.cjs
 * @description GitHub Actions 钉扎防漂移审计（better-harness F-010）：
 *   .github/workflows/*.yml 中所有 `uses:` 引用必须以 40 位 commit SHA 钉扎
 *   （供应链安全：版本标签可被上游移动，SHA 不可变），并附 `# <版本>` 注释便于 Dependabot 升级。
 *
 *   - 发现版本标签/分支引用 → 列出位置并 exit 1
 *   - 注释行（行首 #）中的 uses 示例不计入
 *   - 本地 action（uses: ./xxx、uses: .github/actions/xxx）豁免
 *
 * 用法：node scripts/audit/audit-actions-pin.cjs
 * 挂载：package.json gate:quick
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const DIR = path.join(ROOT, '.github', 'workflows')
const SHA_RE = /^[0-9a-f]{40}$/i

const violations = []
let pinned = 0
let local = 0

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.yml'))) {
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('#')) return // 注释行示例不计
    const m = line.match(/^\s*(?:-\s*)?uses:\s*([^#\s]+)/)
    if (!m) return
    const ref = m[1]
    if (ref.startsWith('./') || ref.startsWith('.github/')) {
      local++
      return
    }
    const at = ref.lastIndexOf('@')
    if (at < 0) {
      violations.push(`${f}:${i + 1}  ${ref}（缺少 @ref）`)
      return
    }
    const ver = ref.slice(at + 1)
    if (SHA_RE.test(ver)) {
      pinned++
      // 建议版本注释（软性，仅提示不拦截）
      if (!/#\s*v?\d/.test(line)) {
        console.warn(`⚠️  ${f}:${i + 1}  ${ref.slice(0, at)} 已钉扎但缺版本注释（建议 "# v<版本>" 便于升级追踪）`)
      }
    } else {
      violations.push(`${f}:${i + 1}  ${ref}（非 SHA 钉扎）`)
    }
  })
}

if (violations.length > 0) {
  console.error(`❌ actions-pin 审计失败：${violations.length} 处未钉扎引用：`)
  for (const v of violations) console.error(`   ${v}`)
  console.error('   修复：git ls-remote https://github.com/<owner>/<repo> refs/tags/<tag> 获取 SHA 后钉扎，')
  console.error('   或等待 Dependabot（.github/dependabot.yml）自动升级 PR。')
  process.exit(1)
}

console.log(`✅ actions-pin 审计通过：${pinned} 处 SHA 钉扎、${local} 处本地 action、0 处版本标签引用`)
