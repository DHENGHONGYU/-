$filePath = "c:\Users\huawei\Documents\kimi\Workspaces\智能投研复盘系统V9\src\store\orderStore.test.ts"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Pattern: { profitPct: <num>, buyDate: '<date>', sellDate: '<date>', quantity: <num>, realizedAmount: <num> }
# Replace with: { buyId: 'b<n>', sellId: 's<n>', profitPct: <num>, holdDays: <days>, buyDate: '<date>', sellDate: '<date>', quantity: <num>, realizedAmount: <num> }

$counter = 0
$content = [regex]::Replace($content, '\{ profitPct: (-?[\d.]+), buyDate: ''(\d{4}-\d{2}-\d{2})'', sellDate: ''(\d{4}-\d{2}-\d{2})'', quantity: (\d+), realizedAmount: (-?[\d.]+) \}', {
    param($m)
    $counter++
    $profitPct = $m.Groups[1].Value
    $buyDate = $m.Groups[2].Value
    $sellDate = $m.Groups[3].Value
    $quantity = $m.Groups[4].Value
    $realizedAmount = $m.Groups[5].Value
    
    # Calculate holdDays
    $bd = [datetime]::Parse($buyDate)
    $sd = [datetime]::Parse($sellDate)
    $holdDays = [math]::Ceiling(($sd - $bd).TotalDays)
    
    "{ buyId: 'b$counter', sellId: 's$counter', profitPct: $profitPct, holdDays: $holdDays, buyDate: '$buyDate', sellDate: '$sellDate', quantity: $quantity, realizedAmount: $realizedAmount }"
})

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Updated $counter mock objects"
