$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$basePath = (Get-Location).Path + "\"

$fsPathSet = New-Object "System.Collections.Generic.Dictionary``2[System.String,System.String]"([System.StringComparer]::OrdinalIgnoreCase)
$allFsPaths = @([System.IO.Directory]::EnumerateFiles($basePath + "docs", "*.md", [System.IO.SearchOption]::AllDirectories))
foreach ($fullPath in $allFsPaths) {
    $relPath = $fullPath.Substring($basePath.Length) -replace '\\', '/'
    $fsPathSet[$relPath] = $fullPath
}

$relationIndexPath = "docs/00-meta/ai-index/relation-index.json"
$content = [System.IO.File]::ReadAllText((Resolve-Path $relationIndexPath).Path, $utf8NoBom)
$relationIndex = $content | ConvertFrom-Json

$masterIndexPath = "docs/00-meta/ai-index/master-index.json"
$masterContent = [System.IO.File]::ReadAllText((Resolve-Path $masterIndexPath).Path, $utf8NoBom)
$masterIndex = $masterContent | ConvertFrom-Json

$docIdToPath = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $doc = $masterIndex.documents.$($prop.Name)
    if ($doc.doc_id) {
        $docIdToPath[$doc.doc_id] = $doc.path
    }
}

$totalFixed = 0

foreach ($prop in Get-Member -InputObject $relationIndex.active_unresolved -MemberType NoteProperty) {
    $srcDocId = $prop.Name
    
    if (-not $docIdToPath.ContainsKey($srcDocId)) {
        continue
    }
    
    $srcPath = $docIdToPath[$srcDocId]
    $fullSrcPath = Join-Path (Get-Location).Path $srcPath
    
    if (-not [System.IO.File]::Exists($fullSrcPath)) {
        continue
    }
    
    $fileBytes = [System.IO.File]::ReadAllBytes($fullSrcPath)
    $fileContent = $utf8NoBom.GetString($fileBytes)
    
    $links = $relationIndex.active_unresolved.$srcDocId
    $fixedInFile = 0
    
    foreach ($linkObj in $links) {
        $rawLink = $linkObj.link
        $resolved = $linkObj.resolved
        
        $filename = [System.IO.Path]::GetFileName($resolved)
        $filenameNoExt = [System.IO.Path]::GetFileNameWithoutExtension($filename)
        
        $foundPath = $null
        foreach ($key in $fsPathSet.Keys) {
            if ($key.EndsWith("/$filename", [System.StringComparison]::OrdinalIgnoreCase)) {
                $foundPath = $key
                break
            }
        }
        
        if ($foundPath) {
            $pattern = "\[([^\]]+)\]\(\s*${rawLink}\s*\)"
            $replacement = "[$1]($foundPath)"
            
            $newContent = [regex]::Replace($fileContent, $pattern, $replacement)
            if ($newContent -ne $fileContent) {
                $fileContent = $newContent
                $fixedInFile++
                $totalFixed++
                Write-Host "Fixed in $srcPath : $rawLink -> $foundPath"
            }
        }
    }
    
    if ($fixedInFile -gt 0) {
        [System.IO.File]::WriteAllText($fullSrcPath, $fileContent, $utf8NoBom)
    }
}

Write-Host ""
Write-Host "Total links fixed across all files: $totalFixed"