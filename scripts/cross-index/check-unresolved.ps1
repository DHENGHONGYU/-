$json = Get-Content 'docs/00-meta/ai-index/relation-index.json' -Raw -Encoding UTF8 | ConvertFrom-Json

$props = Get-Member -InputObject $json -MemberType NoteProperty
Write-Host "Top-level keys:"
foreach ($p in $props) {
    Write-Host "  - $($p.Name)"
}

Write-Host ""
Write-Host "Stats:"
$json.stats | Format-List

if ($json.unresolved_links) {
    Write-Host ""
    Write-Host "Unresolved links present"
    $unresolvedProps = Get-Member -InputObject $json.unresolved_links -MemberType NoteProperty
    Write-Host "  Sources: $($unresolvedProps.Count)"
} else {
    Write-Host ""
    Write-Host "No unresolved_links found"
}
