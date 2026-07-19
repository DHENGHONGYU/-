$keywordTagMap = @(
    @{ Pattern = 'audit|review'; Tag = 'audit' },
    @{ Pattern = 'report'; Tag = 'report' },
    @{ Pattern = 'guide|how-to'; Tag = 'guide' },
    @{ Pattern = 'spec|standard'; Tag = 'spec' },
    @{ Pattern = 'plan|roadmap|strategy'; Tag = 'strategy' },
    @{ Pattern = 'checklist|todo|task'; Tag = 'checklist' },
    @{ Pattern = 'migration|migrate'; Tag = 'migration' },
    @{ Pattern = 'refactor|restructure|reorg'; Tag = 'refactor' },
    @{ Pattern = 'adr|decision'; Tag = 'adr' },
    @{ Pattern = 'registry|index|catalog'; Tag = 'registry' },
    @{ Pattern = 'changelog|change-log'; Tag = 'changelog' },
    @{ Pattern = 'test|testing'; Tag = 'testing' },
    @{ Pattern = 'security'; Tag = 'security' },
    @{ Pattern = 'performance|perf'; Tag = 'performance' },
    @{ Pattern = 'architecture|design'; Tag = 'architecture' },
    @{ Pattern = 'widget|cockpit'; Tag = 'widget' },
    @{ Pattern = 'databridge'; Tag = 'databridge' },
    @{ Pattern = 'mcp'; Tag = 'mcp' },
    @{ Pattern = 'store|storage'; Tag = 'store' },
    @{ Pattern = 'service'; Tag = 'service' },
    @{ Pattern = 'component|ui'; Tag = 'component' },
    @{ Pattern = 'api|rest'; Tag = 'api' },
    @{ Pattern = 'stock|pool|portfolio'; Tag = 'stocks' },
    @{ Pattern = 'score|scoring'; Tag = 'scoring' },
    @{ Pattern = 'factor'; Tag = 'factor' },
    @{ Pattern = 'analysis'; Tag = 'analysis' },
    @{ Pattern = 'risk'; Tag = 'risk' },
    @{ Pattern = 'market'; Tag = 'market' },
    @{ Pattern = 'chart|visual'; Tag = 'visualization' },
    @{ Pattern = 'doc|document|metadata'; Tag = 'documentation' },
    @{ Pattern = 'governance|policy'; Tag = 'governance' },
    @{ Pattern = 'workflow|process'; Tag = 'workflow' },
    @{ Pattern = 'tutorial'; Tag = 'tutorial' },
    @{ Pattern = 'reference'; Tag = 'reference' },
    @{ Pattern = 'explanation|concept'; Tag = 'explanation' },
    @{ Pattern = 'deprecated|legacy'; Tag = 'deprecated' },
    @{ Pattern = 'cleanup'; Tag = 'cleanup' },
    @{ Pattern = 'validation|verify'; Tag = 'validation' },
    @{ Pattern = 'integration'; Tag = 'integration' },
    @{ Pattern = 'deployment|release'; Tag = 'deployment' },
    @{ Pattern = 'monitor|alert'; Tag = 'monitoring' },
    @{ Pattern = 'cache'; Tag = 'cache' },
    @{ Pattern = 'config'; Tag = 'configuration' },
    @{ Pattern = 'state'; Tag = 'state' },
    @{ Pattern = 'routing|router'; Tag = 'routing' },
    @{ Pattern = 'auth|authentication'; Tag = 'auth' },
    @{ Pattern = 'error'; Tag = 'error-handling' },
    @{ Pattern = 'data-definition|data-dictionary'; Tag = 'data-definition' },
    @{ Pattern = 'contract'; Tag = 'contract' },
    @{ Pattern = 'glossary'; Tag = 'glossary' },
    @{ Pattern = 'vision|goal'; Tag = 'vision' }
)

$domainTagMap = @(
    @{ Domain = 'architecture'; Tags = @('architecture', 'design') },
    @{ Domain = 'frontend'; Tags = @('component', 'ui') },
    @{ Domain = 'backend'; Tags = @('service', 'api') },
    @{ Domain = 'data'; Tags = @('data-definition', 'store') },
    @{ Domain = 'ai'; Tags = @('mcp', 'ai') },
    @{ Domain = 'qa'; Tags = @('testing', 'audit') },
    @{ Domain = 'project'; Tags = @('governance', 'documentation') },
    @{ Domain = 'product'; Tags = @('strategy', 'vision') }
)

$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$updated = 0
$skipped = 0

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $body = $content.Substring($matches[0].Length)

    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    if ($tier -ne 'important' -and $tier -ne 'reference') { continue }
    if ($doc.FullName -match '\\archive\\') { continue }

    $existingTags = @()
    if ($fm -match '(?m)^\s*tags\s*:\s*\[(.*?)\]') {
        $tagStr = $matches[1].Trim()
        if ($tagStr -ne '') {
            $existingTags = ($tagStr -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
        }
    }
    if ($existingTags.Count -ge 5) {
        $skipped++
        continue
    }

    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }
    $fileName = $doc.Name
    $dirPath = $doc.FullName.Replace($PWD.Path + '\docs\', '')
    $searchText = ($fileName + ' ' + $dirPath + ' ' + $title).ToLower()

    $domain = ''
    if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') { $domain = $matches[1].Trim() }

    $newTags = @($existingTags)

    foreach ($mapping in $domainTagMap) {
        if ($mapping.Domain -eq $domain) {
            foreach ($tag in $mapping.Tags) {
                if ($newTags -notcontains $tag) {
                    $newTags += $tag
                }
            }
        }
    }

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
}

Write-Host "Updated: $updated"
Write-Host "Skipped: $skipped"
