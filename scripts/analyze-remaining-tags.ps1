param(
    [string]$DocsPath = "g:\FinSightV9\docs"
)
$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$zeroTag = @()
$twoTag = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $rel = $doc.FullName.Substring($DocsPath.Length + 1).Replace("\", "/")
    $base = [System.IO.Path]::GetFileNameWithoutExtension($doc.Name).ToLower()

    if ($fm -notmatch '(?m)^tags\s*:') {
        $zeroTag += [PSCustomObject]@{ Path = $rel; Base = $base }
        continue
    }
    if ($fm -match '(?m)^tags\s*:\s*\[(.*)\]') {
        $tags = ($matches[1] -split ',' | ForEach-Object { $_.Trim() }) | Where-Object { $_ }
        if ($tags.Count -eq 2) {
            $twoTag += [PSCustomObject]@{ Path = $rel; Base = $base; Tags = ($tags -join ',') }
        }
    }
}

Write-Host "Zero-tag: $($zeroTag.Count)"
Write-Host "Two-tag: $($twoTag.Count)"
Write-Host ""
Write-Host "=== Zero-tag by top dir ===" -ForegroundColor Yellow
$zeroTag | ForEach-Object { ($_.Path -split '/')[0] } | Group-Object | Sort-Object Count -Descending | ForEach-Object {
    "{0,-20} {1}" -f $_.Name, $_.Count
}
Write-Host ""
Write-Host "=== Zero-tag sample ===" -ForegroundColor Yellow
$zeroTag | Select-Object -First 20 | ForEach-Object {
    "  $($_.Path)"
}
Write-Host ""
Write-Host "=== Two-tag pair distribution (remaining) ===" -ForegroundColor Yellow
$twoTag | Group-Object Tags | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object {
    "{0,-35} {1}" -f $_.Name, $_.Count
}
