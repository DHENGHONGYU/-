# Verify dimensions 15/16 data collection
param(
    [string]$BaseUrl = "http://localhost:5173"
)

Write-Host "============================================================"
Write-Host "Dim 15/16 Proxy Endpoint Verification"
Write-Host "Target: 600519.SH (Kweichow Moutai)"
Write-Host "============================================================"

$passed = 0
$total = 4

# Test 1: BonusFinancing
Write-Host "`n[1/4] BonusFinancing (F10)"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/proxy/em-f10/PC_HSF10/BonusFinancing/PageAjax?code=SH600519" -UseBasicParsing -TimeoutSec 20
    $data = $r.Content | ConvertFrom-Json
    $count = $data.fhyx.Count
    Write-Host "  OK HTTP $($r.StatusCode) | fhyx count: $count"
    if ($count -gt 0) {
        $first = $data.fhyx[0]
        Write-Host "     First: $($first.IMPL_PLAN_PROFILE) | ExDate: $($first.EX_DIVIDEND_DATE)"
        $passed++
    }
} catch {
    Write-Host "  FAIL: $_"
}

# Test 2: Share Structure (Tencent Quote)
Write-Host "`n[2/4] Share Structure (Tencent Quote)"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/proxy/tencent/?q=sh600519" -UseBasicParsing -TimeoutSec 20
    $text = $r.Content
    if ($text -match 'v_[^=]+="([^"]+)"') {
        $parts = $matches[1] -split '~'
        $price = [double]$parts[3]
        $totalMcap = [double]$parts[44]
        $floatMcap = [double]$parts[45]
        if ($price -gt 0) {
            $totalShares = [math]::Round($totalMcap / $price, 2)
            $floatShares = [math]::Round($floatMcap / $price, 2)
            Write-Host "  OK HTTP $($r.StatusCode) | Price: $price | TotalMcap: $totalMcap | FloatMcap: $floatMcap"
            Write-Host "     TotalShares: $totalShares | FloatShares: $floatShares"
            $passed++
        } else {
            Write-Host "  WARN: Invalid price"
        }
    } else {
        Write-Host "  FAIL: Parse error"
    }
} catch {
    Write-Host "  FAIL: $_"
}

# Test 3: Consensus Estimates (F10 ProfitForecast)
Write-Host "`n[3/4] Consensus Estimates (F10 ProfitForecast)"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/proxy/em-f10/PC_HSF10/ProfitForecast/PageAjax?code=SH600519" -UseBasicParsing -TimeoutSec 20
    $data = $r.Content | ConvertFrom-Json
    $jgyc = $data.jgyc
    $pjtj = $data.pjtj
    $yctjCount = if ($data.yctj_chart) { $data.yctj_chart.Count } else { 0 }
    Write-Host "  OK HTTP $($r.StatusCode) | jgyc: $($jgyc.Count) | yctj_chart: $yctjCount | pjtj: $($pjtj.Count)"

    # Find first non-ASCII org name (the "recent 6-month average" consensus)
    $consensus = $null
    foreach ($rec in $jgyc) {
        $name = $rec.ORG_NAME_ABBR
        if ($name -and $name.Length -gt 2 -and $name -notmatch '^[ -~]+$') {
            $consensus = $rec
            break
        }
    }
    if (-not $consensus) { $consensus = $jgyc[0] }

    if ($consensus) {
        $yctjChart = $data.yctj_chart
        $chartMap = @{}
        if ($yctjChart) {
            foreach ($c in $yctjChart) {
                if ($c.YEAR) { $chartMap[[int]$c.YEAR] = $c }
            }
        }

        Write-Host "     Org: $($consensus.ORG_NAME_ABBR)"

        $yr1 = $consensus.YEAR1
        $chart1 = $chartMap[[int]$yr1]
        $rev1 = "N/A"; $np1 = "N/A"
        if ($chart1) {
            $rev1 = [math]::Round($chart1.TOTAL_OPERATE_INCOME / 1e8, 2)
            $np1 = [math]::Round($chart1.PARENT_NETPROFIT / 1e8, 2)
        }
        Write-Host "     FY${yr1}($($consensus.YEAR_MARK1)): EPS=$($consensus.EPS1) Rev=${rev1} NP=${np1}"

        $yr2 = $consensus.YEAR2
        $chart2 = $chartMap[[int]$yr2]
        $rev2 = "N/A"; $np2 = "N/A"
        if ($chart2) {
            $rev2 = [math]::Round($chart2.TOTAL_OPERATE_INCOME / 1e8, 2)
            $np2 = [math]::Round($chart2.PARENT_NETPROFIT / 1e8, 2)
        }
        Write-Host "     FY${yr2}($($consensus.YEAR_MARK2)): EPS=$($consensus.EPS2) Rev=${rev2} NP=${np2}"

        $yr3 = $consensus.YEAR3
        $chart3 = $chartMap[[int]$yr3]
        $rev3 = "N/A"; $np3 = "N/A"
        if ($chart3) {
            $rev3 = [math]::Round($chart3.TOTAL_OPERATE_INCOME / 1e8, 2)
            $np3 = [math]::Round($chart3.PARENT_NETPROFIT / 1e8, 2)
        }
        Write-Host "     FY${yr3}($($consensus.YEAR_MARK3)): EPS=$($consensus.EPS3) Rev=${rev3} NP=${np3}"
        $passed++
    } else {
        Write-Host "  WARN: No consensus data"
    }
} catch {
    Write-Host "  FAIL: $_"
}

# Test 4: Rating Summary (F10 ProfitForecast)
Write-Host "`n[4/4] Rating Summary (F10 ProfitForecast)"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/proxy/em-f10/PC_HSF10/ProfitForecast/PageAjax?code=SH600519" -UseBasicParsing -TimeoutSec 20
    $data = $r.Content | ConvertFrom-Json
    $pjtj = $data.pjtj

    # Find rating with DATE_TYPE containing "6" (6-month rating)
    $rating = $null
    foreach ($rec in $pjtj) {
        $dt = $rec.DATE_TYPE
        if ($dt -and $dt.Contains('6')) { $rating = $rec; break }
    }
    if (-not $rating) { $rating = $pjtj[0] }

    if ($rating) {
        Write-Host "  OK HTTP $($r.StatusCode) | DATE_TYPE: $($rating.DATE_TYPE)"
        Write-Host "     Rating: $($rating.COMPRE_RATING) ($($rating.COMPRE_RATING_NUM)) | Orgs: $($rating.RATING_ORG_NUM)"
        Write-Host "     Buy: $($rating.RATING_BUY_NUM) | Add: $($rating.RATING_ADD_NUM) | Neutral: $($rating.RATING_NEUTRAL_NUM) | Reduce: $($rating.RATING_REDUCE_NUM) | Sell: $($rating.RATING_SALE_NUM)"
        $passed++
    } else {
        Write-Host "  WARN: No rating data"
    }
} catch {
    Write-Host "  FAIL: $_"
}

# Summary
Write-Host "`n============================================================"
Write-Host "Summary"
Write-Host "============================================================"
Write-Host "  Passed: $passed/$total"
if ($passed -eq $total) {
    Write-Host "  ALL TESTS PASSED!"
} else {
    Write-Host "  Some tests failed, check logs above"
}

exit (4 - $passed)