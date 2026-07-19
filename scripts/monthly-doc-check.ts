/**
 * 月度文档健康检查 (monthly-doc-check)
 *
 * 每月运行一次，聚合以下检查：
 * 1. 文档同步一致性 (audit:docs)
 * 2. 文档完整性 (audit:doc-integrity)
 * 3. 版本漂移 (audit-version-drift)
 *
 * @since 2026-07-18 (P2 — 补齐缺失脚本)
 */

async function run(name: string, cmd: string[]) {
  const { execSync } = await import('child_process')
  console.log(`\n=== ${name} ===`)
  try {
    const out = execSync(`npx tsx ${cmd.join(' ')}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120_000,
      cwd: process.cwd(),
    })
    console.log(out.slice(-300))
  } catch (err: any) {
    console.error(`❌ ${name} 失败:`, err.stderr?.slice(-200) ?? String(err))
  }
}

async function main() {
  console.log('=== 月度文档健康检查 ===\n')
  await run('audit:docs', ['scripts/audit-doc-sync.ts'])
  await run('audit:doc-integrity', ['scripts/audit-doc-integrity.ts'])
  await run('audit-version-drift', ['scripts/audit-version-drift.ts'])
  console.log('\n=== 月度检查完成 ===')
}

main().catch(console.error)
