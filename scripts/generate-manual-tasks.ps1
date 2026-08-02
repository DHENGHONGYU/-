param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [string]$OutPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs', '00-meta', 'phase2-manual-task-list.md')
)

$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$noPhase = @()
$needMaintainer = @()
$needSummary = @()
$reviewByDomain = @{}

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }

    $fm = $matches[1]
    $tier = "standard"
    $domain = "project"
    if ($fm -match '(?m)^tier\s*:\s*(.+)$') { $tier = $matches[1].Trim() }
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }

    if ($fm -notmatch '(?m)^phase\s*:') { $noPhase += $relPath }
    if ($fm -notmatch '(?m)^maintainer\s*:' -and $tier -in @('important','standard')) {
        $needMaintainer += [PSCustomObject]@{ Path = $relPath; Domain = $domain; Tier = $tier }
    }
    if ($fm -notmatch '(?m)^summary\s*:' -and $tier -eq 'important') {
        $needSummary += $relPath
    }
    if (-not $reviewByDomain.ContainsKey($domain)) { $reviewByDomain[$domain] = 0 }
    $reviewByDomain[$domain]++
}

# maintainer by domain
$mByDomain = $needMaintainer | Group-Object Domain | Sort-Object Count -Descending

$out = @()
$out += "---"
$out += "title: Phase 2 人工任务清单"
$out += "type: meta"
$out += "domain: project"
$out += "phase: planning"
$out += "tier: important"
$out += "status: active"
$out += "version: v1.0.0"
$out += "last_updated: 2026-07-17"
$out += "code_version: 2.0.0"
$out += "maintainer: V9 Architecture Team"
$out += "---"
$out += ""
$out += "# Phase 2 人工任务清单"
$out += ""
$out += "> 生成时间：$(Get-Date -Format 'yyyy-MM-dd')"
$out += "> 说明：以下任务无法完全自动化，需要各领域负责人人工处理"
$out += ""
$out += "---"
$out += ""
$out += "## 任务 A：type/domain 人工审核"
$out += ""
$out += "各领域文档数（需逐份确认 type/domain 推断是否正确）："
$out += ""
$out += "| 领域 | 文档数 | 负责人 | 状态 |"
$out += "|------|--------|--------|------|"
foreach ($k in ($reviewByDomain.Keys | Sort-Object)) {
    $out += "| $k | $($reviewByDomain[$k]) | 待指派 | 未开始 |"
}
$out += ""
$out += "**审核要点**：type 是否符合 Diataxis 分类；domain 归属是否正确；tier 分级是否合理"
$out += ""
$out += "---"
$out += ""
$out += "## 任务 B：phase 人工补全（$($noPhase.Count) 份无法自动推断）"
$out += ""
$out += "以下文档路径/标题无明显阶段特征，需人工判断："
$out += ""
foreach ($p in ($noPhase | Sort-Object)) { $out += "- [ ] ``$p``" }
$out += ""
$out += "---"
$out += ""
$out += "## 任务 C：maintainer 分配（$($needMaintainer.Count) 份 important/standard 文档）"
$out += ""
$out += "| 领域 | 待分配数 |"
$out += "|------|---------|"
foreach ($g in $mByDomain) { $out += "| $($g.Name) | $($g.Count) |" }
$out += ""
$out += "**分配原则**：important 级 -> 领域负责人；standard 级 -> 对应模块开发者"
$out += ""
$out += "---"
$out += ""
$out += "## 任务 D：summary 编写（$($needSummary.Count) 份 important 文档）"
$out += ""
$out += "规范：一句话 <= 100 字，说明文档核心内容 + 适用范围 + 关键价值"
$out += ""
$out += "按领域分工编写，文档组复核后批量写入"
$out += ""
$out += "---"
$out += ""
$out += "## 完成标准"
$out += ""
$out += "- [ ] 任务 A：type/domain 准确率 >= 90%"
$out += "- [ ] 任务 B：phase 覆盖率 >= 90%"
$out += "- [ ] 任务 C：maintainer 覆盖率 >= 60%"
$out += "- [ ] 任务 D：important 文档 summary 覆盖率 >= 80%"

$out | Set-Content -Path $OutPath -Encoding UTF8

Write-Host "Manual task list written: $OutPath"
Write-Host ""
Write-Host "Summary:"
Write-Host "  A. Docs to review (type/domain): $($docs.Count)"
Write-Host "  B. Missing phase (manual): $($noPhase.Count)"
Write-Host "  C. Need maintainer: $($needMaintainer.Count)"
Write-Host "  D. Need summary (important): $($needSummary.Count)"

