param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

# Extra feature keywords not in original suggest-tags
$extraFeatures = @{
    "architecture"  = @('architecture','blueprint','infra','架构','adr')
    "management"    = @('management','governance','治理','管理')
    "analysis"      = @('analysis','analytical','分析','研究')
    "definition"    = @('definition','definitions','定义')
    "profile"       = @('profile','profiling','画像')
    "integration"   = @('integration','integrate','集成')
    "implementation" = @('implementation','implement','实施')
    "design"        = @('design-','-design','设计')
    "system"        = @('system','系统')
    "release"       = @('release','发布','部署')
    "review"        = @('review','review-report','复盘','回顾')
    "checklist"     = @('checklist','清单')
    "list"          = @('task-list','action-list','todo','待办')
    "drift"         = @('drift','mismatch','不一致','偏差')
    "standards"     = @('standards','standard','标准','规范')
    "frontend"      = @('ui-','-ui','frontend','前端')
    "backend"       = @('backend','后端')
    "data"          = @('data','数据')
    "product"       = @('product','prd','产品')
    "qa"            = @('quality','qa','测试')
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$enhanced = 0
$samples = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -notmatch '(?m)^tags\s*:\s*\[(.*)\]') { continue }
    $tagStr = $matches[1]
    $tags = ($tagStr -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
    if ($tags.Count -ne 2) { continue }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/").ToLower()
    $title = ""
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim().ToLower() }
    $text = "$base $title $relPath"

    $newTags = @($tags)
    foreach ($ft in $extraFeatures.Keys) {
        if ($newTags -contains $ft) { continue }
        foreach ($kw in $extraFeatures[$ft]) {
            if ($text.Contains($kw)) {
                if ($newTags -notcontains $ft) { $newTags += $ft }
                break
            }
        }
        if ($newTags.Count -ge 4) { break }
    }

    if ($newTags.Count -le 2) { continue }
    if ($newTags.Count -gt 5) { $newTags = $newTags[0..4] }

    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    if ($samples.Count -lt 15) { $samples += [PSCustomObject]@{ Path = $rel; Old = ($tags -join ", "); New = ($newTags -join ", ") } }

    if ($Apply) {
        $newTagStr = "[" + ($newTags -join ", ") + "]"
        $newFm = $fm -replace '(?m)^tags\s*:.*$', "tags: $newTagStr"
        $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
        [System.IO.File]::WriteAllText($doc.FullName, $newContent, (New-Object System.Text.UTF8Encoding $false))
    }
    $enhanced++
}

Write-Host "===== Tag Enhancement (2-tag -> 3+ tag) =====" -ForegroundColor Yellow
Write-Host "Enhanced: $enhanced"
if ($Apply) { Write-Host "Applied: $enhanced" -ForegroundColor Green }
Write-Host ""
Write-Host "=== Samples ===" -ForegroundColor Yellow
$samples | ForEach-Object {
    Write-Host "  $($_.Path)"
    Write-Host "     OLD: $($_.Old)"
    Write-Host "     NEW: $($_.New)"
}
