$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$broken = 0
$fixed = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        continue
    }
    $fm = $matches[1]
    $lines = $fm -split '\r?\n'
    $hasIssue = $false
    $newLines = @()

    foreach ($line in $lines) {
        if ($line -match '^\s*title\s*:\s*(.+?)(type:\s*[\w-]+)\s*$') {
            $hasIssue = $true
            $titlePart = $matches[1].Trim()
            $typePart = $matches[2].Trim()
            $newLines += "title: $titlePart"
            $newLines += $typePart
            $broken++
            Write-Host ("BROKEN TITLE: " + $doc.FullName.Replace($PWD.Path + '\', ''))
        } else {
            $newLines += $line
        }
    }

    if ($hasIssue) {
        $newFm = $newLines -join "`n"
        $body = $content.Substring($matches[0].Length)
        $newContent = "---`n" + $newFm + "`n---" + $body
        Set-Content -Path $doc.FullName -Value $newContent -NoNewline
        $fixed++
    }
}

Write-Host ""
Write-Host "Broken title fields found: $broken"
Write-Host "Fixed: $fixed"
