param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [switch]$Apply = $false,
    [string]$RegistryOut = "g:\FinSightV9\docs\00-meta\doc-id-registry.md"
)

$ErrorActionPreference = "Stop"

# domain -> abbreviation mapping
$domainAbbr = @{
    "architecture" = "ARCH"
    "frontend"     = "FRONT"
    "backend"      = "BACK"
    "data"         = "DATA"
    "ai"           = "AI"
    "qa"           = "QA"
    "project"      = "PROJ"
    "product"      = "PROD"
    "meta"         = "META"
}

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$entries = @()
$existingIds = @{}

foreach ($doc in $docs) {
    $relPath = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }

    $fmBlock = $matches[1]
    $tier = "standard"
    $domain = "project"
    $title = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name)
    $docId = $null

    if ($fmBlock -match '(?m)^tier\s*:\s*(.+)$') { $tier = $matches[1].Trim() }
    if ($fmBlock -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($fmBlock -match '(?m)^title\s*:\s*(.+)$') { $title = $matches[1].Trim() }
    if ($fmBlock -match '(?m)^doc_id\s*:\s*(.+)$') { $docId = $matches[1].Trim() }

    if ($docId) { $existingIds[$docId] = $relPath }

    if ($tier -eq "important") {
        $entries += [PSCustomObject]@{
            RelPath  = $relPath
            FullName = $doc.FullName
            Title    = $title
            Domain   = $domain
            Abbr     = $domainAbbr[$domain]
            DocId    = $docId
            Content  = $content
            FmBlock  = $fmBlock
        }
    }
}

# sort by domain then path for deterministic numbering
$entries = $entries | Sort-Object Abbr, RelPath

# assign numbers per domain abbreviation, skipping existing ids
$counters = @{}
$toAssign = @()
foreach ($e in $entries) {
    if ($e.DocId) { continue }
    $abbr = $e.Abbr
    if (-not $abbr) { $abbr = "PROJ" }
    if (-not $counters.ContainsKey($abbr)) { $counters[$abbr] = 1 }
    while ($true) {
        $candidate = "V9-DOC-{0}-{1:D3}" -f $abbr, $counters[$abbr]
        $counters[$abbr]++
        if (-not $existingIds.ContainsKey($candidate)) {
            $e | Add-Member -NotePropertyName NewId -NotePropertyValue $candidate -Force
            $existingIds[$candidate] = $e.RelPath
            break
        }
    }
    $toAssign += $e
}

Write-Host "===== doc_id Assignment Summary =====" -ForegroundColor Yellow
Write-Host "Important docs total: $($entries.Count)"
Write-Host "Already have doc_id: $(($entries | Where-Object { $_.DocId }).Count)"
Write-Host "To assign: $($toAssign.Count)"

if ($Apply) {
    foreach ($e in $toAssign) {
        $newFm = $e.FmBlock
        if ($newFm -match '(?m)^tier\s*:.*$') {
            $newFm = $newFm -replace '(?m)^(tier\s*:.*)$', ('$1' + "`n" + "doc_id: $($e.NewId)")
        } else {
            $newFm = $newFm.TrimEnd() + "`ndoc_id: $($e.NewId)"
        }
        $newContent = $e.Content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
        Set-Content -Path $e.FullName -Value $newContent -Encoding UTF8 -NoNewline
    }
    Write-Host "Applied: $($toAssign.Count)" -ForegroundColor Green
}

# build registry table (all important docs with ids)
$regLines = @()
$regLines += "---"
$regLines += "title: V9 doc_id Registry"
$regLines += "type: meta"
$regLines += "domain: project"
$regLines += "phase: development"
$regLines += "tier: reference"
$regLines += "status: active"
$regLines += "version: v1.0.0"
$regLines += "last_updated: $(Get-Date -Format 'yyyy-MM-dd')"
$regLines += "code_version: 2.0.0"
$regLines += "---"
$regLines += ""
$regLines += "# V9 doc_id Registry"
$regLines += ""
$regLines += "> Generated: $(Get-Date -Format 'yyyy-MM-dd')"
$regLines += ""
$regLines += "| doc_id | domain | title | path |"
$regLines += "|--------|--------|-------|------|"
foreach ($e in $entries) {
    $id = if ($e.DocId) { $e.DocId } else { $e.NewId }
    $regLines += "| $id | $($e.Domain) | $($e.Title) | $($e.RelPath) |"
}

if ($Apply) {
    $regLines | Set-Content -Path $RegistryOut -Encoding UTF8
    Write-Host "Registry written: $RegistryOut" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Preview (first 20 to assign):"
    $toAssign | Select-Object -First 20 | ForEach-Object { Write-Host "  $($_.NewId)  $($_.RelPath)" }
}
