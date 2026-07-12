#!/bin/bash
# 实时行情压力测试脚本
# 从 20 只随机 A 股验证腾讯/新浪 API 连通性、延迟、数据完整性
# 用法: bash scripts/stress-test-realtime-quotes.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   A 股实时行情压力测试                      ${NC}"
echo -e "${CYAN}   20 只随机股票 × 腾讯 + 新浪               ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ---- 20 只已知活跃 A 股（跨沪/深/创/科，分散行业） ----
STOCK_CODES=(
  "600519" "贵州茅台"    # 白酒
  "000858" "五粮液"     # 白酒
  "600036" "招商银行"    # 银行
  "601318" "中国平安"    # 保险
  "300750" "宁德时代"    # 新能源
  "002594" "比亚迪"     # 新能源车
  "600276" "恒瑞医药"    # 医药
  "300059" "东方财富"    # 券商/金融科技
  "000002" "万科A"      # 地产
  "601166" "兴业银行"    # 银行
  "002415" "海康威视"    # 安防/AI
  "601012" "隆基绿能"    # 光伏
  "600887" "伊利股份"    # 食品
  "000333" "美的集团"    # 家电
  "002371" "北方华创"    # 半导体设备
  "688981" "中芯国际"    # 晶圆代工
  "600941" "中国移动"    # 通信
  "601857" "中国石油"    # 能源
  "600809" "山西汾酒"    # 白酒
  "002714" "牧原股份"    # 养殖
)

