$content = Get-Content 'docs\explanation\01-vision-and-goals.md' -Raw
if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $lines = $fm -split '\r?\n'
    foreach ($line in $lines) {
        if ($line -match '^\s*summary\s*:') {
            Write-Host "Current summary: $line"
            break
        }
    }

    Write-Host ""
    Write-Host "===== First 20 lines of body ====="
    $bodyLines = $body -split '\r?\n'
    for ($i = 0; $i -lt [Math]::Min(20, $bodyLines.Count); $i++) {
        Write-Host "  [$i] $($bodyLines[$i])"
    }
}
