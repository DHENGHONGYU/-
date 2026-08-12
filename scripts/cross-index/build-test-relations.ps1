<#
.SYNOPSIS
  Build test-to-doc relations by scanning test files for doc references
.DESCRIPTION
  1. Scan test files for docs/ paths and V9-DOC-xxx references
  2. Resolve doc paths to doc_ids from master-index.json
  3. Also match by module name (e.g., databridge → databridge docs)
  4. Generate test-doc-index.json
#>
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading master-index.json..."
$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterIndexContent | ConvertFrom-Json

$pathToDocId = @{}
$docIdToPath = @{}
$docIdToTitle = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $path = $doc.path.ToLower()
    $docId = if ($doc.doc_id) { $doc.doc_id } else { $key }
    $pathToDocId[$path] = $docId
    $docIdToPath[$docId] = $path
    $docIdToTitle[$docId] = $doc.title
}
Write-Host "Loaded $($pathToDocId.Count) path->doc_id mappings"

$testFiles = Get-ChildItem -Path "tests", "e2e", "src" -Filter "*.test.ts" -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\node_modules\\"
}
$specFiles = Get-ChildItem -Path "tests", "e2e", "src" -Filter "*.spec.ts" -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\node_modules\\"
}
$allTests = @($testFiles) + @($specFiles)
Write-Host "Found $($allTests.Count) test files"

$testToDocs = @{}
$docToTests = @{}
$totalReferences = 0
$resolvedReferences = 0
$unresolvedReferences = 0
$unresolvedList = @{}
$inferredCount = 0

$testIdCounter = @{}

$moduleKeywords = @(
    @{ name = 'databridge'; patterns = @('databridge', 'dataBridge') },
    @{ name = 'v6'; patterns = @('v6', 'v6Score', 'v6-engine', 'v6-lifecycle') },
    @{ name = 'dataflow'; patterns = @('dataflow', 'data-flow', 'dataFlow') },
    @{ name = 'strategy'; patterns = @('strategy', 'dualStrategy') },
    @{ name = 'scoring'; patterns = @('scoring', 'scoreDoc', 'intelligentScore') },
    @{ name = 'market'; patterns = @('market', 'marketData') },
    @{ name = 'pool'; patterns = @('pool', 'stockPool') },
    @{ name = 'trading'; patterns = @('trading', 'tradeReview') },
    @{ name = 'risk'; patterns = @('risk') },
    @{ name = 'agent'; patterns = @('agent') },
    @{ name = 'mcp'; patterns = @('mcp') },
    @{ name = 'llm'; patterns = @('llm', 'enhancer') },
    @{ name = 'fetcher'; patterns = @('fetcher') },
    @{ name = 'signal'; patterns = @('signal') },
    @{ name = 'portfolio'; patterns = @('portfolio') },
    @{ name = 'screening'; patterns = @('screening') },
    @{ name = 'theme'; patterns = @('theme') },
    @{ name = 'rotation'; patterns = @('rotation') }
)

