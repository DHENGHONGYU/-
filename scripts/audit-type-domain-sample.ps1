param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [string]$Worksheet = "g:\FinSightV9\docs\00-meta\type-domain-audit-worksheet.md"
)

$ErrorActionPreference = "Stop"

# Ground-truth inference for type (Diataxis)
function Infer-Type($relPath, $fileName, $body) {
    $p = "$relPath/$fileName".ToLower()
    # strong path signals
    if ($p -match '/tutorials/') { return "tutorials" }
    if ($p -match '/how-to/') { return "how-to" }
    if ($p -match '/reference/') { return "reference" }
    if ($p -match '/explanation/') { return "explanation" }
    if ($p -match '/reports/') { return "reports" }
    if ($p -match '/00-meta/') { return "meta" }
    # name signals
    if ($fileName -match 'report|报告|体检|盘点|评估|audit|review') { return "reports" }
    if ($fileName -match 'adr-|decision') { return "explanation" }
    if ($fileName -match 'spec|standard|标准|规范|reference|字典|dictionary') { return "reference" }
    if ($fileName -match 'guide|how-to|tutorial|handbook') { return "how-to" }
    if ($fileName -match 'plan|todo|清单|checklist|schedule|roadmap') { return "meta" }
    if ($fileName -match 'changelog|update-log|日志') { return "meta" }
    return $null
}

# Ground-truth inference for domain
function Infer-Domain($relPath, $fileName, $body) {
    $p = "$relPath/$fileName".ToLower()
    $text = $p + " " + ($body -split "`n" | Select-Object -First 10) -join " "
    $text = $text.ToLower()

    $scores = @{}
    # high-signal keywords
    $kw = @{
        data = @('data-definition','data-dictionary','dictionary','dataflow','databridge','data-bridge','data-layer','indexeddb','schema','store','stock-pool','asset','data-lineage','db-migration','dataset','seven-dim','multi-factor','数据','collection','collector')
        frontend = @('ui-','-ui','ux','widget','component','cockpit','page','layout','theme','a11y','i18n','visual','css','spacing','design-token','kimi','portalshell','navigation','route','routing','interaction','icon','chart','dark','前端','界面','颜色')
        backend = @('engine','service','algo','backtest','strategy','screening','trading','factor','pipeline','signal','scoring','score','algorithm','交易','策略','后端','position')
        ai = @('mcp','agent','llm','prompt','ai-','-ai','memory-layer','skill','智能')
        qa = @('test','qa','audit','checklist','verification','regression','security-test','penetration','vulnerability','quality','coverage','e2e','测试','验收','核查')
        architecture = @('architecture','adr','blueprint','infra','framework','system-architecture','design-principles','complexity','架构','adr-','migration')
        product = @('prd','persona','scenario','competitive','product','requirement','user-','privacy','产品','需求')
        project = @('meta','governance','changelog','cleanup','documentation','计划','清单','报告','日志','管理','治理')
    }
    foreach ($d in $kw.Keys) {
        $s = 0
        foreach ($k in $kw[$d]) {
            $s += [regex]::Matches($text, [regex]::Escape($k)).Count
        }
        if ($s -gt 0) { $scores[$d] = $s }
    }
    if ($scores.Count -eq 0) { return $null }
    $top = $scores.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
    return $top.Key
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

# Get sample from worksheet
$samplePaths = @()
$ws = Get-Content $Worksheet -Encoding UTF8
foreach ($line in $ws) {
    if ($line -match '\|\s*\d+\s*\|\s*\[([^\]]+)\]\(') {
        $samplePaths += $matches[1]
    }
}
Write-Host "Sample size from worksheet: $($samplePaths.Count)"

$typeCorrect = 0; $typeWrong = 0; $typeUnsure = 0
$domainCorrect = 0; $domainWrong = 0; $domainUnsure = 0
$results = @()

foreach ($sPath in $samplePaths) {
    $fullPath = Join-Path $DocsPath ($sPath -replace '/', '\')
    if (-not (Test-Path $fullPath)) { continue }
    $content = Get-Content $fullPath -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n(.*)$') { continue }
    $fm = $matches[1]; $body = $matches[2]
    $type = ""; $domain = ""
    if ($fm -match '(?m)^type\s*:\s*(.+)$') { $type = $matches[1].Trim() }
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }

    $fileName = [System.IO.Path]::GetFileName($sPath)
    $relDir = [System.IO.Path]::GetDirectoryName($sPath).Replace('\', '/')

    $infType = Infer-Type $relDir $fileName $body
    $infDomain = Infer-Domain $relDir $fileName $body

    $typeVer = "same"
    if ($infType -and $infType -ne $type) { $typeVer = "WRONG:$infType"; $typeWrong++ }
    elseif ($infType -and $infType -eq $type) { $typeCorrect++ }
    else { $typeUnsure++ }

    $domVer = "same"
    if ($infDomain -and $infDomain -ne $domain) { $domVer = "WRONG:$infDomain"; $domainWrong++ }
    elseif ($infDomain -and $infDomain -eq $domain) { $domainCorrect++ }
    else { $domainUnsure++ }

    $results += [PSCustomObject]@{ Path = $sPath; Type = $type; Type_Check = $typeVer; Domain = $domain; Domain_Check = $domVer }
}

Write-Host ""
Write-Host "===== Type Audit (rule-based baseline) =====" -ForegroundColor Yellow
Write-Host "Correct: $typeCorrect"
Write-Host "Probably wrong: $typeWrong"
Write-Host "Unsure (no strong signal): $typeUnsure"
Write-Host ("Accuracy (of confident): {0:P1}" -f ($typeCorrect / [Math]::Max(1, ($typeCorrect + $typeWrong))))

Write-Host ""
Write-Host "===== Domain Audit (rule-based baseline) =====" -ForegroundColor Yellow
Write-Host "Correct: $domainCorrect"
Write-Host "Probably wrong: $domainWrong"
Write-Host "Unsure (no strong signal): $domainUnsure"
Write-Host ("Accuracy (of confident): {0:P1}" -f ($domainCorrect / [Math]::Max(1, ($domainCorrect + $domainWrong))))

Write-Host ""
Write-Host "=== Type Mismatches ===" -ForegroundColor Yellow
$results | Where-Object { $_.Type_Check -match 'WRONG' } | ForEach-Object {
    "  [$($_.Type) -> $($_.Type_Check.Replace('WRONG:',''))] $($_.Path)"
}
Write-Host ""
Write-Host "=== Domain Mismatches ===" -ForegroundColor Yellow
$results | Where-Object { $_.Domain_Check -match 'WRONG' } | ForEach-Object {
    "  [$($_.Domain) -> $($_.Domain_Check.Replace('WRONG:',''))] $($_.Path)"
}
