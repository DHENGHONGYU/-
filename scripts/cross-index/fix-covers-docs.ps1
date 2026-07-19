<#
.SYNOPSIS
  Fix @covers_docs to only contain valid doc_ids (V9-DOC-xxx format)
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$testFiles = Get-ChildItem -Path "tests", "e2e", "src" -Filter "*.test.ts" -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\node_modules\\"
}
$specFiles = Get-ChildItem -Path "tests", "e2e", "src" -Filter "*.spec.ts" -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\node_modules\\"
}
$allTests = @($testFiles) + @($specFiles)

$fixed = 0
foreach ($f in $allTests) {
    $content = [System.IO.File]::ReadAllText((Resolve-Path $f.FullName).Path, $utf8NoBom)
    
    if ($content -match "@covers_docs\s+\[(.+?)\]") {
        $docList = $matches[1]
        $docIds = $docList -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^V9-DOC-\w+-\d{3}$" }
        
        if ($docIds.Count -eq 0) {
            $newCovers = "@covers_docs []"
        } else {
            $newCovers = "@covers_docs [$($docIds -join ', ')]"
        }
        
        $content = $content -replace "@covers_docs\s+\[.+?\]", $newCovers
        [System.IO.File]::WriteAllText((Resolve-Path $f.FullName).Path, $content, $utf8NoBom)
        $fixed++
    }
}

Write-Host "Fixed $fixed test files"
