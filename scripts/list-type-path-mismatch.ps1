param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs')
)
$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$mismatches = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $type = ""
    if ($fm -match '(?m)^type\s*:\s*(.+)$') { $type = $matches[1].Trim() }
    if (-not $type) { continue }

    $expectedDir = switch ($type) {
        'tutorials' { 'tutorials' }
        'how-to' { 'how-to' }
        'reference' { 'reference' }
        'explanation' { 'explanation' }
        'reports' { 'reports' }
        'meta' { '00-meta' }
        default { $null }
    }
    if (-not $expectedDir) { continue }

    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    if ($rel -notmatch "(^|/)$expectedDir/") {
        $mismatches += [PSCustomObject]@{ Path = $rel; Type = $type; ExpectedDir = $expectedDir }
    }
}

Write-Host "Total mismatches: $($mismatches.Count)"
Write-Host ""
$dirs = $mismatches | ForEach-Object { ($_.Path -split '/')[0] } | Group-Object | Sort-Object Count -Descending
Write-Host "=== By current top directory ===" -ForegroundColor Yellow
$dirs | ForEach-Object { "{0,-25} {1}" -f $_.Name, $_.Count }
Write-Host ""
Write-Host "=== Full list ===" -ForegroundColor Yellow
$mismatches | ForEach-Object {
    "  [{0,-12}] {1}" -f $_.Type, $_.Path
}
