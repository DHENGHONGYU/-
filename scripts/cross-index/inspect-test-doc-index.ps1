$json = Get-Content 'docs/00-meta/ai-index/test-doc-index.json' -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host "=== Unresolved References ==="
foreach ($prop in Get-Member -InputObject $json.unresolved_references -MemberType NoteProperty) {
    $testPath = $prop.Name
    $refs = $json.unresolved_references.$testPath
    if ($refs.Count -eq 0) { continue }
    Write-Host ""
    Write-Host "[$testPath]"
    foreach ($ref in $refs) {
        Write-Host "  $ref"
    }
}

Write-Host ""
Write-Host "=== Top 5 Tests with Most References ==="
$testToDocs = $json.test_to_docs
$topTests = @()
foreach ($prop in Get-Member -InputObject $testToDocs -MemberType NoteProperty) {
    $key = $prop.Name
    $val = $testToDocs.$key
    $topTests += [PSCustomObject]@{ path = $key; doc_count = $val.doc_count }
}
$topTests | Sort-Object doc_count -Descending | Select-Object -First 5 | Format-Table -AutoSize
