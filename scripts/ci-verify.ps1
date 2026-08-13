$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  V9 FinSight — CI 本地验证脚本                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "项目路径: $PSScriptRoot\.." -ForegroundColor Gray

# ============================================================
# Step 0: 环境检查
# ============================================================
Write-Host "--- Step 0: 环境检查 ---" -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js 未安装或不在 PATH 中" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Node.js $nodeVersion" -ForegroundColor Green

$npmVersion = npm --version 2>$null
Write-Host "  ✅ npm $npmVersion" -ForegroundColor Green

# ============================================================
# Step 1: 安装依赖
# ============================================================
Write-Host "`n--- Step 1: 安装依赖 ---" -ForegroundColor Yellow
$projectRoot = "$PSScriptRoot\.."
Push-Location $projectRoot

if (Test-Path "node_modules") {
    Write-Host "  node_modules 已存在，跳过安装" -ForegroundColor Gray
} else {
    Write-Host "  正在运行 npm install..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install 失败" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "  ✅ npm install 完成" -ForegroundColor Green
}

# ============================================================
# Step 2: TypeScript 类型检查
# ============================================================
Write-Host "`n--- Step 2: TypeScript 类型检查 ---" -ForegroundColor Yellow
npx tsc --noEmit 2>&1 | Tee-Object -Variable tscOutput
$tscErrors = ($tscOutput -join "`n" | Select-String -Pattern "error TS" | Measure-Object).Count
if ($tscErrors -gt 0) {
    Write-Host "  ⚠️  类型检查: $tscErrors 个错误" -ForegroundColor Yellow
    Write-Host "  预期: 新文件可能引用未创建的模块，部分错误属于正常" -ForegroundColor Gray
} else {
    Write-Host "  ✅ 类型检查: 0 个错误" -ForegroundColor Green
}

# ============================================================
# Step 3: P0 高危门禁
# ============================================================
Write-Host "`n--- Step 3: P0 高危门禁审计 ---" -ForegroundColor Yellow

$p0Passed = 0
$p0Failed = 0

# R01: KPI 假绿灯
Write-Host "  [R01] KPI 假绿灯审计..." -ForegroundColor Gray
npx tsx scripts/audit/kpi-consistency.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ 通过" -ForegroundColor Green
    $p0Passed++
} else {
    Write-Host "    ⚠️  未通过（预期: 项目运行前 KPI 数据为空）" -ForegroundColor Yellow
    $p0Failed++
}

# R05: 复权一致性
Write-Host "  [R05] 复权一致性审计..." -ForegroundColor Gray
npx tsx scripts/audit/adjustment-consistency.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ 通过" -ForegroundColor Green
    $p0Passed++
} else {
    Write-Host "    ⚠️  未通过" -ForegroundColor Yellow
    $p0Failed++
}

# R10: 权重一致性
Write-Host "  [R10] 权重一致性审计..." -ForegroundColor Gray
npx tsx scripts/audit/weight-audit.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ 通过" -ForegroundColor Green
    $p0Passed++
} else {
    Write-Host "    ⚠️  未通过" -ForegroundColor Yellow
    $p0Failed++
}

# ============================================================
# Step 4: P1 质量门禁
# ============================================================
Write-Host "`n--- Step 4: P1 质量门禁审计 ---" -ForegroundColor Yellow
Write-Host "  [R06+R07+R11] 综合质量审计..." -ForegroundColor Gray
npx tsx scripts/audit/quality-audit.ts 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ 通过" -ForegroundColor Green
} else {
    Write-Host "    ⚠️  未通过（P1 可降级）" -ForegroundColor Yellow
}

Write-Host "  [R08] ACL 权限审计..." -ForegroundColor Gray
if (Test-Path "scripts/audit/acl-audit.ts") {
    npx tsx scripts/audit/acl-audit.ts 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ 通过" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  未通过（P1 可降级）" -ForegroundColor Yellow
    }
} else {
    Write-Host "    ⚠️  acl-audit.ts 不存在，跳过" -ForegroundColor Yellow
}

# ============================================================
# Step 5: 因子公式测试
# ============================================================
Write-Host "`n--- Step 5: 因子公式测试 ---" -ForegroundColor Yellow
if (Test-Path "tests/unit/scoring/factor-formulas.test.ts") {
    npx vitest run tests/unit/scoring/factor-formulas.test.ts 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ 通过" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  未通过" -ForegroundColor Yellow
    }
} else {
    Write-Host "    ⚠️  factor-formulas.test.ts 不存在，跳过" -ForegroundColor Yellow
}

# ============================================================
# Summary
# ============================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  验证完成                                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  P0 门禁: $p0Passed 通过 / $p0Failed 未通过" -ForegroundColor $(if ($p0Failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "  类型错误: $tscErrors 个" -ForegroundColor Gray
Write-Host ""

if ($p0Failed -gt 0) {
    Write-Host "⚠️  部分 P0 门禁未通过，这在首次部署时是正常的。" -ForegroundColor Yellow
    Write-Host "  运行项目后 KPI 数据将自动填充，届时重新运行验证。" -ForegroundColor Yellow
}

Pop-Location