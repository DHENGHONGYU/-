$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$relationIndexPath = "docs/00-meta/ai-index/relation-index.json"
$content = [System.IO.File]::ReadAllText((Resolve-Path $relationIndexPath).Path, $utf8NoBom)
$relationIndex = $content | ConvertFrom-Json

$sourceCounts = @{}
foreach ($prop in Get-Member -InputObject $relationIndex.active_unresolved -MemberType NoteProperty) {
    $srcDocId = $prop.Name
    $links = $relationIndex.active_unresolved.$srcDocId
    $sourceCounts[$srcDocId] = $links.Count
}

$sourceCounts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host "$($_.Key): $($_.Value) unresolved links"
}