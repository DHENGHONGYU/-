<#
.SYNOPSIS
  Fix covers_docs in SKILL frontmatter to only contain valid doc_ids
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$skillDirs = @(
    ".trae/skills/architecture-debt-remediation",
    ".trae/skills/cross-index-governance",
    ".trae/skills/v9-gatekeeper",
    ".workbuddy/skills/collection-pipeline-testing",
    ".workbuddy/skills/data-flow-integrity-audit",
    ".workbuddy/skills/devops-automation",
    ".workbuddy/skills/mock-data-diagnosis"
)

$fixed = 0

foreach ($dir in $skillDirs) {
    $skillPath = "$dir/SKILL.md"
    if (-not (Test-Path $skillPath)) { continue }
    
    $content = [System.IO.File]::ReadAllText((Resolve-Path $skillPath).Path, $utf8NoBom)
    
    if ($content -match "^---\r?\n([\s\S]*?)\r?\n---") {
        $fm = $matches[1]
        
        if ($fm -match "covers_docs:\s*\[(.+?)\]") {
            $docList = $matches[1]
            $docIds = $docList -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^V9-DOC-\w+-\d{3}$" }
            
            if ($docIds.Count -eq 0) {
                $newCovers = "covers_docs: []"
            } else {
                $newCovers = "covers_docs: [$($docIds -join ', ')]"
            }
            
            $newFm = $fm -replace "covers_docs:\s*\[.+?\]", $newCovers
            $newContent = "---`n$newFm`n---" + $content.Substring($matches[0].Length)
            
            [System.IO.File]::WriteAllText((Resolve-Path $skillPath).Path, $newContent, $utf8NoBom)
            $fixed++
        }
    }
}

Write-Host "Fixed $fixed SKILL files"
