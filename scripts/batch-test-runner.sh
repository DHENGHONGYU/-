#!/bin/bash
# batch-test-runner.sh — 分批运行 vitest 测试，避免 Windows Worker 崩溃问题
# 用法: bash scripts/batch-test-runner.sh [coverage=true|false]
#
# 策略: 将测试文件分成小批次，每批使用独立的 vitest 进程运行，
#       避免 tinypool Worker 内存溢出导致的崩溃。

COVERAGE="${1:-false}"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
BATCH_NUM=0
FAILED_FILES=""

# 定义批次 — 每批约 8-12 个文件，确保不会内存溢出
BATCHES=(
  # Batch 1: 核心服务层 (services)
  "src/services/__tests__ src/services/analysis src/services/scoring src/services/fetcher src/services/news"
  # Batch 2: 服务层续
  "src/services/llm src/services/trading src/services/execution src/services/signal src/services/strategy src/services/portfolio src/services/risk src/services/backtest"
  # Batch 3: 服务层剩余
  "src/services/data src/services/output src/services/market src/services/sector src/services/discipline src/services/industry src/services/intelligent src/services/local"
  # Batch 4: Store层 - 第1批
  "src/store/__tests__ src/store/agentStore.test.ts src/store/analysisNewsStore.test.ts src/store/backtestStore.test.ts src/store/commandStore.test.ts src/store/dataflowStore.test.ts src/store/disciplineStore.test.ts src/store/dualStrategyStore.test.ts src/store/engineStore.test.ts"
  # Batch 5: Store层 - 第2批
  "src/store/executionStore.test.ts src/store/holdingsStore.test.ts src/store/hotSectorStore.test.ts src/store/industryScoreStore.test.ts src/store/inputHubStore.test.ts src/store/intelligentScoreStore.test.ts src/store/localKnowledgeStore.test.ts src/store/marketDataStore.test.ts src/store/multiFactorScreeningStore.test.ts src/store/orderStore.test.ts"
  # Batch 6: Store层 - 第3批
  "src/store/outputStore.test.ts src/store/pageStore.test.ts src/store/poolStore.test.ts src/store/portfolioStore.test.ts src/store/positionStore.test.ts src/store/riskStore.test.ts src/store/rotationSignalStore.test.ts src/store/scoreDocStore.test.ts src/store/sectorAnalysisStore.test.ts src/store/signalQualityStore.test.ts"
  # Batch 7: Store层 - 第4批
  "src/store/signalStore.test.ts src/store/stockAnalysisStore.test.ts src/store/strategySnapshotStore.test.ts src/store/tradingHubStore.test.ts src/store/tradingStore.test.ts src/store/valuePitStore.test.ts src/store/widgetStore.test.ts src/store/workflowStore.test.ts"
  # Batch 8: 其他测试 (components, hooks, pages, etc.)
  "src/components src/hooks src/core src/lib src/data src/config src/portal src/apps"
)

for BATCH in "${BATCHES[@]}"; do
  BATCH_NUM=$((BATCH_NUM + 1))
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  Batch $BATCH_NUM: $BATCH"
  echo "════════════════════════════════════════════════════════"
  
  COVERAGE_FLAG=""
  if [ "$COVERAGE" = "true" ]; then
    COVERAGE_FLAG="--coverage.enabled=true"
  else
    COVERAGE_FLAG="--coverage.enabled=false"
  fi
  
  RESULT=$(npx vitest run $BATCH $COVERAGE_FLAG --reporter=verbose 2>&1)
  
  # 提取测试结果
  PASS_LINE=$(echo "$RESULT" | grep "Tests" | head -1)
  FILE_LINE=$(echo "$RESULT" | grep "Test Files" | head -1)
  
  if echo "$RESULT" | grep -q "Test Files.*passed"; then
    echo "✅ Batch $BATCH_NUM PASSED"
    echo "   $FILE_LINE"
    echo "   $PASS_LINE"
  else
    echo "❌ Batch $BATCH_NUM FAILED"
    echo "   $FILE_LINE"
    echo "   $PASS_LINE"
    FAILED_FILES="$FAILED_FILES $BATCH"
  fi
  
  # 累计数字
  BATCH_PASS=$(echo "$PASS_LINE" | grep -oP '\d+ passed' | grep -oP '\d+' || echo "0")
  BATCH_FAIL=$(echo "$PASS_LINE" | grep -oP '\d+ failed' | grep -oP '\d+' || echo "0")
  BATCH_SKIP=$(echo "$PASS_LINE" | grep -oP '\d+ skipped' | grep -oP '\d+' || echo "0")
  PASS_COUNT=$((PASS_COUNT + BATCH_PASS))
  FAIL_COUNT=$((FAIL_COUNT + BATCH_FAIL))
  SKIP_COUNT=$((SKIP_COUNT + BATCH_SKIP))
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "  📊 总测试结果"
echo "════════════════════════════════════════════════════════"
echo "  Total Passed:  $PASS_COUNT"
echo "  Total Failed:  $FAIL_COUNT"
echo "  Total Skipped: $SKIP_COUNT"
echo "  Total Tests:   $((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))"
echo ""

if [ -n "$FAILED_FILES" ]; then
  echo "⚠️ 失败的批次:"
  echo "$FAILED_FILES"
  echo ""
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "❌ 有 $FAIL_COUNT 个测试失败"
  exit 1
else
  echo "✅ 所有 $PASS_COUNT 个测试通过！"
  exit 0
fi
