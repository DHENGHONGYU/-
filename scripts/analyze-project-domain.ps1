param(
    [string]$DocsPath = "g:\FinSightV9\docs"
)

$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$projectDocs = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $domain = ""
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($domain -eq "project") {
        $projectDocs += $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    }
}

Write-Host "Total domain=project: $($projectDocs.Count)"
Write-Host ""
Write-Host "=== By top-level directory ===" -ForegroundColor Yellow
$projectDocs | ForEach-Object { ($_ -split '/')[0] } | Group-Object | Sort-Object Count -Descending | ForEach-Object { "{0,-25} {1}" -f $_.Name, $_.Count }

Write-Host ""
Write-Host "=== By second-level directory ===" -ForegroundColor Yellow
$projectDocs | ForEach-Object {
    $parts = $_ -split '/'
    if ($parts.Count -ge 2) { "$($parts[0])/$($parts[1])" } else { $parts[0] }
} | Group-Object | Sort-Object Count -Descending | Select-Object -First 25 | ForEach-Object { "{0,-40} {1}" -f $_.Name, $_.Count }
