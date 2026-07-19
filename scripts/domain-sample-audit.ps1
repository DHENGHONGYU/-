$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$samples = @()
$total = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)
    $path = $doc.FullName.Replace($PWD.Path + '\', '')
    if ($path -match '\\archive\\') { continue }

    $total++

    $domain = ''
    if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') { $domain = $matches[1].Trim() }
    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') { $type = $matches[1].Trim() }
    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }
    if ($title.StartsWith('"') -and $title.EndsWith('"')) {
        $title = $title.Substring(1, $title.Length - 2)
    }

    $firstHeading = ''
    if ($body -match '(?m)^#\s+(.+?)\s*$') { $firstHeading = $matches[1].Trim() }

    $firstPara = ''
    $lines = $body -split '\r?\n'
    $paraLines = @()
    foreach ($line in $lines) {
        if ($line -match '^#') { continue }
        if ($line -eq '---') { continue }
        if ($line -eq '') {
            if ($paraLines.Count -gt 0) { break }
            continue
        }
        if ($line -match '^```') { continue }
        if ($line -match '^\|') { continue }
        if ($line -match '^> ') { continue }
        $paraLines += $line
        if ($paraLines.Count -ge 3) { break }
    }
    $firstPara = ($paraLines -join ' ').Trim()
    if ($firstPara.Length -gt 150) { $firstPara = $firstPara.Substring(0, 150) + '...' }

    $samples += [PSCustomObject]@{
        Path = $path
        Title = $title
        FirstHeading = $firstHeading
        Domain = $domain
        Type = $type
        Tier = $tier
        FirstPara = $firstPara
    }
}

$highTier = $samples | Where-Object { $_.Tier -eq 'important' -or $_.Tier -eq 'reference' }
$sampleSize = [Math]::Min(30, $highTier.Count)
$randomSamples = $highTier | Get-Random -Count $sampleSize

Write-Host "Total docs: $total"
Write-Host "High-tier docs: $($highTier.Count)"
Write-Host "Sampling: $sampleSize docs for domain audit"
Write-Host ""
Write-Host "===== Domain Audit Sample (random $sampleSize from important/reference) ====="
Write-Host ""

$idx = 1
foreach ($s in $randomSamples) {
    Write-Host "[$idx] $($s.Path)"
    Write-Host "    Domain: $($s.Domain)"
    Write-Host "    Title: $($s.Title)"
    Write-Host "    First para: $($s.FirstPara)"
    Write-Host ""
    $idx++
}
