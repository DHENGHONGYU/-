param(
    [string]$DocsPath = "g:\FinSightV9\docs"
)
$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$twoTag = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -notmatch '(?m)^tags\s*:\s*\[(.*)\]') { continue }
    $tagStr = $matches[1]
    $tags = ($tagStr -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
    if ($tags.Count -ne 2) { continue }

    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()
    $twoTag += [PSCustomObject]@{ Path = $rel; Tags = ($tags -join ','); Base = $base }
}

Write-Host "Two-tag docs: $($twoTag.Count)"
Write-Host ""
Write-Host "=== By tag pair ===" -ForegroundColor Yellow
$twoTag | Group-Object Tags | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object {
    "{0,-35} {1}" -f $_.Name, $_.Count
}
Write-Host ""
Write-Host "=== Filename token freq (top 40) ===" -ForegroundColor Yellow
$tokens = @{}
foreach ($t in $twoTag) {
    $parts = ($t.Base -split '[^a-z0-9]+') | Where-Object { $_.Length -ge 3 }
    foreach ($p in $parts) {
        if ($p -match '^\d+$') { continue }
        $tokens[$p] = ($tokens[$p] + 1)
    }
}
$tokens.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 40 | ForEach-Object {
    "{0,-25} {1}" -f $_.Key, $_.Value
}
