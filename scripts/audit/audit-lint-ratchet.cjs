#!/usr/bin/env node
/**
 * @file scripts/audit/audit-lint-ratchet.cjs
 * @description lint 警告 ratchet 门禁（better-harness F-006）：
 *   eslint src/ 的警告数只允许降、不允许升。
 *   - 实测 > 基线：exit 1，并列出警告增量最大的文件辅助定位
 *   - 实测 < 基线：自动收紧——回写 .lint-warning-baseline.json（棘轮单向）
 *   - 存在 error：无条件 exit 1（errorsMustBeZero）
 *
 * 用法：
 *   node scripts/audit/audit-lint-ratchet.cjs            # 校验（日常 / npm run lint / gate）
 *   node scripts/audit/audit-lint-ratchet.cjs --update   # 强制以实测值回写基线
 *
 * 基线文件：.lint-warning-baseline.json（根目录，与 .complexity-baseline.json 同风格）
 */
'use strict'

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const BASELINE_FILE = path.join(ROOT, '.lint-warning-baseline.json')
const FORCE_UPDATE = process.argv.includes('--update')

/** 运行 eslint 并返回 JSON 结果数组 */
function runEslint() {
  // 直接以当前 node 执行本地 eslint 二进制，避免 npx/shell 跨平台差异（Node 22 shell:true 弃用警告）
  const eslintBin = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js')
  if (!fs.existsSync(eslintBin)) {
    console.error('❌ 未找到本地 eslint（node_modules/eslint），请先 npm install')
    process.exit(1)
  }
  const res = spawnSync(
    process.execPath,
    [eslintBin, 'src/', '--ext', '.ts,.tsx', '--format', 'json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
  // eslint 有警告时 exit code = 0，有 error 时 = 1；两者都产出 JSON，仅在无法解析时视为失败
  if (!res.stdout) {
    console.error('❌ eslint 无输出：', res.stderr || res.error?.message || '未知错误')
    process.exit(1)
  }
  try {
    return JSON.parse(res.stdout)
  } catch {
    console.error('❌ eslint JSON 输出解析失败（请手动运行 npm run lint 确认）')
    process.exit(1)
  }
}

function main() {
  const results = runEslint()
  const warnings = results.reduce((a, f) => a + (f.warningCount || 0), 0)
  const errors = results.reduce((a, f) => a + (f.errorCount || 0), 0)

  // error 无条件拦截
  if (errors > 0) {
    const errFiles = results.filter((f) => f.errorCount > 0).slice(0, 10)
    console.error(`❌ lint ratchet：存在 ${errors} 个 error，必须先修复：`)
    for (const f of errFiles) {
      console.error(`   ${path.relative(ROOT, f.filePath)}  (+${f.errorCount})`)
    }
    process.exit(1)
  }

  // 基线缺失时初始化
  if (!fs.existsSync(BASELINE_FILE)) {
    const init = {
      version: 1,
      generatedAt: new Date().toISOString(),
      scope: 'eslint src/ --ext .ts,.tsx',
      warningBaseline: warnings,
      errorsMustBeZero: true,
      note: 'lint 警告 ratchet 基线（首次初始化），只允许降不允许升',
    }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(init, null, 2) + '\n', 'utf8')
    console.log(`✅ lint ratchet：基线缺失，已按实测 ${warnings} 警告初始化 ${path.relative(ROOT, BASELINE_FILE)}`)
    return
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
  const base = Number(baseline.warningBaseline ?? 0)

  if (FORCE_UPDATE) {
    baseline.warningBaseline = warnings
    baseline.generatedAt = new Date().toISOString()
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
    console.log(`✅ lint ratchet：--update 强制回写基线 ${base} → ${warnings}`)
    return
  }

  if (warnings > base) {
    const top = results
      .filter((f) => f.warningCount > 0)
      .sort((a, b) => b.warningCount - a.warningCount)
      .slice(0, 10)
    console.error(`❌ lint ratchet：警告 ${warnings} > 基线 ${base}（+${warnings - base}），禁止新增警告：`)
    for (const f of top) {
      console.error(`   ${path.relative(ROOT, f.filePath)}  (${f.warningCount})`)
    }
    console.error('   修复新增警告后重试；如属有意调整请人工复核后运行 --update。')
    process.exit(1)
  }

  if (warnings < base) {
    // 棘轮单向收紧：实测更低时自动回写基线
    baseline.warningBaseline = warnings
    baseline.generatedAt = new Date().toISOString()
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
    console.log(`✅ lint ratchet：警告 ${base} → ${warnings}，基线已自动收紧（-${base - warnings}）`)
    return
  }

  console.log(`✅ lint ratchet：警告 ${warnings} = 基线 ${base}，0 error，通过`)
}

main()
