param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

$fmFieldPattern = '^(title|type|domain|phase|status|tier|version|last_updated|code_version|doc_system_version|maintainer|tags|summary|doc_id|change_log|deprecated_by|deprecated_reason|deprecated_date|superseded_by|supersedes|decision_date|owner|updated|date|deprecated|replaced_by|audience|review_date|related_docs|confidence|doc-manifest|registry)\s*:'
$fmSectionPattern = '^# (Classification|Version|People|Metadata)'

function Is-FMLine($line) {
    $l = $line.Trim()
    if ($l -eq "") { return $true }
    if ($l -match '^#') {
        if ($l -match $fmSectionPattern) { return $true }
        if ($l -match '^#\s*\w[\w-]*\s*:') { return $true }
        return $false
    }
    if ($l -match $fmFieldPattern) { return $true }
    if ($l -match '^\s*-\s*.+$') { return $true }
    return $false
}

function Count-ConsecutiveFMLines($lines, $startIdx) {
    $count = 0
    $hasFMField = $false
    for ($i = $startIdx; $i -lt [math]::Min($startIdx + 60, $lines.Count); $i++) {
        if (Is-FMLine $lines[$i]) {
            $count++
            if ($lines[$i].Trim() -match $fmFieldPattern) { $hasFMField = $true }
        } else {
            break
        }
    }
    if ($hasFMField -and $count -ge 3) { return $count }
    return 0
}

function Find-RealBodyStart($lines) {
    if ($lines[0].Trim() -ne "---") { return 0 }
    
    $endIdx = -1
    for ($i = 1; $i -lt [math]::Min($lines.Count, 80); $i++) {
        if ($lines[$i].Trim() -eq "---") {
            $endIdx = $i
            break
        }
    }
    if ($endIdx -eq -1) { return 0 }
    
    $pos = $endIdx + 1
    while ($pos -lt $lines.Count -and $lines[$pos].Trim() -eq "") { $pos++ }
    
    while ($pos -lt $lines.Count) {
        if ($lines[$pos].Trim() -eq "---") {
            $nextEnd = -1
            for ($j = $pos + 1; $j -lt [math]::Min($pos + 60, $lines.Count); $j++) {
                if ($lines[$j].Trim() -eq "---") { $nextEnd = $j; break }
            }
            if ($nextEnd -gt 0) {
                $fmLines = 0
                for ($k = $pos + 1; $k -lt $nextEnd; $k++) {
                    if ($lines[$k].Trim() -match $fmFieldPattern) { $fmLines++ }
                }
                if ($fmLines -ge 2) {
                    $pos = $nextEnd + 1
                    while ($pos -lt $lines.Count -and $lines[$pos].Trim() -eq "") { $pos++ }
                    continue
                }
            }
        }
        
        $fmCount = Count-ConsecutiveFMLines $lines $pos
        if ($fmCount -ge 3) {
            $pos += $fmCount
            while ($pos -lt $lines.Count -and $lines[$pos].Trim() -eq "") { $pos++ }
            continue
        }
        
        break
    }
    
    return $pos
}

