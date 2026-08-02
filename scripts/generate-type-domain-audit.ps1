param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [int]$PerStratum = 2
)

$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$all = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $type = ""; $domain = ""; $tier = ""; $title = ""
    if ($fm -match '(?m)^type\s*:\s*(.+)$') { $type = $matches[1].Trim() }
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($fm -match '(?m)^tier\s*:\s*(.+)$') { $tier = $matches[1].Trim() }
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }
    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $all += [PSCustomObject]@{ Path = $rel; Type = $type; Domain = $domain; Tier = $tier; Title = $title }
}

Write-Host "Total: $($all.Count)"
Write-Host ""
Write-Host "=== Domain x Type matrix ===" -ForegroundColor Yellow
$domains = ($all | Select-Object -ExpandProperty Domain -Unique | Sort-Object)
$types = ($all | Select-Object -ExpandProperty Type -Unique | Sort-Object)
$header = "{0,-15}" -f "domain\type"
foreach ($t in $types) { $header += "{0,-12}" -f $t }
$header += "{0,-8}" -f "Total"
Write-Host $header
foreach ($d in $domains) {
    $row = "{0,-15}" -f $d
    $dTotal = 0
    foreach ($t in $types) {
        $c = ($all | Where-Object { $_.Domain -eq $d -and $_.Type -eq $t }).Count
        $row += "{0,-12}" -f $c
        $dTotal += $c
    }
    $row += "{0,-8}" -f $dTotal
    Write-Host $row
}
$trow = "{0,-15}" -f "Total"
$grand = 0
foreach ($t in $types) {
    $c = ($all | Where-Object { $_.Type -eq $t }).Count
    $trow += "{0,-12}" -f $c
    $grand += $c
}
$trow += "{0,-8}" -f $grand
Write-Host $trow

Write-Host ""
Write-Host "=== Stratified sample ($PerStratum per stratum) ===" -ForegroundColor Yellow
$sample = @()
foreach ($d in $domains) {
    foreach ($t in $types) {
        $group = @($all | Where-Object { $_.Domain -eq $d -and $_.Type -eq $t })
        if ($group.Count -eq 0) { continue }
        $take = [Math]::Min($PerStratum, $group.Count)
        $selected = $group | Get-Random -Count $take
        foreach ($s in $selected) {
            $sample += [PSCustomObject]@{ Domain = $d; Type = $t; Path = $s.Path; Title = $s.Title; Tier = $s.Tier; Correct_Type = ""; Correct_Domain = ""; Notes = "" }
        }
    }
}

Write-Host "Sample size: $($sample.Count)"

$outCsv = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs', '00-meta', 'type-domain-audit-sample.csv')
$sample | Export-Csv -Path $outCsv -NoTypeInformation -Encoding UTF8
Write-Host "Sample CSV: $outCsv"

# also generate a markdown audit worksheet
$outMd = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs', '00-meta', 'type-domain-audit-worksheet.md')
$md = @()
$md += "---"
$md += "title: Type/Domain 抽样审计工作表"
$md += "type: meta"
$md += "domain: project"
$md += "phase: testing"
$md += "tier: standard"
$md += "status: active"
$md += "version: v1.0.0"
$md += "last_updated: $(Get-Date -Format 'yyyy-MM-dd')"
$md += "code_version: 2.0.0"
$md += "maintainer: V9 Architecture Team"
$md += "summary: 'Type/Domain 分层抽样审计工作表，按 8 个领域 × 6 种文档类型抽取样本，人工核验推断准确率。'"
$md += "tags: [project, audit]"
$md += "---"
$md += ""
$md += "# Type/Domain 抽样审计工作表"
$md += ""
$md += "> 抽样方法：按 **domain × type** 分层，每层抽 2 份（不足则全取）。"
$md += "> 总样本量：$($sample.Count) / 668（$([math]::Round($sample.Count/668*100, 1))%）"
$md += ""
$md += "## 审计说明"
$md += ""
$md += "| 项 | 说明 |"
$md += "|----|------|"
$md += "| 判定规则 | 打开文档读第一段，判断文档类型（Diataxis 四型+报告+元文档）和所属领域是否合理 |"
$md += "| 填写方式 | 每行的 Correct_Type / Correct_Domain 列填入实际值（若原值正确则留空或填 same） |"
$md += "| 置信等级 | A=肯定正确 / B=基本正确 / C=存疑 / D=错误 |"
$md += ""

foreach ($d in $domains) {
    $dSamples = $sample | Where-Object { $_.Domain -eq $d }
    if ($dSamples.Count -eq 0) { continue }
    $md += "## $d 领域（$($dSamples.Count) 份）"
    $md += ""
    $md += "| # | 文档 | 原值 type | 原值 domain | 判定 type | 判定 domain | 置信 | 备注 |"
    $md += "|---|------|-----------|------------|----------|------------|------|------|"
    $i = 0
    foreach ($s in $dSamples) {
        $i++
        $md += "| $i | [$($s.Path)]($($s.Path)) | $($s.Type) | $($s.Domain) | | | | |"
    }
    $md += ""
}

$md -join "`n" | Set-Content $outMd -Encoding UTF8
Write-Host "Audit worksheet: $outMd"

