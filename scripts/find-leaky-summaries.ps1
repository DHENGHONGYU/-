$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$badSummaries = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]

    $summary = ''
    if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') {
        $summary = $matches[1].Trim()
    }
    if ($summary -eq '') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    $isBad = $false
    $reason = ''

    if ($summary -match 'domain\s*:' -or $summary -match 'tier\s*:' -or $summary -match 'phase\s*:' -or $summary -match 'status\s*:' -or $summary -match 'maintainer\s*:' -or $summary -match 'tags\s*:') {
        $isBad = $true
        $reason = 'frontmatter-leak'
    }
    elseif ($summary -match '^\w+\s*domain\s*:') {
        $isBad = $true
        $reason = 'frontmatter-leak'
    }
    elseif ($summary -match '^ence\s+' -or $summary -match '^tion\s+' -or $summary -match '^ation\s+') {
        $isBad = $true
        $reason = 'truncated-fm'
    }
    elseif ($summary.Length -lt 15) {
        $isBad = $true
        $reason = 'too-short'
    }

    if ($isBad) {
        $tier = ''
        if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
        $badSummaries += [PSCustomObject]@{
            Path = $doc.FullName.Replace($PWD.Path + '\', '')
            Summary = $summary
            Length = $summary.Length
            Tier = $tier
            Reason = $reason
        }
    }
}

Write-Host "Bad summaries found: $($badSummaries.Count)"
Write-Host ""
$badSummaries | Format-Table -AutoSize
