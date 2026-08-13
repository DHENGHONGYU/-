<#
.SYNOPSIS
  Build code-to-doc relations by scanning src/ files for doc references
.DESCRIPTION
  1. Scan src/ files (excluding .test.ts) for docs/ paths in @see tags
  2. Resolve doc paths to doc_ids from master-index.json
  3. Also match by module name
  4. Generate code-doc-index.json
#>
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading master-index.json..."
$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/meta/ai-index/master-index.json").Path, $utf8NoBom)
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

$srcFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\.test\.ts$"
}
Write-Host "Found $($srcFiles.Count) src files"

$codeToDocs = @{}
$docToCodes = @{}
$totalReferences = 0
$resolvedReferences = 0
$unresolvedReferences = 0
$unresolvedList = @{}
$inferredCount = 0

$moduleKeywords = @(
    @{ name = 'databridge'; patterns = @('databridge', 'dataBridge') },
    @{ name = 'v6'; patterns = @('v6', 'v6Score', 'v6-engine', 'scoring') },
    @{ name = 'dataflow'; patterns = @('dataflow', 'data-flow') },
    @{ name = 'strategy'; patterns = @('strategy', 'dualStrategy') },
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
    @{ name = 'rotation'; patterns = @('rotation') },
    @{ name = 'store'; patterns = @('store') },
    @{ name = 'analysis'; patterns = @('analysis') },
    @{ name = 'service'; patterns = @('service') },
    @{ name = 'types'; patterns = @('types') },
    @{ name = 'config'; patterns = @('config') },
    @{ name = 'lib'; patterns = @('lib') },
    @{ name = 'core'; patterns = @('core') },
    @{ name = 'hooks'; patterns = @('hooks') },
    @{ name = 'components'; patterns = @('components') }
)

foreach ($f in $srcFiles) {
    $content = [System.IO.File]::ReadAllText((Resolve-Path $f.FullName).Path, $utf8NoBom)
    $relPath = $f.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
    
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
            if ($relPath -match $pattern) {
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

    $codeToDocs[$relPath] = @{
        path = $relPath
        covered_docs = $coveredDocs
        doc_count = $coveredDocs.Count
    }

    foreach ($docId in $coveredDocs) {
        if (-not $docToCodes.ContainsKey($docId)) {
            $docToCodes[$docId] = @{
                doc_id = $docId
                path = if ($docIdToPath.ContainsKey($docId)) { $docIdToPath[$docId] } else { "UNKNOWN" }
                covered_by = @()
            }
        }
        $docToCodes[$docId].covered_by += $relPath
    }
}

foreach ($docId in $docToCodes.Keys) {
    $docToCodes[$docId].covered_by = $docToCodes[$docId].covered_by | Select-Object -Unique
}

Write-Host ""
Write-Host "========== Code-Doc Relation Statistics =========="
Write-Host "Total src files: $($srcFiles.Count)"
Write-Host "Total doc references found: $totalReferences"
Write-Host "Resolved references: $resolvedReferences"
Write-Host "Unresolved references: $unresolvedReferences"
Write-Host "Inferred references: $inferredCount"
Write-Host "Src files with doc coverage: $($codeToDocs.Count)"
Write-Host "Docs covered by code: $($docToCodes.Count)"

$codeDocIndex = [ordered]@{
    version = "v1.0"
    generated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    stats = [ordered]@{
        total_src_files = $srcFiles.Count
        total_doc_references = $totalReferences
        resolved_references = $resolvedReferences
        unresolved_references = $unresolvedReferences
        inferred_references = $inferredCount
        src_files_with_doc_coverage = $codeToDocs.Count
        docs_covered_by_code = $docToCodes.Count
    }
    code_to_docs = $codeToDocs
    doc_to_codes = $docToCodes
    unresolved_references = $unresolvedList
}

$json = $codeDocIndex | ConvertTo-Json -Depth 10 -Compress:$false
$outPath = "docs/meta/ai-index/code-doc-index.json"
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $outPath -Parent)).Path + "\code-doc-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Code-doc index written to: $outPath"
Write-Host "File size: $((Get-Item $outPath).Length) bytes"
