param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

$validTypes = @("reference", "explanation", "how-to", "tutorials", "reports", "meta")
$validDomains = @("architecture", "frontend", "backend", "data", "ai", "qa", "project", "product")
$validPhases = @("planning", "requirements", "design", "development", "testing", "deployment", "retrospective")
$validStatuses = @("draft", "active", "deprecated", "archived")
$validTiers = @("important", "standard", "reference", "quick-note")

function Parse-Frontmatter($content) {
    $lines = $content -split "`r?`n"
    if ($lines.Count -lt 2 -or $lines[0].Trim() -ne "---") {
        return $null, -1, -1
    }
    
    $endIdx = -1
    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i].Trim() -eq "---") {
            $endIdx = $i
            break
        }
    }
    
    if ($endIdx -eq -1) {
        return $null, -1, -1
    }
    
    $result = @{}
    $currentKey = $null
    $inArray = $false
    $arrayItems = @()
    
    for ($i = 1; $i -lt $endIdx; $i++) {
        $line = $lines[$i]
        if ($line -match '^(\w[\w-]*):\s*(.*)$') {
            if ($currentKey -and $inArray) {
                $result[$currentKey] = $arrayItems
                $inArray = $false
                $arrayItems = @()
            }
            $currentKey = $matches[1]
            $value = $matches[2].Trim()
            if ($value -eq '') {
                $inArray = $true
                $arrayItems = @()
            } else {
                $result[$currentKey] = $value
                $inArray = $false
            }
        } elseif ($line -match '^\s*-\s*(.*)$' -and $inArray) {
            $arrayItems += $matches[1].Trim()
        }
    }
    if ($currentKey -and $inArray) {
        $result[$currentKey] = $arrayItems
    }
    
    return $result, 0, $endIdx
}

function Infer-Metadata($relPath, $fileName, $fileDate) {
    $result = @{
        type = $null
        domain = $null
        phase = $null
        status = "active"
        tier = "standard"
        last_updated = $fileDate.ToString("yyyy-MM-dd")
        version = "v1.0.0"
        confidence = @{}
    }
    
    $pathLower = $relPath.ToLower()
    $nameLower = $fileName.ToLower()
    
    if ($pathLower -match '00-meta|meta/') { $result.type = "meta"; $result.confidence.type = "high" }
    elseif ($pathLower -match 'reference/') { $result.type = "reference"; $result.confidence.type = "high" }
    elseif ($pathLower -match 'explanation/|design/|architecture/') { $result.type = "explanation"; $result.confidence.type = "high" }
    elseif ($pathLower -match 'how-to/|guide/') { $result.type = "how-to"; $result.confidence.type = "high" }
    elseif ($pathLower -match 'tutorials/|learning/|getting-started/') { $result.type = "tutorials"; $result.confidence.type = "high" }
    elseif ($pathLower -match 'reports/|audit/|retro/') { $result.type = "reports"; $result.confidence.type = "high" }
    else { $result.confidence.type = "low" }
    
    if ($pathLower -match 'architecture|infra/|core/|framework') { $result.domain = "architecture"; $result.confidence.domain = "high" }
    elseif ($pathLower -match 'frontend|ui/|ux/|components|widgets|pages|views|react') { $result.domain = "frontend"; $result.confidence.domain = "high" }
    elseif ($pathLower -match 'backend|service|engine|algo|services/') { $result.domain = "backend"; $result.confidence.domain = "medium" }
    elseif ($pathLower -match 'data|database|storage|datalayer|schema|store') { $result.domain = "data"; $result.confidence.domain = "high" }
    elseif ($pathLower -match 'ai/|llm|agent|mcp|model|prompt') { $result.domain = "ai"; $result.confidence.domain = "high" }
    elseif ($pathLower -match 'test|qa/|quality|audit') { $result.domain = "qa"; $result.confidence.domain = "high" }
    elseif ($pathLower -match 'project|management|process|team|handbook') { $result.domain = "project"; $result.confidence.domain = "medium" }
    elseif ($pathLower -match 'product|requirement|prd|01-') { $result.domain = "product"; $result.confidence.domain = "medium" }
    else { $result.confidence.domain = "low" }
    
    if ($pathLower -match 'design|architecture') { $result.phase = "design"; $result.confidence.phase = "medium" }
    elseif ($pathLower -match 'plan|vision|goal|roadmap') { $result.phase = "planning"; $result.confidence.phase = "medium" }
    elseif ($pathLower -match 'requirement|prd|analysis|01-') { $result.phase = "requirements"; $result.confidence.phase = "medium" }
    elseif ($pathLower -match 'develop|code|implement|how-to') { $result.phase = "development"; $result.confidence.phase = "low" }
    elseif ($pathLower -match 'test|qa|audit') { $result.phase = "testing"; $result.confidence.phase = "medium" }
    elseif ($pathLower -match 'deploy|release|ops') { $result.phase = "deployment"; $result.confidence.phase = "medium" }
    elseif ($pathLower -match 'retro|review|lesson|summary|postmortem') { $result.phase = "retrospective"; $result.confidence.phase = "high" }
    else { $result.confidence.phase = "low" }
    
    if ($nameLower -match 'readme|index|manifest|inventory|registry') { $result.tier = "reference"; $result.confidence.tier = "medium" }
    elseif ($nameLower -match 'adr-|decision|standard|spec|规范|标准|架构设计') { $result.tier = "important"; $result.confidence.tier = "medium" }
    elseif ($nameLower -match 'todo|待办|draft|草稿|wip|temp|临时') { $result.tier = "quick-note"; $result.status = "draft"; $result.confidence.tier = "medium" }
    else { $result.confidence.tier = "low" }
    
    if ($pathLower -match 'deprecated|old/|legacy|废弃') { $result.status = "deprecated"; $result.confidence.status = "high" }
    elseif ($pathLower -match 'archive|历史') { $result.status = "archived"; $result.confidence.status = "high" }
    else { $result.confidence.status = "medium" }
    
    return $result
}

