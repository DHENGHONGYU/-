$r = Invoke-WebRequest -Uri 'http://localhost:5173/api/proxy/ifind/target-price?symbol=600519.SH' -UseBasicParsing -TimeoutSec 45
Write-Host $r.Content