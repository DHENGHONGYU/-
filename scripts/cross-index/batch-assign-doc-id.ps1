$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$masterIndexPath = "docs/00-meta/ai-index/master-index.json"
if (-not (Test-Path $masterIndexPath)) {
    Write-Host "ERROR: master-index.json not found"
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $masterIndexPath).Path, $utf8NoBom)
$masterIndex = $content | ConvertFrom-Json

$domainPrefixes = @{
    "project" = "PROJ"
    "architecture" = "ARCH"
    "data" = "DATA"
    "frontend" = "FRONT"
    "backend" = "BACK"
    "ai" = "AI"
    "qa" = "QA"
    "meta" = "META"
    "production" = "PROD"
    "integration" = "INT"
    "deprecated" = "DEPRECATED"
}

$domainCounters = @{}
foreach ($prefix in $domainPrefixes.Values) {
    $domainCounters[$prefix] = 0
}

foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    if ($doc.doc_id) {
        foreach ($prefix in $domainPrefixes.Values) {
            if ($doc.doc_id -match "V9-DOC-$prefix-(\d+)") {
                $num = [int]$matches[1]
                if ($num -gt $domainCounters[$prefix]) {
                    $domainCounters[$prefix] = $num
                }
            }
        }
    }
}

$noDocIdPaths = @($masterIndex.no_doc_id)

Write-Host "Found $($noDocIdPaths.Count) docs without doc_id"
Write-Host ""
Write-Host "Current counters:"
foreach ($prefix in $domainPrefixes.Values) {
    Write-Host ("  {0}: {1}" -f $prefix, $domainCounters[$prefix])
}
Write-Host ""

$assignedCount = 0
$skippedCount = 0

foreach ($path in $noDocIdPaths) {
    $fullPath = Join-Path (Get-Location).Path $path
    if (-not (Test-Path $fullPath)) {
        Write-Host "SKIP: File not found - $path"
        $skippedCount++
        continue
    }

    $fileContent = [System.IO.File]::ReadAllText($fullPath, $utf8NoBom)
    
    if ($fileContent -match 'doc_id:\s*(V9-DOC-\w+-\d+)') {
        Write-Host "SKIP: Already has doc_id - $path"
        $skippedCount++
        continue
    }

    foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
        $key = $prop.Name
        $doc = $masterIndex.documents.$key
        if ($doc.path -eq $path) {
            $domain = $doc.domain
            $status = $doc.status
            
            $prefix = $domainPrefixes["project"]
            if ($domain -and $domainPrefixes.ContainsKey($domain)) {
                $prefix = $domainPrefixes[$domain]
            }
            
            if ($status -eq "archived") {
                $prefix = "ARCH"
            }

            $domainCounters[$prefix]++
            $newDocId = "V9-DOC-$prefix-{0:D3}" -f $domainCounters[$prefix]

            if ($fileContent -match '^---\r?\n') {
                $fileContent = $fileContent -replace '(---\r?\n)', "`$1doc_id: $newDocId`n"
            } else {
                $fileContent = "---`ndoc_id: $newDocId`n---`n`n$fileContent"
            }

            [System.IO.File]::WriteAllText($fullPath, $fileContent, $utf8NoBom)
            Write-Host "ASSIGNED: $newDocId -> $path"
            $assignedCount++
            break
        }
    }
}

Write-Host ""
Write-Host "========== Results =========="
Write-Host "Assigned doc_id: $assignedCount"
Write-Host "Skipped: $skippedCount"