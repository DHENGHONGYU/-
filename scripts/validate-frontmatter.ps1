param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [string]$OutputCsv = "",
    [switch]$Fix = $false
)

$ErrorActionPreference = "Stop"

$validTypes = @("reference", "explanation", "how-to", "tutorials", "reports", "meta")
$validDomains = @("architecture", "frontend", "backend", "data", "ai", "qa", "project", "product")
$validPhases = @("planning", "requirements", "design", "development", "testing", "deployment", "retrospective")
$validStatuses = @("draft", "active", "deprecated", "archived")
$validTiers = @("important", "standard", "reference", "quick-note")

$coreFields = @("title", "type", "domain", "status", "tier", "last_updated")
$recommendedFields = @("version", "doc_id", "phase", "summary", "tags", "maintainer", "code_version", "change_log")

$typeDirMap = @{
    "reference" = @("reference", "01-product", "01-requirements", "04-testing", "06-project-management", "architecture", "design", "guides", "modules", "ops", "prompts", "standards", "team-handbook", "testing", "assets", "drafts", "ai", "01-p1-debt-cleanup-todo.md", "README.md", "registry-index.md")
    "explanation" = @("explanation", "architecture", "design")
    "how-to" = @("how-to", "guides", "prompts")
    "tutorials" = @("tutorials", "guides")
    "reports" = @("reports", "design", "04-testing")
    "meta" = @("00-meta", "reference/meta")
}

function Test-ValidVersion($ver) {
    return $ver -match '^v\d+\.\d+\.\d+$'
}

function Test-ValidDate($date) {
    return $date -match '^\d{4}-\d{2}-\d{2}$'
}

