$ascii = [System.Text.Encoding]::ASCII

$testFiles = @(
    "docs/00-meta/GOVERNANCE.md",
    "docs/explanation/architecture.md",
    "docs/how-to/file-management-guide.md"
)

foreach ($testFile in $testFiles) {
    if (-not (Test-Path $testFile)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes($testFile)
    $content = $ascii.GetString($bytes)

    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)]+)\)') | Where-Object { 
        $_.Groups[2].Value -match '\.md' -and $_.Groups[2].Value -notmatch '^https?://' -and $_.Groups[2].Value -notmatch '^#'
    }

    Write-Host "=== Links from $testFile ($($links.Count) found) ==="
    $links | Select-Object -First 5 | ForEach-Object {
        Write-Host "  [$($_.Groups[1].Value)]($($_.Groups[2].Value))"
    }
    Write-Host ""
}

Write-Host "=== Testing path resolution ==="
$sourcePath = "docs/explanation/design/v9-current-state-review.md"
$sourceDir = Split-Path $sourcePath -Parent
Write-Host "Source: $sourcePath"
Write-Host "Source dir: $sourceDir"

$testLinks = @("../overview.md", "./03-architecture-standards.md", "../../reference/v9-system-blueprint.md")
foreach ($link in $testLinks) {
    $combined = Join-Path $sourceDir $link
    $parts = $combined -split '/' | Where-Object { $_ }
    $stack = @()
    foreach ($part in $parts) {
        if ($part -eq '..') {
            if ($stack.Count -gt 0) { $stack = $stack[0..($stack.Count - 2)] }
        } else {
            $stack += $part
        }
    }
    $resolved = ($stack -join '/').TrimStart('/')
    Write-Host "  Link: $link -> $resolved"
}
