param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

function Infer-Phase3($relPath, $fileName, $title) {
    $p = "$relPath/$fileName".ToLower()
    $t = if ($title) { $title.ToLower() } else { "" }
    $all = "$p $t"

    # Chinese-named meta docs
    if ($all -match '报告|体检|核查|盘点|评分|总览') { return "retrospective" }
    if ($all -match '计划|规划|路线图|待办|清单|方案|培训|体系|结构') { return "planning" }
    if ($all -match '字典|架构|血缘|契约|映射') { return "design" }
    if ($all -match '实施|整改|修复') { return "development" }

    # English leftovers
    if ($all -match 'completeness-profile') { return "retrospective" }
    if ($all -match 'registry-index|/index\.md|/readme\.md') { return "planning" }
    if ($all -match 'doc-trigger-action-map|archive-management|training') { return "planning" }
    if ($all -match 'pr-description|prompt-merge-dedup') { return "development" }
    if ($all -match 'memory-layer|data-timeline|数据') { return "design" }
    return $null
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$infer=0; $manual=0; $applied=0; $manualList=@()

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^phase\s*:') { continue }

    $title = $null
    if ($fm -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }

    $phase = Infer-Phase3 $relPath $doc.Name $title
    if ($phase) {
        $infer++
        if ($Apply) {
            $newFm = $fm
            if ($fm -match '(?m)^status\s*:.*$') {
                $newFm = $fm -replace '(?m)^(status\s*:.*)$', ('$1' + "`n" + "phase: $phase")
            } elseif ($fm -match '(?m)^domain\s*:.*$') {
                $newFm = $fm -replace '(?m)^(domain\s*:.*)$', ('$1' + "`n" + "phase: $phase")
            } else {
                $newFm = $fm.TrimEnd() + "`nphase: $phase"
            }
            $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
            Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $applied++
        }
    } else {
        $manual++
        $manualList += $relPath
    }
}

Write-Host "===== Phase Batch 3 Summary =====" -ForegroundColor Yellow
Write-Host "Can infer: $infer"
Write-Host "Cannot infer: $manual"
if ($Apply) { Write-Host "Applied: $applied" -ForegroundColor Green }
if ($manualList.Count -le 60) {
    Write-Host ""
    Write-Host "Remaining manual:" -ForegroundColor Yellow
    $manualList | ForEach-Object { Write-Host "  $_" }
}