function Build-NewFrontmatter($fm, $inferred) {
    $lines = @("---")
    
    $title = if ($fm.title) { $fm.title } else { "TODO-ADD-TITLE" }
    $lines += "title: $title"
    
    if ($fm.doc_id) { $lines += "doc_id: $($fm.doc_id)" }
    
    $lines += ""
    $lines += "# Classification"
    
    if ($fm.type) { $lines += "type: $($fm.type)" }
    elseif ($inferred.type) { $lines += "type: $($inferred.type)" }
    else { $lines += "type: reference # TODO: confirm" }
    
    if ($fm.domain) { $lines += "domain: $($fm.domain)" }
    elseif ($inferred.domain) { $lines += "domain: $($inferred.domain)" }
    else { $lines += "domain: project # TODO: confirm" }
    
    if ($fm.phase) { $lines += "phase: $($fm.phase)" }
    elseif ($inferred.phase) { $lines += "phase: $($inferred.phase) # TODO: confirm" }
    
    if ($fm.tier) { 
        $tierVal = $fm.tier
        if ($tierVal -eq "core") { $tierVal = "important"; $lines += "tier: $tierVal # migrated from 'core'" }
        else { $lines += "tier: $tierVal" }
    }
    elseif ($inferred.tier) { $lines += "tier: $($inferred.tier) # TODO: confirm" }
    else { $lines += "tier: standard" }
    
    if ($fm.status) { $lines += "status: $($fm.status)" }
    elseif ($inferred.status) { $lines += "status: $($inferred.status)" }
    else { $lines += "status: active" }
    
    $lines += ""
    $lines += "# Version"
    
    if ($fm.version) { $lines += "version: $($fm.version)" }
    else { $lines += "version: v1.0.0 # TODO: confirm" }
    
    if ($fm.last_updated) { $lines += "last_updated: $($fm.last_updated)" }
    elseif ($inferred.last_updated) { $lines += "last_updated: $($inferred.last_updated)" }
    
    if ($fm.code_version) { $lines += "code_version: $($fm.code_version)" }
    else { $lines += "code_version: 2.0.0" }
    
    if ($fm.doc_system_version) { $lines += "doc_system_version: $($fm.doc_system_version)" }
    
    $lines += ""
    $lines += "# People & Tags"
    
    if ($fm.maintainer -or $fm.owner) {
        $maint = if ($fm.maintainer) { $fm.maintainer } else { $fm.owner }
        $lines += "maintainer: $maint"
    } else {
        $lines += "# maintainer: TODO"
    }
    
    if ($fm.tags -is [array]) {
        $lines += "tags: [$($fm.tags -join ', ')]"
    } elseif ($fm.tags) {
        $lines += "tags: [$($fm.tags)]"
    } else {
        $lines += "# tags: [tag1, tag2]"
    }
    
    if ($fm.summary) { $lines += "summary: $($fm.summary)" }
    else { $lines += "# summary: One-line summary" }
    
    if ($fm.change_log) {
        $lines += ""
        $lines += "change_log:"
        if ($fm.change_log -is [array]) {
            foreach ($entry in $fm.change_log) {
                if ($entry -is [string]) { $lines += "  - $entry" }
            }
        }
    }
    
    $lines += ""
    $lines += "---"
    
    return $lines
}

function Get-BodyContent($content, $fmEndLine) {
    $lines = $content -split "`r?`n"
    $bodyLines = @()
    for ($i = $fmEndLine + 1; $i -lt $lines.Count; $i++) {
        $bodyLines += $lines[$i]
    }
    return ($bodyLines -join "`n").TrimStart()
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" -and $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" }

