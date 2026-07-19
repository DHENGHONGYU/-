$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$badSummaries = @()

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fm = $matches[1]
        $body = $content.Substring($matches[0].Length)

        $summary = ''
        if ($fm -match '(?m)^\s*summary\s*:\s*"?(.*?)"?\s*$') {
            $summary = $matches[1].Trim()
        }
        if ($summary -eq '') { continue }

        $isArchive = $doc.FullName -match '\\archive\\'
        if ($isArchive) { continue }

        $isBad = $false
        $reason = ''

        if ($summary -match '^```') {
            $isBad = $true
            $reason = 'code-block'
        }
        elseif ($summary -match '[^\x00-\x7F]' -and $summary -match '^[^\x00-\x7F]+$') {
            $isBad = $true
            $reason = 'all-garbled'
        }
        elseif ($summary.Length -lt 15) {
            $isBad = $true
            $reason = 'too-short'
        }

        if ($isBad) {
            $tier = ''
            if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') {
                $tier = $matches[1].Trim()
            }
            $badSummaries += [PSCustomObject]@{
                Path = $doc.FullName.Replace($PWD.Path + '\', '')
                Summary = $summary
                Length = $summary.Length
                Tier = $tier
                Reason = $reason
            }
        }
    }
}

Write-Host "Bad summaries found: $($badSummaries.Count)"
Write-Host ""
$badSummaries | Format-Table -AutoSize