COUNT=${#STOCK_CODES[@]}
CODES=()
NAMES=()
for ((i=0; i<COUNT; i+=2)); do
  CODES+=("${STOCK_CODES[$i]}")
  idx=$((i+1))
  NAMES+=("${STOCK_CODES[$idx]}")
done

echo -e "${YELLOW}测试股票 (${#CODES[@]} 只):${NC}"
for ((i=0; i<${#CODES[@]}; i++)); do
  echo "  ${CODES[$i]} - ${NAMES[$i]}"
done
echo ""

# ---- 工具函数 ----

tencent_code() {
  local code=$1
  if [[ $code == 6* ]]; then
    echo "sh${code}"
  else
    echo "sz${code}"
  fi
}

sina_code() {
  tencent_code "$1"
}

# ---- 腾讯 API 测试 ----
echo -e "${CYAN}===== 腾讯 API (qt.gtimg.cn) =====${NC}"
TENCENT_OK=0
TENCENT_FAIL=0
TENCENT_TOTAL=0
TENCENT_TIMES=()
TENCENT_ERRORS=()

for code in "${CODES[@]}"; do
  TENCENT_TOTAL=$((TENCENT_TOTAL + 1))
  tcode=$(tencent_code "$code")
  url="https://qt.gtimg.cn/q=${tcode}"

  start_ms=$(date +%s%3N)
  response=$(curl -s --connect-timeout 5 --max-time 8 "$url" 2>/dev/null)
  end_ms=$(date +%s%3N)
  latency=$((end_ms - start_ms))
  TENCENT_TIMES+=("$latency")

  if echo "$response" | grep -q "v_${tcode}=" && echo "$response" | grep -q "~"; then
    TENCENT_OK=$((TENCENT_OK + 1))
    # 提取最新价（第4个~分隔字段）
    price=$(echo "$response" | sed 's/.*~\([^~]*\)~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~.*/\1/' 2>/dev/null)
    echo -e "  ${GREEN}✅${NC} ${code} (${tcode}) ${latency}ms 价≈${price}"
  else
    TENCENT_FAIL=$((TENCENT_FAIL + 1))
    err_msg=$(echo "$response" | head -c 80 | tr -d '\n\r')
    TENCENT_ERRORS+=("$code: $err_msg")
    echo -e "  ${RED}❌${NC} ${code} (${tcode}) ${latency}ms - $err_msg"
  fi
done

# ---- 腾讯统计 ----
echo ""
echo "--- 腾讯统计 ---"
echo "  成功/总数: ${TENCENT_OK}/${TENCENT_TOTAL}"

if [ ${#TENCENT_TIMES[@]} -gt 0 ]; then
  total=0
  min_lat=${TENCENT_TIMES[0]}
  max_lat=${TENCENT_TIMES[0]}
  for t in "${TENCENT_TIMES[@]}"; do
    total=$((total + t))
    [ "$t" -lt "$min_lat" ] && min_lat=$t
    [ "$t" -gt "$max_lat" ] && max_lat=$t
  done
  avg_lat=$((total / ${#TENCENT_TIMES[@]}))
  echo "  最小延迟: ${min_lat}ms"
  echo "  最大延迟: ${max_lat}ms"
  echo "  平均延迟: ${avg_lat}ms"

  # P50 / P95
  sorted_times=($(printf "%s\n" "${TENCENT_TIMES[@]}" | sort -n))
  len=${#sorted_times[@]}
  p50_idx=$((len * 50 / 100))
  p95_idx=$((len * 95 / 100))
  [ "$p50_idx" -ge "$len" ] && p50_idx=$((len - 1))
  [ "$p95_idx" -ge "$len" ] && p95_idx=$((len - 1))
  echo "  P50 延迟: ${sorted_times[$p50_idx]}ms"
  echo "  P95 延迟: ${sorted_times[$p95_idx]}ms"
fi

if [ ${#TENCENT_ERRORS[@]} -gt 0 ]; then
  echo "  错误详情(${#TENCENT_ERRORS[@]}):"
  for err in "${TENCENT_ERRORS[@]}"; do
    echo "    - $err"
  done
fi

echo ""

# ---- 新浪 API 测试 ----
echo -e "${CYAN}===== 新浪 API (hq.sinajs.cn) =====${NC}"
SINA_OK=0
SINA_FAIL=0
SINA_TOTAL=0
SINA_TIMES=()
SINA_ERRORS=()

for code in "${CODES[@]}"; do
  SINA_TOTAL=$((SINA_TOTAL + 1))
  scode=$(sina_code "$code")
  url="https://hq.sinajs.cn/list=${scode}"

  start_ms=$(date +%s%3N)
  response=$(curl -s --connect-timeout 5 --max-time 8 -H "Referer: https://finance.sina.com.cn" "$url" 2>/dev/null)
  end_ms=$(date +%s%3N)
  latency=$((end_ms - start_ms))
  SINA_TIMES+=("$latency")

  if echo "$response" | grep -q "hq_str_${scode}=" && echo "$response" | grep -q ","; then
    SINA_OK=$((SINA_OK + 1))
    stock_name=$(echo "$response" | sed 's/.*="\([^,]*\),.*/\1/')
    echo -e "  ${GREEN}✅${NC} ${code} (${scode}) ${latency}ms 名=\"${stock_name}\""
  else
    SINA_FAIL=$((SINA_FAIL + 1))
    err_msg=$(echo "$response" | head -c 80 | tr -d '\n\r')
    SINA_ERRORS+=("$code: $err_msg")
    echo -e "  ${RED}❌${NC} ${code} (${scode}) ${latency}ms - $err_msg"
  fi
done

# ---- 新浪统计 ----
echo ""
echo "--- 新浪统计 ---"
echo "  成功/总数: ${SINA_OK}/${SINA_TOTAL}"

if [ ${#SINA_TIMES[@]} -gt 0 ]; then
  total=0
  min_lat=${SINA_TIMES[0]}
  max_lat=${SINA_TIMES[0]}
  for t in "${SINA_TIMES[@]}"; do
    total=$((total + t))
    [ "$t" -lt "$min_lat" ] && min_lat=$t
    [ "$t" -gt "$max_lat" ] && max_lat=$t
  done
  avg_lat=$((total / ${#SINA_TIMES[@]}))
  echo "  最小延迟: ${min_lat}ms"
  echo "  最大延迟: ${max_lat}ms"
  echo "  平均延迟: ${avg_lat}ms"

  sorted_times=($(printf "%s\n" "${SINA_TIMES[@]}" | sort -n))
  len=${#sorted_times[@]}
  p50_idx=$((len * 50 / 100))
  p95_idx=$((len * 95 / 100))
  [ "$p50_idx" -ge "$len" ] && p50_idx=$((len - 1))
  [ "$p95_idx" -ge "$len" ] && p95_idx=$((len - 1))
  echo "  P50 延迟: ${sorted_times[$p50_idx]}ms"
  echo "  P95 延迟: ${sorted_times[$p95_idx]}ms"
fi

if [ ${#SINA_ERRORS[@]} -gt 0 ]; then
  echo "  错误详情(${#SINA_ERRORS[@]}):"
  for err in "${SINA_ERRORS[@]}"; do
    echo "    - $err"
  done
fi

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   压力测试完成                                ${NC}"
echo -e "${CYAN}   腾讯 ${TENCENT_OK}/${TENCENT_TOTAL} | 新浪 ${SINA_OK}/${SINA_TOTAL}${NC}"
echo -e "${CYAN}============================================${NC}"
