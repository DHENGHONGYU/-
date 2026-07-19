param(
    [string]$DocsPath = "g:\FinSightV9\docs",
    [string]$DefaultMaintainer = "V9 Architecture Team",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Stop"

$docs = Get-ChildItem -Path $DocsPath -Recurse -Include "*.md" -File |
    Where-Object { $_.FullName -notmatch "\\archive\\" -and $_.FullName -notmatch "\\ai-index\\" }

$missing = 0
$applied = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    if ($fm -match '(?m)^maintainer\s*:') { continue }

    $missing++
    if ($Apply) {
        $newFm = $fm
        if ($fm -match '(?m)^status\s*:.*$') {
            $newFm = $fm -replace '(?m)^(status\s*:.*)$', ('$1' + "`n" + "maintainer: $DefaultMaintainer")
        } elseif ($fm -match '(?m)^phase\s*:.*$') {
            $newFm = $fm -replace '(?m)^(phase\s*:.*)$', ('$1' + "`n" + "maintainer: $DefaultMaintainer")
        } else {
            $newFm = $fm.TrimEnd() + "`nmaintainer: $DefaultMaintainer"
        }
        $newContent = $content -replace '(?s)^(---\s*\r?\n).*?(\r?\n---)', ('$1' + $newFm + '$2')
        Set-Content -Path $doc.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $applied++
    }
}

Write-Host "===== Maintainer Assignment =====" -ForegroundColor Yellow
Write-Host "Missing maintainer: $missing"
if ($Apply) { Write-Host "Applied: $applied" -ForegroundColor Green }
