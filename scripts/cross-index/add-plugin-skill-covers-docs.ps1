<#
.SYNOPSIS
  Add covers_docs to external plugin SKILLs
#>

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

$pluginDirs = @(
    "plugins/ifind",
    "plugins/imf",
    "plugins/kimi-webbridge",
    "plugins/scholar",
    "plugins/sec_edgar",
    "plugins/tianyancha",
    "plugins/yahoo_finance",
    "plugins/yuandian_law"
)

$pluginIdMap = @{
    "ifind" = "V9-PLUGIN-IFIND"
    "imf" = "V9-PLUGIN-IMF"
    "kimi-webbridge" = "V9-PLUGIN-KIMI"
    "scholar" = "V9-PLUGIN-SCHOLAR"
    "sec_edgar" = "V9-PLUGIN-SEC"
    "tianyancha" = "V9-PLUGIN-TYC"
    "yahoo_finance" = "V9-PLUGIN-YAHOO"
    "yuandian_law" = "V9-PLUGIN-YUANDIAN"
}

$pluginKeywords = @{
    "ifind" = @("ifind", "stock", "finance", "data")
    "imf" = @("imf", "international", "monetary", "fund", "economy")
    "kimi-webbridge" = @("kimi", "llm", "bridge", "web")
    "scholar" = @("scholar", "academic", "research", "paper")
    "sec_edgar" = @("sec", "edgar", "filing", "financial", "report")
    "tianyancha" = @("tianyancha", "company", "business", "enterprise")
    "yahoo_finance" = @("yahoo", "finance", "stock", "market")
    "yuandian_law" = @("yuandian", "law", "legal", "regulation")
}

$modified = 0

foreach ($dir in $pluginDirs) {
    $skillPath = "$dir/SKILL.md"
    if (-not (Test-Path $skillPath)) { continue }
    
    $pluginName = $dir -replace '^plugins/', ''
    $skillId = $pluginIdMap[$pluginName]
    $keywords = $pluginKeywords[$pluginName]
    
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
    $coveredDocs = $coveredDocs | Where-Object { $_ -match "^V9-DOC-\w+-\d{3}$" }
    
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
        [System.IO.File]::WriteAllText((Resolve-Path $skillPath).Path, $newContent, $utf8NoBom)
        Write-Host "[OK] $skillPath : skill_id=$skillId, covers_docs=$($coveredDocs.Count)"
        $modified++
    }
    
    $nestedSkillPath = "$dir/skills/$pluginName/SKILL.md"
    if (Test-Path $nestedSkillPath) {
        $content = [System.IO.File]::ReadAllText((Resolve-Path $nestedSkillPath).Path, $utf8NoBom)
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
            [System.IO.File]::WriteAllText((Resolve-Path $nestedSkillPath).Path, $newContent, $utf8NoBom)
            Write-Host "[OK] $nestedSkillPath : skill_id=$skillId, covers_docs=$($coveredDocs.Count)"
            $modified++
        }
    }
}

Write-Host ""
Write-Host "========== Plugin SKILL covers_docs Added =========="
Write-Host "Modified: $modified"
