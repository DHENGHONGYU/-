$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/relation-index.json").Path, $utf8NoBom)
$json = $content | ConvertFrom-Json

$patterns = @{
    missing_file = 0
    other = 0
    file_url = 0
    double_docs = 0
    query_params = 0
    chinese = 0
    anchor = 0
}

$activePatterns = $patterns.Clone()
$archivedPatterns = $patterns.Clone()

function AnalyzeLinks($links, [ref]$targetPatterns) {
    foreach ($linkObj in $links) {
        $rawLink = if ($linkObj -is [string]) { $linkObj } else { $linkObj.link }
        $resolved = if ($linkObj -is [string]) { $linkObj } else { $linkObj.resolved }
        
        if ($resolved -match '^docs/docs/') { $targetPatterns.Value['double_docs']++ }
        elseif ($resolved -match '^file:///') { $targetPatterns.Value['file_url']++ }
        elseif ($rawLink -match '\?' -or $resolved -match '\?') { $targetPatterns.Value['query_params']++ }
        elseif ($rawLink -match '#') { $targetPatterns.Value['anchor']++ }
        elseif ($rawLink -match '[\u4e00-\u9fff]') { $targetPatterns.Value['chinese']++ }
        else {
            $fileExists = Test-Path $resolved -ErrorAction SilentlyContinue
            if (-not $fileExists) { $targetPatterns.Value['missing_file']++ }
            else { $targetPatterns.Value['other']++ }
        }
    }
}

foreach ($prop in Get-Member -InputObject $json.active_unresolved -MemberType NoteProperty) {
    $srcPath = $prop.Name
    $links = $json.active_unresolved.$srcPath
    AnalyzeLinks $links ([ref]$activePatterns)
}

foreach ($prop in Get-Member -InputObject $json.archived_unresolved -MemberType NoteProperty) {
    $srcPath = $prop.Name
    $links = $json.archived_unresolved.$srcPath
    AnalyzeLinks $links ([ref]$archivedPatterns)
}

Write-Host "=== Active Unresolved Link Patterns ==="
foreach ($key in $activePatterns.Keys) {
    Write-Host "  $key : $($activePatterns[$key])"
}

Write-Host ""
Write-Host "=== Archived Unresolved Link Patterns ==="
foreach ($key in $archivedPatterns.Keys) {
    Write-Host "  $key : $($archivedPatterns[$key])"
}

Write-Host ""
Write-Host "=== Total Unresolved Link Patterns ==="
foreach ($key in $patterns.Keys) {
    $total = $activePatterns[$key] + $archivedPatterns[$key]
    Write-Host "  $key : $total"
}