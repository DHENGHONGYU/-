$keywordTagMap = @(
    @{ Pattern = 'audit'; Tag = 'audit' },
    @{ Pattern = 'report'; Tag = 'report' },
    @{ Pattern = 'guide'; Tag = 'guide' },
    @{ Pattern = 'spec|standard'; Tag = 'spec' },
    @{ Pattern = 'plan|roadmap'; Tag = 'plan' },
    @{ Pattern = 'checklist|todo|task'; Tag = 'checklist' },
    @{ Pattern = 'migration|migrate'; Tag = 'migration' },
    @{ Pattern = 'refactor|restructure|reorg'; Tag = 'refactor' },
    @{ Pattern = 'adr|decision'; Tag = 'adr' },
    @{ Pattern = 'registry|index|catalog'; Tag = 'registry' },
    @{ Pattern = 'changelog|change-log|release'; Tag = 'changelog' },
    @{ Pattern = 'test|testing|qa'; Tag = 'testing' },
    @{ Pattern = 'security'; Tag = 'security' },
    @{ Pattern = 'performance|perf'; Tag = 'performance' },
    @{ Pattern = 'architecture|design'; Tag = 'architecture' },
    @{ Pattern = 'widget|cockpit'; Tag = 'widget' },
    @{ Pattern = 'databridge|data-bridge'; Tag = 'databridge' },
    @{ Pattern = 'mcp'; Tag = 'mcp' },
    @{ Pattern = 'store|storage'; Tag = 'store' },
    @{ Pattern = 'service'; Tag = 'service' },
    @{ Pattern = 'component|ui'; Tag = 'component' },
    @{ Pattern = 'api|rest|endpoint'; Tag = 'api' },
    @{ Pattern = 'stock|pool'; Tag = 'stocks' },
    @{ Pattern = 'score|scoring'; Tag = 'scoring' },
    @{ Pattern = 'factor'; Tag = 'factor' },
    @{ Pattern = 'analysis|analyze'; Tag = 'analysis' },
    @{ Pattern = 'strategy'; Tag = 'strategy' },
    @{ Pattern = 'risk'; Tag = 'risk' },
    @{ Pattern = 'portfolio|position'; Tag = 'portfolio' },
    @{ Pattern = 'market'; Tag = 'market' },
    @{ Pattern = 'chart|visual'; Tag = 'visualization' },
    @{ Pattern = 'doc|document|metadata'; Tag = 'documentation' },
    @{ Pattern = 'governance|policy'; Tag = 'governance' },
    @{ Pattern = 'workflow|process'; Tag = 'workflow' },
    @{ Pattern = 'tutorial|learn|getting-started'; Tag = 'tutorial' },
    @{ Pattern = 'how-to|howto'; Tag = 'how-to' },
    @{ Pattern = 'reference'; Tag = 'reference' },
    @{ Pattern = 'explanation|concept'; Tag = 'explanation' },
    @{ Pattern = 'deprecated|legacy'; Tag = 'deprecated' },
    @{ Pattern = 'cleanup|clean-up'; Tag = 'cleanup' },
    @{ Pattern = 'validation|verify'; Tag = 'validation' },
    @{ Pattern = 'integration|integrate'; Tag = 'integration' },
    @{ Pattern = 'deployment|deploy|release'; Tag = 'deployment' },
    @{ Pattern = 'monitor|alert'; Tag = 'monitoring' },
    @{ Pattern = 'cache|caching'; Tag = 'cache' },
    @{ Pattern = 'config|configuration'; Tag = 'configuration' },
    @{ Pattern = 'state|state-management'; Tag = 'state' },
    @{ Pattern = 'routing|router|route'; Tag = 'routing' },
    @{ Pattern = 'auth|authentication'; Tag = 'auth' },
    @{ Pattern = 'error|exception'; Tag = 'error-handling' }
)

$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$updated = 0
$skipped = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') {
        continue
    }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') {
        $tier = $matches[1].Trim()
    }
    if ($tier -ne 'important' -and $tier -ne 'reference') {
        continue
    }
    if ($doc.FullName -match '\\archive\\') {
        continue
    }

    $existingTags = @()
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') {
            $existingTags = ($tagStr -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
        }
    }
    if ($existingTags.Count -gt 3) {
        continue
    }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') {
        $title = $matches[1].Trim()
    }
    $fileName = $doc.Name
    $dirPath = $doc.FullName.Replace($PWD.Path + '\docs\', '')
    $searchText = ($fileName + ' ' + $dirPath + ' ' + $title).ToLower()

    $newTags = @($existingTags)
    foreach ($mapping in $keywordTagMap) {
        $pattern = $mapping.Pattern
        $tag = $mapping.Tag
        if ($searchText -match $pattern -and $newTags -notcontains $tag) {
            $newTags += $tag
        }
    }

    if ($newTags.Count -le $existingTags.Count) {
        $skipped++
        continue
    }

    $tagStr = '[' + ($newTags -join ', ') + ']'
    $newFm = $fm -replace '(?m)^\s*tags\s*:\s*\[.*?\]\s*$', "tags: $tagStr"

    if ($newFm -eq $fm) {
        $skipped++
        continue
    }

    $newContent = "---`n" + $newFm + "`n---" + $body
    Set-Content -Path $doc.FullName -Value $newContent -NoNewline
    $updated++
    Write-Host ("OK: " + $doc.FullName.Replace($PWD.Path + '\', '') + " -> " + $newTags.Count + " tags (" + ($newTags -join ', ') + ")")
}

Write-Host ""
Write-Host "Updated: $updated"
Write-Host "Skipped: $skipped"
