$docs = Get-ChildItem -Path docs -Recurse -Filter *.md

Write-Host "===== Docs without frontmatter ====="
$noFm = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $relPath = $doc.FullName.Replace($PWD.Path + '\', '')
        $noFm += $relPath
        Write-Host "  $relPath"
    }
}
Write-Host "Total: $($noFm.Count)"

Write-Host ""
Write-Host "===== Quick-note tier docs ====="
$quickNote = @()
foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -match '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        $fm = $matches[1]
        if ($fm -match '(?m)^\s*tier\s*:\s*quick-note') {
            $relPath = $doc.FullName.Replace($PWD.Path + '\', '')
            $hasCL = $fm -match '(?m)^\s*change_log\s*:'
            $quickNote += [PSCustomObject]@{ Path = $relPath; HasChangeLog = $hasCL }
            Write-Host "  $relPath - change_log: $hasCL"
        }
    }
}
Write-Host "Total: $($quickNote.Count)"
Write-Host "Missing change_log: $($quickNote.Where({-not $_.HasChangeLog}).Count)"