function Infer-Metadata($relPath, $fileName, $fileDate) {
    $result = @{
        type = "reference"
        domain = "project"
        phase = $null
        status = "active"
        tier = "standard"
        last_updated = $fileDate.ToString("yyyy-MM-dd")
        version = "v1.0.0"
    }
    
    $pathLower = $relPath.ToLower()
    $nameLower = $fileName.ToLower()
    
    if ($pathLower -match '00-meta|meta/') { $result.type = "meta" }
    elseif ($pathLower -match 'reference/') { $result.type = "reference" }
    elseif ($pathLower -match 'explanation/|design/|architecture/') { $result.type = "explanation" }
    elseif ($pathLower -match 'how-to/|guide/') { $result.type = "how-to" }
    elseif ($pathLower -match 'tutorials/|learning/') { $result.type = "tutorials" }
    elseif ($pathLower -match 'reports/|audit/|retro/') { $result.type = "reports" }
    
    if ($pathLower -match 'architecture|infra/|core/|framework') { $result.domain = "architecture" }
    elseif ($pathLower -match 'frontend|ui/|ux/|components|widgets|pages|views|react') { $result.domain = "frontend" }
    elseif ($pathLower -match 'backend|service|engine|algo|services/') { $result.domain = "backend" }
    elseif ($pathLower -match 'data|database|storage|datalayer|schema|store') { $result.domain = "data" }
    elseif ($pathLower -match 'ai/|llm|agent|mcp|model|prompt') { $result.domain = "ai" }
    elseif ($pathLower -match 'test|qa/|quality|audit') { $result.domain = "qa" }
    elseif ($pathLower -match 'project|management|process|team|handbook') { $result.domain = "project" }
    elseif ($pathLower -match 'product|requirement|prd|01-') { $result.domain = "product" }
    
    if ($pathLower -match 'design|architecture') { $result.phase = "design" }
    elseif ($pathLower -match 'plan|vision|goal') { $result.phase = "planning" }
    elseif ($pathLower -match 'requirement|prd') { $result.phase = "requirements" }
    elseif ($pathLower -match 'test|qa|audit') { $result.phase = "testing" }
    elseif ($pathLower -match 'deploy|release') { $result.phase = "deployment" }
    elseif ($pathLower -match 'retro|review|lesson|summary') { $result.phase = "retrospective" }
    
    if ($nameLower -match 'readme|index|manifest|inventory|registry') { $result.tier = "reference" }
    elseif ($nameLower -match 'adr-|decision|standard|spec') { $result.tier = "important" }
    elseif ($nameLower -match 'todo|draft|wip|temp') { $result.tier = "quick-note"; $result.status = "draft" }
    
    if ($pathLower -match 'deprecated|old/|legacy') { $result.status = "deprecated" }
    if ($pathLower -match 'archive') { $result.status = "archived" }
    
    return $result
}

function Get-FirstTitle($lines, $bodyStart, $fileName) {
    for ($i = $bodyStart; $i -lt [math]::Min($bodyStart + 20, $lines.Count); $i++) {
        if ($lines[$i] -match '^#\s+(.+)') {
            return $matches[1].Trim()
        }
    }
    return [System.IO.Path]::GetFileNameWithoutExtension($fileName)
}

function Build-CleanFrontmatter($title, $inf) {
    $lines = @("---")
    $lines += "title: $title"
    $lines += "type: $($inf.type)"
    $lines += "domain: $($inf.domain)"
    if ($inf.phase) { $lines += "phase: $($inf.phase)" }
    $lines += "tier: $($inf.tier)"
    $lines += "status: $($inf.status)"
    $lines += "version: $($inf.version)"
    $lines += "last_updated: $($inf.last_updated)"
    $lines += "code_version: 2.0.0"
    $lines += "---"
    return ($lines -join "`n")
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$total = $docs.Count
$broken = 0
$fixed = 0
$errors = 0

Write-Host "Scanning $total documents..." -ForegroundColor Cyan
Write-Host ""

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    try {
        $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    } catch { continue }
    
    $lines = $content -split "`r?`n"
    if ($lines.Count -lt 5) { continue }
    if ($lines[0].Trim() -ne "---") { continue }
    
    $bodyStart = Find-RealBodyStart $lines
    
    $headerLines = 0
    for ($i = 0; $i -lt [math]::Min($bodyStart, 80); $i++) {
        if ($lines[$i].Trim() -eq "---") { $headerLines++ }
    }
    
    $fmContentLines = 0
    for ($i = 0; $i -lt $bodyStart; $i++) {
        if ($lines[$i].Trim() -match $fmFieldPattern) { $fmContentLines++ }
    }
    
    if ($bodyStart -le 25 -or $fmContentLines -le 10) { continue }
    
    $broken++
    
    if ($Apply) {
        $fileName = $doc.Name
        $title = Get-FirstTitle $lines $bodyStart $fileName
        $inf = Infer-Metadata $relPath $fileName $doc.LastWriteTime
        $newFm = Build-CleanFrontmatter $title $inf
        
        $bodyLines = $lines[$bodyStart..($lines.Count - 1)]
        $body = ($bodyLines -join "`n").TrimStart()
        $newContent = $newFm + "`n`n" + $body
        
        Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $fixed++
        Write-Host "  [FIXED] $relPath (header was $bodyStart lines, $fmContentLines FM fields)" -ForegroundColor Green
    } else {
        Write-Host "  [BROKEN] $relPath (header $bodyStart lines, $fmContentLines FM fields)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Yellow
Write-Host "Total scanned: $total"
Write-Host "Broken (corrupted frontmatter): $broken"
if ($Apply) {
    Write-Host "Fixed: $fixed" -ForegroundColor Green
    Write-Host "Errors: $errors" -ForegroundColor Red
} else {
    Write-Host "Run with -Apply to fix all $broken files." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Done." -ForegroundColor Cyan

