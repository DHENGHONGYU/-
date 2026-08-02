param(
    [string]$DocsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'docs')
)
$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$zero = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^tags\s*:') { continue }
    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $domain = ""; $type = ""
    if ($fm -match '(?m)^domain\s*:\s*(.+)$') { $domain = $matches[1].Trim() }
    if ($fm -match '(?m)^type\s*:\s*(.+)$') { $type = $matches[1].Trim() }
    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $zero += [PSCustomObject]@{ Path = $rel; Domain = $domain; Type = $type; Base = $base }
}

Write-Host "Remaining zero-tag: $($zero.Count)"
Write-Host ""
$zero | ForEach-Object {
    "  [{0,-12}] {1}" -f $_.Type, $_.Path
}
