<#
.SYNOPSIS
  Build skill-to-doc relations and generate skill-doc-index.json
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Loading master-index.json..."
$masterIndexContent = [System.IO.File]::ReadAllText((Resolve-Path "docs/00-meta/ai-index/master-index.json").Path, $utf8NoBom)
$masterIndex = $masterIndexContent | ConvertFrom-Json

$docIdToPath = @{}
foreach ($prop in Get-Member -InputObject $masterIndex.documents -MemberType NoteProperty) {
    $key = $prop.Name
    $doc = $masterIndex.documents.$key
    $docId = if ($doc.doc_id) { $doc.doc_id } else { $key }
    $docIdToPath[$docId] = $doc.path
}

$skillDirs = @(
    ".trae/skills/architecture-debt-remediation",
    ".trae/skills/cross-index-governance",
    ".trae/skills/v9-gatekeeper",
    ".workbuddy/skills/collection-pipeline-testing",
    ".workbuddy/skills/data-flow-integrity-audit",
    ".workbuddy/skills/devops-automation",
    ".workbuddy/skills/mock-data-diagnosis",
    "plugins/ifind",
    "plugins/imf",
    "plugins/kimi-webbridge",
    "plugins/scholar",
    "plugins/sec_edgar",
    "plugins/tianyancha",
    "plugins/yahoo_finance",
    "plugins/yuandian_law"
)

$skillToDocs = @{}
$docToSkills = @{}

foreach ($dir in $skillDirs) {
    $skillPath = "$dir/SKILL.md"
    if (-not (Test-Path $skillPath)) { continue }
    
    $skillName = $dir -replace '^.*/', ''
    $content = [System.IO.File]::ReadAllText((Resolve-Path $skillPath).Path, $utf8NoBom)
    
    $skillId = $null
    $coveredDocs = @()
    
    if ($content -match "^---\r?\n([\s\S]*?)\r?\n---") {
        $fm = $matches[1]
        
        if ($fm -match "skill_id:\s*(.+?)\r?\n") {
            $skillId = $matches[1].Trim()
        }
        
        if ($fm -match "covers_docs:\s*\[(.+?)\]") {
            $docList = $matches[1]
            $coveredDocs = $docList -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^V9-DOC-\w+-\d{3}$" }
        }
    }
    
    if (-not $skillId) {
        $skillId = "V9-SKILL-UNKNOWN"
    }
    
    $skillToDocs[$skillId] = @{
        skill_id = $skillId
        name = $skillName
        path = $skillPath
        covers_docs = $coveredDocs
        doc_count = $coveredDocs.Count
    }
    
    foreach ($docId in $coveredDocs) {
        if (-not $docToSkills.ContainsKey($docId)) {
            $docToSkills[$docId] = @{
                doc_id = $docId
                path = if ($docIdToPath.ContainsKey($docId)) { $docIdToPath[$docId] } else { "UNKNOWN" }
                covered_by = @()
            }
        }
        $docToSkills[$docId].covered_by += $skillId
    }
}

foreach ($docId in $docToSkills.Keys) {
    $docToSkills[$docId].covered_by = $docToSkills[$docId].covered_by | Select-Object -Unique
}

Write-Host ""
Write-Host "========== Skill-Doc Relation Statistics =========="
Write-Host "Total SKILLs: $($skillToDocs.Count)"
Write-Host "Docs covered by SKILLs: $($docToSkills.Count)"

$skillDocIndex = [ordered]@{
    version = "v1.0"
    generated_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    stats = [ordered]@{
        total_skills = $skillToDocs.Count
        docs_covered_by_skills = $docToSkills.Count
    }
    skill_to_docs = $skillToDocs
    doc_to_skills = $docToSkills
}

$json = $skillDocIndex | ConvertTo-Json -Depth 10 -Compress:$false
$outPath = "docs/00-meta/ai-index/skill-doc-index.json"
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path $outPath -Parent)).Path + "\skill-doc-index.json", $json, $utf8NoBom)

Write-Host ""
Write-Host "Skill-doc index written to: $outPath"
Write-Host "File size: $((Get-Item $outPath).Length) bytes"
