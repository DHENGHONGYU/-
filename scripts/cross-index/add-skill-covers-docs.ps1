<#
.SYNOPSIS
  Add covers_docs field to SKILL frontmatter
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

$skillDirs = @(
    ".trae/skills/architecture-debt-remediation",
    ".trae/skills/cross-index-governance",
    ".trae/skills/v9-gatekeeper",
    ".workbuddy/skills/collection-pipeline-testing",
    ".workbuddy/skills/data-flow-integrity-audit",
    ".workbuddy/skills/devops-automation",
    ".workbuddy/skills/mock-data-diagnosis"
)

$skillIdMap = @{
    "architecture-debt-remediation" = "V9-SKILL-ARCH-DEBT"
    "cross-index-governance" = "V9-SKILL-CROSSINDEX"
    "v9-gatekeeper" = "V9-SKILL-GATEKEEPER"
    "collection-pipeline-testing" = "V9-SKILL-COLLECTION"
    "data-flow-integrity-audit" = "V9-SKILL-DATAFLOW"
    "devops-automation" = "V9-SKILL-DEVOPS"
    "mock-data-diagnosis" = "V9-SKILL-MOCK-DIAG"
}

$skillKeywords = @{
    "architecture-debt-remediation" = @("architecture", "debt", "layer", "refactor", "audit", "component")
    "cross-index-governance" = @("cross-index", "doc", "document", "index", "related", "reference")
    "v9-gatekeeper" = @("gatekeeper", "routing", "type", "error", "hardcode", "security")
    "collection-pipeline-testing" = @("collection", "pipeline", "sevenDim", "collect", "data")
    "data-flow-integrity-audit" = @("dataflow", "data-flow", "integrity", "audit", "databridge")
    "devops-automation" = @("devops", "backup", "deploy", "automation")
    "mock-data-diagnosis" = @("mock", "fixture", "diagnosis", "data")
}

$modified = 0

foreach ($dir in $skillDirs) {
    $skillPath = "$dir/SKILL.md"
    if (-not (Test-Path $skillPath)) { continue }
    
    $skillName = $dir -replace '^.*/', ''
    $skillId = $skillIdMap[$skillName]
    $keywords = $skillKeywords[$skillName]
    
    $content = [System.IO.File]::ReadAllText((Resolve-Path $skillPath).Path, $utf8NoBom)
    
    $coveredDocs = @()
    
    foreach ($kw in $keywords) {
        foreach ($docId in $docIdToTitle.Keys) {
            $title = $docIdToTitle[$docId].ToLower()
            $path = $docIdToPath[$docId].ToLower()
            if ($title -match $kw -or $path -match $kw) {
                if ($coveredDocs -notcontains $docId) {
                    $coveredDocs += $docId
                }
            }
        }
    }
    
    $coveredDocs = $coveredDocs | Select-Object -Unique | Select-Object -First 5
    
    $docList = $coveredDocs -join ", "
    
    if ($content -match "^---\r?\n([\s\S]*?)\r?\n---") {
        $fm = $matches[1]
        
        $newFm = $fm
        
        if (-not ($fm -match "skill_id:")) {
            $newFm = "skill_id: $skillId`n" + $newFm
        } else {
            $newFm = $newFm -replace "skill_id:\s*.*", "skill_id: $skillId"
        }
        
        if (-not ($fm -match "covers_docs:")) {
            $newFm += "`ncovers_docs: [$docList]"
        } else {
            $newFm = $newFm -replace "covers_docs:\s*\[.*?\]", "covers_docs: [$docList]"
        }
        
        $newContent = "---`n$newFm`n---" + $content.Substring($matches[0].Length)
        
        if ($DryRun) {
            Write-Host "[DRY] $skillPath : skill_id=$skillId, covers_docs=$($coveredDocs.Count)"
        } else {
            [System.IO.File]::WriteAllText((Resolve-Path $skillPath).Path, $newContent, $utf8NoBom)
            Write-Host "[OK] $skillPath : skill_id=$skillId, covers_docs=$($coveredDocs.Count)"
        }
        $modified++
    }
}

Write-Host ""
Write-Host "========== SKILL covers_docs Added =========="
Write-Host "Modified: $modified"
