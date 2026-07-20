$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $content | ConvertFrom-Json

$pathToDocId = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $path = $doc.path
    $pathToDocId[$path] = if ($doc.doc_id) { $doc.doc_id } else { $key }
}

$testPaths = @(
    "docs/explanation/design/双通道投研评分系统技术方案.md",
    "docs/reference/网页测试检索校对纳入采集方案分析.md"
)

foreach ($testPath in $testPaths) {
    Write-Host "`n=== Testing path: $testPath ==="
    Write-Host "Path length: $($testPath.Length)"
    
    $found = $pathToDocId.Keys | Where-Object { $_.Equals($testPath, [System.StringComparison]::OrdinalIgnoreCase) }
    Write-Host "Found via Equals (IgnoreCase): $($found -ne $null)"
    
    $foundExact = $pathToDocId.Keys | Where-Object { $_ -eq $testPath }
    Write-Host "Found via -eq: $($foundExact -ne $null)"
    
    Write-Host "`nLooking for similar paths:"
    foreach ($key in $pathToDocId.Keys) {
        if ($key -match '双通道') {
            Write-Host "  Key: $key"
            Write-Host "  Key length: $($key.Length)"
            Write-Host "  Equals: $($key.Equals($testPath, [System.StringComparison]::OrdinalIgnoreCase))"
            Write-Host "  -eq: $($key -eq $testPath)"
        }
    }
}