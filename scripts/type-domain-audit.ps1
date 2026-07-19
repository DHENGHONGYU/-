$docs = Get-ChildItem -Path docs -Recurse -Filter *.md
$mismatches = @()
$totalChecked = 0

$typeDirMap = @{
    '00-meta' = 'meta'
    'reference' = 'reference'
    'explanation' = 'explanation'
    'how-to' = 'how-to'
    'tutorials' = 'tutorials'
    'reports' = 'reports'
    'guides' = 'reference'
    '01-frontend' = 'reference'
    '02-backend' = 'reference'
    '03-data' = 'reference'
    '04-testing' = 'reference'
    'team-handbook' = 'reference'
    'architecture' = 'explanation'
}

$domainDirMap = @(
    @{ Pattern = '00-meta'; Domain = 'project' },
    @{ Pattern = '01-frontend'; Domain = 'frontend' },
    @{ Pattern = '02-backend'; Domain = 'backend' },
    @{ Pattern = '03-data'; Domain = 'data' },
    @{ Pattern = '04-testing'; Domain = 'qa' },
    @{ Pattern = 'architecture'; Domain = 'architecture' },
    @{ Pattern = 'explanation\\design'; Domain = 'architecture' },
    @{ Pattern = 'explanation\\architecture'; Domain = 'architecture' },
    @{ Pattern = 'reports\\audit'; Domain = 'qa' },
    @{ Pattern = 'reports\\retrospectives'; Domain = 'project' },
    @{ Pattern = 'widgets'; Domain = 'frontend' },
    @{ Pattern = 'cockpit'; Domain = 'frontend' },
    @{ Pattern = 'data-bridge'; Domain = 'data' },
    @{ Pattern = 'datalayer'; Domain = 'data' },
    @{ Pattern = 'database'; Domain = 'data' },
    @{ Pattern = 'stock'; Domain = 'data' },
    @{ Pattern = 'ai-index'; Domain = 'ai' },
    @{ Pattern = 'ai\\'; Domain = 'ai' },
    @{ Pattern = 'prompts'; Domain = 'ai' },
    @{ Pattern = 'mcp'; Domain = 'ai' },
    @{ Pattern = 'strategy'; Domain = 'product' },
    @{ Pattern = 'product'; Domain = 'product' },
    @{ Pattern = 'team-handbook'; Domain = 'project' },
    @{ Pattern = 'deprecated-docs'; Domain = 'project' }
)

foreach ($doc in $docs) {
    $content = Get-Content $doc.FullName -Raw
    if ($content -notmatch '(?s)^---\s*\r?\n(.*?)\r?\n---') { continue }
    $fm = $matches[1]
    $path = $doc.FullName.Replace($PWD.Path + '\', '')
    $relPath = $path.Substring('docs\'.Length)
    if ($relPath -match 'archive\\') { continue }

    $totalChecked++

    $type = ''
    if ($fm -match '(?m)^\s*type\s*:\s*(.+?)\s*$') { $type = $matches[1].Trim() }
    $domain = ''
    if ($fm -match '(?m)^\s*domain\s*:\s*(.+?)\s*$') { $domain = $matches[1].Trim() }
    $tier = ''
    if ($fm -match '(?m)^\s*tier\s*:\s*(.+?)\s*$') { $tier = $matches[1].Trim() }
    $title = ''
    if ($fm -match '(?m)^\s*title\s*:\s*(.+?)\s*$') { $title = $matches[1].Trim() }

    $dir = $relPath.Split('\')[0]
    $expectedType = ''
    if ($typeDirMap.ContainsKey($dir)) {
        $expectedType = $typeDirMap[$dir]
    }

    $typeMismatch = $false
    if ($expectedType -ne '' -and $type -ne '' -and $type -ne $expectedType) {
        $typeMismatch = $true
    }

    $expectedDomain = ''
    foreach ($m in $domainDirMap) {
        if ($relPath -match $m.Pattern) {
            $expectedDomain = $m.Domain
            break
        }
    }
    $domainMismatch = $false
    if ($expectedDomain -ne '' -and $domain -ne '' -and $domain -ne $expectedDomain) {
        $domainMismatch = $true
    }

    if ($typeMismatch -or $domainMismatch) {
        $mismatches += [PSCustomObject]@{
            Path = $path
            Dir = $dir
            Type = $type
            ExpectedType = $expectedType
            TypeMismatch = $typeMismatch
            Domain = $domain
            ExpectedDomain = $expectedDomain
            DomainMismatch = $domainMismatch
            Tier = $tier
            Title = $title
        }
    }
}

Write-Host "Total checked: $totalChecked"
Write-Host "Mismatches found: $($mismatches.Count)"
Write-Host ""

Write-Host "===== Type mismatches ====="
$typeMis = $mismatches | Where-Object { $_.TypeMismatch }
Write-Host "Count: $($typeMis.Count)"
Write-Host ""
$typeMis | Select-Object -First 30 Path, Type, ExpectedType, Tier | Format-Table -AutoSize

Write-Host ""
Write-Host "===== Domain mismatches ====="
$domMis = $mismatches | Where-Object { $_.DomainMismatch }
Write-Host "Count: $($domMis.Count)"
Write-Host ""
$domMis | Select-Object -First 30 Path, Domain, ExpectedDomain, Tier | Format-Table -AutoSize