$total = $docs.Count
$noFmCount = 0
$incompleteCount = 0
$completeCount = 0
$willUpdate = 0
$updates = @()

Write-Host "Scanning $total documents for metadata auto-completion..." -ForegroundColor Cyan
Write-Host ""

$i = 0
foreach ($doc in $docs) {
    $i++
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $fileName = $doc.Name
    
    try {
        $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    } catch {
        continue
    }
    
    $fm, $fmStart, $fmEnd = Parse-Frontmatter $content
    $inferred = Infer-Metadata $relPath $fileName $doc.LastWriteTime
    
    if (-not $fm) {
        $noFmCount++
        $willUpdate++
        $updates += [PSCustomObject]@{
            File = $relPath
            Action = "CREATE"
            Reason = "No Frontmatter"
            InferredType = $inferred.type
            InferredDomain = $inferred.domain
            InferredPhase = $inferred.phase
            Confidence = "type=$($inferred.confidence.type)/domain=$($inferred.confidence.domain)"
        }
        continue
    }
    
    $missing = @()
    if (-not $fm.type) { $missing += "type" }
    if (-not $fm.domain) { $missing += "domain" }
    if (-not $fm.status) { $missing += "status" }
    if (-not $fm.tier -or $fm.tier -eq "core") { $missing += "tier" }
    if (-not $fm.last_updated) { $missing += "last_updated" }
    if (-not $fm.version) { $missing += "version" }
    
    if ($missing.Count -gt 0) {
        $incompleteCount++
        if ($missing.Count -ge 3) {
            $willUpdate++
            $updates += [PSCustomObject]@{
                File = $relPath
                Action = "UPDATE"
                Reason = "Missing: $($missing -join ', ')"
                InferredType = if (-not $fm.type) { $inferred.type } else { $fm.type }
                InferredDomain = if (-not $fm.domain) { $inferred.domain } else { $fm.domain }
                InferredPhase = $inferred.phase
                Confidence = "type=$($inferred.confidence.type)/domain=$($inferred.confidence.domain)"
            }
        }
    } else {
        $completeCount++
    }
}

Write-Host "===== Auto-Completion Report =====" -ForegroundColor Yellow
Write-Host "Total documents: $total"
Write-Host ""
Write-Host "No Frontmatter: $noFmCount" -ForegroundColor Red
Write-Host "Incomplete (missing >=3 core fields): $incompleteCount" -ForegroundColor Yellow
Write-Host "Complete (all core fields present): $completeCount" -ForegroundColor Green
Write-Host ""
Write-Host "Documents to update: $willUpdate" -ForegroundColor Cyan
Write-Host ""

Write-Host "===== Documents to Update (Top 20) =====" -ForegroundColor Yellow
$updates | Select-Object -First 20 | ForEach-Object {
    $color = if ($_.Action -eq "CREATE") { "Red" } else { "Yellow" }
    Write-Host "  [$($_.Action)] $($_.File)" -ForegroundColor $color
    Write-Host "    Reason: $($_.Reason)"
    Write-Host "    Inferred: type=$($_.InferredType), domain=$($_.InferredDomain), phase=$($_.InferredPhase)"
    Write-Host "    Confidence: $($_.Confidence)"
}
if ($updates.Count -gt 20) {
    Write-Host "  ... and $($updates.Count - 20) more"
}

if ($Apply) {
    Write-Host ""
    Write-Host "Applying changes..." -ForegroundColor Red
    
    $applied = 0
    $errors = 0
    foreach ($update in $updates) {
        $fullPath = Join-Path $DocsPath $update.File
        try {
            $content = Get-Content $fullPath -Raw -Encoding UTF8
            $fm, $fmStart, $fmEnd = Parse-Frontmatter $content
            $docItem = Get-Item $fullPath
            $inferred = Infer-Metadata $update.File $docItem.Name $docItem.LastWriteTime
            
            if (-not $fm) { $fm = @{} }
            
            $newFmLines = Build-NewFrontmatter $fm $inferred
            $newFmText = ($newFmLines -join "`n")
            
            if ($fmStart -ge 0) {
                $body = Get-BodyContent $content $fmEnd
                $newContent = $newFmText + "`n`n" + $body
            } else {
                $newContent = $newFmText + "`n`n" + $content
            }
            
            Set-Content -Path $fullPath -Value $newContent -Encoding UTF8 -NoNewline
            $applied++
        } catch {
            Write-Host "  ERROR: $($update.File) - $_" -ForegroundColor Red
            $errors++
        }
    }
    
    Write-Host ""
    Write-Host "Applied $applied / $($updates.Count) updates ($errors errors)." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "This is a REPORT ONLY. Use -Apply to actually modify files." -ForegroundColor Yellow
    Write-Host "Example: .\scripts\auto-complete-frontmatter.ps1 -Apply" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
