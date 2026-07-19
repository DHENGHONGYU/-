$json = Get-Content 'docs/00-meta/ai-index/master-index.json' -Raw -Encoding UTF8 | ConvertFrom-Json

$paths = @(
    'docs/reports/脚本与测试质量检查报告.md',
    'docs/implementation/walkthrough-agent-llm-report-20260704.md',
    'docs/03-development/data-flow-convergence-plan.md',
    'docs/reports/remediation-efficiency.json',
    'docs/reports/code-graph.json',
    'docs/reports/lessons-learned/token-optimization-best-practices.md'
)

foreach ($p in $paths) {
    $lower = $p.ToLower()
    $found = $false
    foreach ($prop in Get-Member -InputObject $json.documents -MemberType NoteProperty) {
        $doc = $json.documents.$($prop.Name)
        if ($doc.path.ToLower() -eq $lower) {
            Write-Host "FOUND: $p -> $($doc.doc_id)"
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host "NOT FOUND: $p"
        if (Test-Path $p) {
            Write-Host "  (file exists but not in master-index)"
        } else {
            Write-Host "  (file does not exist)"
        }
    }
}
