$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path "g:\FinSightV9\docs" -Recurse -Include "*.md" -File | 
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\.git\\" }

function Get-DocType($path) {
    if ($path -match "/reference/") { return "reference" }
    if ($path -match "/explanation/") { return "explanation" }
    if ($path -match "/how-to/") { return "how-to" }
    if ($path -match "/tutorials/") { return "tutorials" }
    if ($path -match "/reports/") { return "reports" }
    if ($path -match "/00-meta/") { return "meta" }
    if ($path -match "/team-handbook/") { return "handbook" }
    if ($path -match "/design/") { return "design" }
    if ($path -match "/guides/") { return "guides" }
    if ($path -match "/drafts/") { return "drafts" }
    if ($path -match "/assets/") { return "assets" }
    if ($path -match "/ai/") { return "ai" }
    if ($path -match "/architecture/") { return "architecture" }
    if ($path -match "/modules/") { return "modules" }
    if ($path -match "/ops/") { return "ops" }
    if ($path -match "/prompts/") { return "prompts" }
    return "other"
}

function Get-Domain($name, $path) {
    $full = "$path/$name"
    if ($full -match "architecture|adr|layer") { return "architecture" }
    if ($full -match "ui|component|widget|token|color") { return "frontend" }
    if ($full -match "service|engine|scoring|trading|analysis|collect") { return "backend" }
    if ($full -match "data|database|schema|datalayer|store") { return "data" }
    if ($full -match "ai|llm|agent|mcp|model") { return "ai" }
    if ($full -match "test|audit|quality|coverage") { return "qa" }
    if ($full -match "project|team|process|workflow|management") { return "project" }
    if ($full -match "product|requirement|persona|scenario") { return "product" }
    return "general"
}

function Get-Phase($name, $path) {
    $full = "$path/$name"
    if ($full -match "vision|goal|roadmap|planning") { return "planning" }
    if ($full -match "requirement|spec|persona|scenario") { return "requirements" }
    if ($full -match "design|architecture|adr|schema") { return "design" }
    if ($full -match "how-to|guide|development|implementation") { return "development" }
    if ($full -match "test|audit|quality|coverage") { return "testing" }
    if ($full -match "deploy|release|deployment|ops|runbook") { return "deployment" }
    if ($full -match "retrospective|lesson|summary|report") { return "retrospective" }
    return "general"
}

function Get-Title($file) {
    try {
        $content = Get-Content $file.FullName -TotalCount 20 -Encoding UTF8
        foreach ($line in $content) {
            if ($line -match "^# (.+)$") {
                return $matches[1].Trim()
            }
        }
    } catch {}
    return $file.BaseName
}

$results = @()
$index = 0

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring("g:\FinSightV9\docs\".Length).Replace("\", "/")
    $title = Get-Title $doc
    $type = Get-DocType $relPath
    $domain = Get-Domain $doc.Name $relPath
    $phase = Get-Phase $doc.Name $relPath
    $sizeKB = [math]::Round($doc.Length / 1KB, 1)
    
    $index++
    $docId = "V9-DOC-{0:D4}" -f $index
    
    $results += [PSCustomObject]@{
        doc_id = $docId
        title = $title
        file_path = $relPath
        file_size_kb = $sizeKB
        doc_type = $type
        domain = $domain
        phase = $phase
        last_updated = $doc.LastWriteTime.ToString("yyyy-MM-dd")
        status = "active"
        archive_reason = ""
    }
}

$results | Export-Csv -Path "g:\FinSightV9\docs\00-meta\document-inventory.csv" -Encoding UTF8 -NoTypeInformation

Write-Host "Total docs: $($results.Count)"
Write-Host "Saved to: docs/00-meta/document-inventory.csv"
Write-Host ""
Write-Host "By type:"
$results | Group-Object doc_type | Sort-Object Count -Descending | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }
Write-Host ""
Write-Host "By domain:"
$results | Group-Object domain | Sort-Object Count -Descending | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }
Write-Host ""
Write-Host "By phase:"
$results | Group-Object phase | Sort-Object Count -Descending | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }
