$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $content | ConvertFrom-Json

$pathToDocId = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $path = $doc.path.ToLower()
    $pathToDocId[$path] = if ($doc.doc_id) { $doc.doc_id } else { $key }
}

$testPath = "docs/explanation/design/双通道投研评分系统技术方案.md"
$testPathLower = $testPath.ToLower()

Write-Host "Testing path: $testPath"
Write-Host "Lowercase: $testPathLower"

if ($pathToDocId.ContainsKey($testPathLower)) {
    Write-Host "Found via ContainsKey: $($pathToDocId[$testPathLower])"
} else {
    Write-Host "NOT found via ContainsKey"
}

$filename = "双通道投研评分系统技术方案.md"
$matched = $pathToDocId.Keys | Where-Object { $_ -like "*/$filename" }
Write-Host "Found via -like: $($matched.Count) matches"
if ($matched) { $matched | ForEach-Object { Write-Host "  $_" } }

$matched2 = $pathToDocId.Keys | Where-Object { $_.EndsWith($filename) }
Write-Host "Found via EndsWith: $($matched2.Count) matches"
if ($matched2) { $matched2 | ForEach-Object { Write-Host "  $_" } }