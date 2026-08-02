param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs'),
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

$coreFields = @("title", "type", "domain", "status", "tier", "last_updated", "version")
$fmFieldPattern = '^(?<key>\w[\w-]*)\s*:\s*(?<value>.*?)\s*(?<comment>#.*)?$'
$tierEnum = @("reference", "important", "standard", "quick-note")
$statusEnum = @("draft", "active", "deprecated", "archived")
$typeEnum = @("reference", "explanation", "how-to", "tutorials", "reports", "meta")
$domainEnum = @("architecture", "frontend", "backend", "data", "ai", "qa", "project", "product")
$phaseEnum = @("planning", "requirements", "design", "development", "testing", "deployment", "retrospective")

function Get-Frontmatter($content) {
    $lines = $content -split "`r?`n"
    if ($lines[0].Trim() -ne "---") { return $null }
    
    $endIdx = -1
    for ($i = 1; $i -lt [math]::Min($lines.Count, 100); $i++) {
        if ($lines[$i].Trim() -eq "---") { $endIdx = $i; break }
    }
    if ($endIdx -eq -1) { return $null }
    
    $fm = @{}
    $order = @()
    $rawLines = @{}
    for ($i = 1; $i -lt $endIdx; $i++) {
        $line = $lines[$i].TrimEnd()
        if ($line -match '^(?<key>\w[\w-]*)\s*:\s*(?<value>.*)$') {
            $key = $matches['key']
            $val = $matches['value']
            $fm[$key] = $val
            $order += $key
            $rawLines[$key] = $line
        }
    }
    return @{ fm = $fm; order = $order; endIdx = $endIdx; lines = $lines; rawLines = $rawLines }
}

function Clean-Value($val) {
    if ($val -match '^(.*?)\s*#\s*(TODO|migrated|NOTE|FIXME).*$') {
        return $matches[1].Trim()
    }
    return $val.Trim()
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

function Is-ValidEnum($val, $enum) {
    return $enum -contains $val
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$total = $docs.Count
$cleaned = 0
$completed = 0
$errors = 0

Write-Host "Scanning $total documents..." -ForegroundColor Cyan
Write-Host ""

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    try {
        $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    } catch { continue }
    
    $fmData = Get-Frontmatter $content
    if (-not $fmData) { continue }
    
    $fm = $fmData.fm
    $order = $fmData.order
    $lines = $fmData.lines
    $endIdx = $fmData.endIdx
    
    $changed = $false
    $hadInvalid = $false
    
    $keys = @($fm.Keys)
    foreach ($key in $keys) {
        $val = $fm[$key]
        $cleanedVal = Clean-Value $val
        if ($cleanedVal -ne $val) {
            $fm[$key] = $cleanedVal
            $changed = $true
            $hadInvalid = $true
        }
    }
    
    $inf = $null
    
    foreach ($field in $coreFields) {
        if (-not $fm.ContainsKey($field) -or $fm[$field] -eq "") {
            if (-not $inf) { $inf = Infer-Metadata $relPath $doc.Name $doc.LastWriteTime }
            $fm[$field] = $inf[$field]
            if ($order -notcontains $field) { $order += $field }
            $changed = $true
            $hadInvalid = $true
        }
    }
    
    if ($fm.ContainsKey("tier") -and -not (Is-ValidEnum $fm["tier"] $tierEnum)) {
        if (-not $inf) { $inf = Infer-Metadata $relPath $doc.Name $doc.LastWriteTime }
        $fm["tier"] = $inf["tier"]
        $changed = $true
        $hadInvalid = $true
    }
    
    if ($fm.ContainsKey("status") -and -not (Is-ValidEnum $fm["status"] $statusEnum)) {
        if (-not $inf) { $inf = Infer-Metadata $relPath $doc.Name $doc.LastWriteTime }
        $fm["status"] = $inf["status"]
        $changed = $true
        $hadInvalid = $true
    }
    
    if ($fm.ContainsKey("type") -and -not (Is-ValidEnum $fm["type"] $typeEnum)) {
        if (-not $inf) { $inf = Infer-Metadata $relPath $doc.Name $doc.LastWriteTime }
        $fm["type"] = $inf["type"]
        $changed = $true
        $hadInvalid = $true
    }
    
    if ($fm.ContainsKey("domain") -and -not (Is-ValidEnum $fm["domain"] $domainEnum)) {
        if (-not $inf) { $inf = Infer-Metadata $relPath $doc.Name $doc.LastWriteTime }
        $fm["domain"] = $inf["domain"]
        $changed = $true
        $hadInvalid = $true
    }
    
    if (-not $hadInvalid) { continue }
    
    if ($Apply) {
        $newFmLines = @("---")
        $addedPhase = $false
        foreach ($key in $order) {
            if ($key -eq "phase" -and $fm["phase"] -eq $null) { continue }
            $newFmLines += "$key`: $($fm[$key])"
        }
        if ($fm.ContainsKey("phase") -and $fm["phase"] -ne $null -and $order -notcontains "phase") {
            $newFmLines += "phase: $($fm['phase'])"
            $addedPhase = $true
        }
        if ($fm.ContainsKey("code_version")) {
            if ($order -notcontains "code_version") {
                $newFmLines += "code_version: $($fm['code_version'])"
            }
        } else {
            $newFmLines += "code_version: 2.0.0"
        }
        $newFmLines += "---"
        
        $bodyLines = $lines[($endIdx + 1)..($lines.Count - 1)]
        $body = ($bodyLines -join "`n").TrimStart()
        $newContent = ($newFmLines -join "`n") + "`n`n" + $body
        
        Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $completed++
        if ($hadInvalid) { $cleaned++ }
        Write-Host "  [FIXED] $relPath" -ForegroundColor Green
    } else {
        $cleaned++
        Write-Host "  [NEEDS FIX] $relPath" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Yellow
Write-Host "Total scanned: $total"
Write-Host "Documents needing cleanup: $cleaned"
if ($Apply) {
    Write-Host "Fixed: $completed" -ForegroundColor Green
    Write-Host "Errors: $errors" -ForegroundColor Red
} else {
    Write-Host "Run with -Apply to fix all $cleaned files." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Done." -ForegroundColor Cyan