function Get-Frontmatter($content) {
    if ($content -match '^---\s*\n([\s\S]*?)\n---') {
        $fmText = $matches[1]
        $result = @{}
        $lines = $fmText -split "`n"
        $currentKey = $null
        $inArray = $false
        $arrayItems = @()
        
        foreach ($line in $lines) {
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
        return $result
    }
    return $null
}

function Infer-FromPath($relPath) {
    $inferred = @{
        type = $null
        domain = $null
        phase = $null
    }
    
    $parts = $relPath -split '/'
    
    foreach ($part in $parts) {
        $p = $part.ToLower()
        if ($p -in $validTypes) { $inferred.type = $p }
        if ($p -in $validDomains) { $inferred.domain = $p }
        if ($p -in $validPhases) { $inferred.phase = $p }
    }
    
    if ($relPath -match '00-meta') { $inferred.type = "meta" }
    if ($relPath -match 'architecture|infra|core') { if (-not $inferred.domain) { $inferred.domain = "architecture" } }
    if ($relPath -match 'frontend|ui|ux|components|widgets') { if (-not $inferred.domain) { $inferred.domain = "frontend" } }
    if ($relPath -match 'backend|service|engine|algo') { if (-not $inferred.domain) { $inferred.domain = "backend" } }
    if ($relPath -match 'data|database|storage|datalayer') { if (-not $inferred.domain) { $inferred.domain = "data" } }
    if ($relPath -match 'ai|llm|agent|mcp|model') { if (-not $inferred.domain) { $inferred.domain = "ai" } }
    if ($relPath -match 'test|qa|quality|audit') { if (-not $inferred.domain) { $inferred.domain = "qa" } }
    if ($relPath -match 'project|management|process|team') { if (-not $inferred.domain) { $inferred.domain = "project" } }
    if ($relPath -match 'product|requirement|prd') { if (-not $inferred.domain) { $inferred.domain = "product" } }
    
    if ($relPath -match 'design|architecture') { if (-not $inferred.phase) { $inferred.phase = "design" } }
    if ($relPath -match 'develop|code|implement') { if (-not $inferred.phase) { $inferred.phase = "development" } }
    if ($relPath -match 'test|qa') { if (-not $inferred.phase) { $inferred.phase = "testing" } }
    if ($relPath -match 'deploy|release|ops') { if (-not $inferred.phase) { $inferred.phase = "deployment" } }
    if ($relPath -match 'retro|review|lesson|summary') { if (-not $inferred.phase) { $inferred.phase = "retrospective" } }
    if ($relPath -match 'plan|vision|goal') { if (-not $inferred.phase) { $inferred.phase = "planning" } }
    if ($relPath -match 'requirement|prd|analysis') { if (-not $inferred.phase) { $inferred.phase = "requirements" } }
    
    return $inferred
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" -and $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" }

$total = $docs.Count
$results = @()
$p0Count = 0
$p1Count = 0
$p2Count = 0
$noFmCount = 0
$validFmCount = 0

Write-Host "Scanning $total documents..." -ForegroundColor Cyan
Write-Host ""

$i = 0
foreach ($doc in $docs) {
    $i++
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    
    try {
        $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    } catch {
        continue
    }
    
    $fm = Get-Frontmatter $content
    $issues = @()
    $warnings = @()
    $infos = @()
    
    if (-not $fm) {
        $noFmCount++
        $inferred = Infer-FromPath $relPath
        $issues += "P0: No Frontmatter found"
        
        $results += [PSCustomObject]@{
            File = $relPath
            HasFrontmatter = $false
            P0_Issues = ($issues | Where-Object { $_ -match '^P0' }).Count
            P1_Issues = ($issues | Where-Object { $_ -match '^P1' }).Count
            P2_Issues = ($issues | Where-Object { $_ -match '^P2' }).Count
            Issues = $issues -join "; "
            InferredType = $inferred.type
            InferredDomain = $inferred.domain
            InferredPhase = $inferred.phase
        }
        continue
    }
    
    if ($fm.title) { $p0Count++ } else { $issues += "P0: Missing 'title'" }
    if ($fm.type) {
        if ($fm.type -notin $validTypes) { $issues += "P0: Invalid 'type' value: $($fm.type)" }
    } else { $issues += "P0: Missing 'type'" }
    if ($fm.domain) {
        if ($fm.domain -notin $validDomains) { $issues += "P0: Invalid 'domain' value: $($fm.domain)" }
    } else { $issues += "P0: Missing 'domain'" }
    if ($fm.status) {
        if ($fm.status -notin $validStatuses) { $issues += "P0: Invalid 'status' value: $($fm.status)" }
    } else { $issues += "P0: Missing 'status'" }
    if ($fm.tier) {
        if ($fm.tier -notin $validTiers) { $issues += "P0: Invalid 'tier' value: $($fm.tier)" }
    } else { $issues += "P0: Missing 'tier'" }
    if ($fm.last_updated) {
        if (-not (Test-ValidDate $fm.last_updated)) { $issues += "P0: Invalid 'last_updated' format: $($fm.last_updated)" }
    } else { $issues += "P0: Missing 'last_updated'" }
    
    if ($fm.phase -and $fm.phase -notin $validPhases) {
        $warnings += "P1: Invalid 'phase' value: $($fm.phase)"
    }
    
    $tier = if ($fm.tier) { $fm.tier } else { "standard" }
    if ($tier -in @("important", "standard")) {
        if (-not $fm.version) { $warnings += "P1: Missing 'version' (required for $tier tier)" }
        elseif (-not (Test-ValidVersion $fm.version)) { $warnings += "P1: Invalid 'version' format: $($fm.version)" }
    }
    if ($tier -eq "important") {
        if (-not $fm.doc_id) { $warnings += "P1: Missing 'doc_id' (required for important tier)" }
        if (-not $fm.maintainer) { $warnings += "P1: Missing 'maintainer' (required for important tier)" }
        if (-not $fm.summary) { $infos += "P2: Missing 'summary' (recommended for important tier)" }
    }
    
    if (-not $fm.tags) { $infos += "P2: Missing 'tags' (recommended)" }
    if ($fm.tags -is [array] -and $fm.tags.Count -gt 8) { $infos += "P2: Too many tags ($($fm.tags.Count), recommended 3-8)" }
    if ($fm.tags -is [array] -and $fm.tags.Count -lt 3 -and $fm.tags.Count -gt 0) { $infos += "P2: Too few tags ($($fm.tags.Count), recommended 3-8)" }
    
    if ($fm.status -eq "deprecated") {
        if (-not $fm.deprecated_by -and -not $fm.superseded_by) {
            $warnings += "P1: Deprecated but missing 'deprecated_by'"
        }
    }
    
    if ($fm.type -and $typeDirMap.ContainsKey($fm.type)) {
        $allowedDirs = $typeDirMap[$fm.type]
        $matched = $false
        foreach ($d in $allowedDirs) {
            if ($relPath -match [regex]::Escape($d)) { $matched = $true; break }
        }
        if (-not $matched) {
            $infos += "P2: type '$($fm.type)' doesn't match path (expected in one of: $($allowedDirs -join ', '))"
        }
    }
    
    $p0 = ($issues | Where-Object { $_ -match '^P0' }).Count
    $p1 = ($warnings | Where-Object { $_ -match '^P1' }).Count
    $p2 = ($infos | Where-Object { $_ -match '^P2' }).Count
    
    if ($p0 -eq 0) { $validFmCount++ }
    $p0Count += $p0
    $p1Count += $p1
    $p2Count += $p2
    
    $allIssues = @($issues) + @($warnings) + @($infos)
    
    $inferred = Infer-FromPath $relPath
    $results += [PSCustomObject]@{
        File = $relPath
        HasFrontmatter = $true
        Title = if ($fm.title) { $fm.title } else { "" }
        Type = if ($fm.type) { $fm.type } else { "" }
        Domain = if ($fm.domain) { $fm.domain } else { "" }
        Status = if ($fm.status) { $fm.status } else { "" }
        Tier = if ($fm.tier) { $fm.tier } else { "" }
        Version = if ($fm.version) { $fm.version } else { "" }
        LastUpdated = if ($fm.last_updated) { $fm.last_updated } else { "" }
        P0_Issues = $p0
        P1_Issues = $p1
        P2_Issues = $p2
        Total_Issues = $p0 + $p1 + $p2
        Issues = $allIssues -join "; "
        InferredType = $inferred.type
        InferredDomain = $inferred.domain
        InferredPhase = $inferred.phase
    }
}

Write-Host "===== Validation Summary =====" -ForegroundColor Yellow
Write-Host "Total documents: $total"
Write-Host "Has Frontmatter: $($total - $noFmCount) ($([math]::Round(($total-$noFmCount)/$total*100,1))%)"
Write-Host "No Frontmatter: $noFmCount ($([math]::Round($noFmCount/$total*100,1))%)"
Write-Host ""
Write-Host "Pass (no P0 issues): $validFmCount ($([math]::Round($validFmCount/$total*100,1))%)"
Write-Host ""
Write-Host "P0 Errors: $p0Count" -ForegroundColor Red
Write-Host "P1 Warnings: $p1Count" -ForegroundColor Yellow
Write-Host "P2 Info: $p2Count" -ForegroundColor Green
Write-Host ""

$p0Docs = $results | Where-Object { $_.P0_Issues -gt 0 }
Write-Host "===== Documents with P0 issues ($($p0Docs.Count)) =====" -ForegroundColor Red
$p0Docs | Select-Object -First 20 | ForEach-Object {
    Write-Host "  [$($_.P0_Issues)] $($_.File)"
    Write-Host "    $($_.Issues)"
}
if ($p0Docs.Count -gt 20) {
    Write-Host "  ... and $($p0Docs.Count - 20) more"
}
Write-Host ""

$noTypeDocs = $results | Where-Object { $_.HasFrontmatter -and [string]::IsNullOrEmpty($_.Type) }
Write-Host "===== Missing 'type' field ($($noTypeDocs.Count)) =====" -ForegroundColor Yellow
$noTypeDocs | Select-Object -First 15 | ForEach-Object {
    $inf = Infer-FromPath $_.File
    Write-Host "  $($_.File)"
    Write-Host "    Inferred: type=$($inf.type), domain=$($inf.domain), phase=$($inf.phase)"
}

if ($OutputCsv) {
    $results | Export-Csv -Path $OutputCsv -NoTypeInformation -Encoding UTF8
    Write-Host ""
    Write-Host "Results exported to: $OutputCsv" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
