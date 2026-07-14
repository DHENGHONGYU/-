agent-browser open http://localhost:3000/analysis/hot-sector
Start-Sleep -Seconds 5
agent-browser snapshot -i
agent-browser screenshot "$PSScriptRoot\..\tests\e2e\screenshots\hot_sector_initial.png" --full
Start-Sleep -Seconds 1
agent-browser close