foreach ($f in $allTests) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
    
    $testDir = if ($relPath -match '^tests/') { 'tests' }
               elseif ($relPath -match '^e2e/') { 'e2e' }
               else { 'src' }
    
    $testName = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    $testName = $testName -replace '\.test$', '' -replace '\.spec$', ''
    
    if (-not $testIdCounter.ContainsKey($testDir)) { $testIdCounter[$testDir] = 0 }
    $testIdCounter[$testDir]++
    $dirPrefix = switch ($testDir) { 'tests' { 'UT' }; 'e2e' { 'E2E' }; 'src' { 'ST' } }
    $testId = "V9-TEST-$dirPrefix-$($testIdCounter[$testDir].ToString('000'))"

    $coveredDocs = @()

    $docPathMatches = [regex]::Matches($content, 'docs/[^"\s,()<>]+')
    foreach ($match in $docPathMatches) {
        $rawPath = $match.Value.TrimEnd('",.')
        $normalizedPath = $rawPath -replace '\\', '/'
        $lowerPath = $normalizedPath.ToLower()
        
        $totalReferences++
        
        if ($pathToDocId.ContainsKey($lowerPath)) {
            $docId = $pathToDocId[$lowerPath]
            $coveredDocs += $docId
            $resolvedReferences++
        } else {
            $unresolvedReferences++
            if (-not $unresolvedList.ContainsKey($relPath)) {
                $unresolvedList[$relPath] = @()
            }
            $unresolvedList[$relPath] += $rawPath
        }
    }

    $docIdMatches = [regex]::Matches($content, 'V9-DOC-\w+-\d{3}')
    foreach ($match in $docIdMatches) {
        $docId = $match.Value
        $totalReferences++
        
        if ($docIdToPath.ContainsKey($docId)) {
            if ($coveredDocs -notcontains $docId) {
                $coveredDocs += $docId
            }
            $resolvedReferences++
        } else {
            $unresolvedReferences++
            if (-not $unresolvedList.ContainsKey($relPath)) {
                $unresolvedList[$relPath] = @()
            }
            $unresolvedList[$relPath] += $docId
        }
    }

    foreach ($kw in $moduleKeywords) {
        foreach ($pattern in $kw.patterns) {
            if ($relPath -match $pattern -or $content -match "(?:import|from).*$pattern") {
                foreach ($docId in $docIdToTitle.Keys) {
                    $title = $docIdToTitle[$docId].ToLower()
                    $path = $docIdToPath[$docId].ToLower()
                    if ($title -match $pattern -or $path -match $pattern) {
                        if ($coveredDocs -notcontains $docId) {
                            $coveredDocs += $docId
                            $inferredCount++
                        }
                    }
                }
            }
        }
    }

    $coveredDocs = $coveredDocs | Select-Object -Unique

    $testToDocs[$relPath] = @{
        test_id = $testId
        path = $relPath
        test_dir = $testDir
        covered_docs = $coveredDocs
        doc_count = $coveredDocs.Count
        inferred = $inferredCount
    }

    foreach ($docId in $coveredDocs) {
        if (-not $docToTests.ContainsKey($docId)) {
            $docToTests[$docId] = @{
                doc_id = $docId
                path = if ($docIdToPath.ContainsKey($docId)) { $docIdToPath[$docId] } else { "UNKNOWN" }
                covered_by = @()
            }
        }
        $docToTests[$docId].covered_by += $testId
    }
}

foreach ($docId in $docToTests.Keys) {
    $docToTests[$docId].covered_by = $docToTests[$docId].covered_by | Select-Object -Unique
}

Write-Host ""
Write-Host "========== Test-Doc Relation Statistics =========="
Write-Host "Total test files: $($allTests.Count)"
Write-Host "Total doc references found: $totalReferences"
Write-Host "Resolved references: $resolvedReferences"
Write-Host "Unresolved references: $unresolvedReferences"
Write-Host "Inferred references: $inferredCount"
Write-Host "Tests with doc coverage: $($testToDocs.Count)"
Write-Host "Docs covered by tests: $($docToTests.Count)"

$testDocIndex = [ordered]@{
    version = "v1.0"
    generated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    stats = [ordered]@{
        total_tests = $allTests.Count
        total_doc_references = $totalReferences
        resolved_references = $resolvedReferences
        unresolved_references = $unresolvedReferences
        inferred_references = $inferredCount
        tests_with_doc_coverage = $testToDocs.Count
        docs_covered_by_tests = $docToTests.Count
        ut_count = $testIdCounter['tests']
        e2e_count = $testIdCounter['e2e']
        st_count = $testIdCounter['src']
    }
    test_to_docs = $testToDocs
    doc_to_tests = $docToTests
    unresolved_references = $unresolvedList
}

$json = $testDocIndex | ConvertTo-Json -Depth 10 -Compress:$false
$outPath = "docs/00-meta/ai-index/test-doc-index.json"
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $outPath -Parent)).Path + "\test-doc-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Test-doc index written to: $outPath"
Write-Host "File size: $((Get-Item $outPath).Length) bytes"
