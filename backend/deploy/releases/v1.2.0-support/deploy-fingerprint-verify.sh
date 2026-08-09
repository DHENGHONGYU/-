#!/usr/bin/env bash
# ===========================================================================
# V9 Embedding 指纹验证 — Helm Chart 自动化部署 & 合规判断脚本
# ===========================================================================
# 功能:
#   1. 检查前提条件 (helm, kubectl)
#   2. 创建 Namespace (如不存在)
#   3. Helm upgrade --install 部署 Chart
#   4. 等待 Job 完成 (Complete / Failed)
#   5. 提取结果 JSON 进行合规性判断
#   6. 输出结构化报告 + 返回退出码
#
# 用法:
#   ./deploy-fingerprint-verify.sh                              # 默认参数
#   ./deploy-fingerprint-verify.sh --baseline 1f1f307f2eab7e11  # 指定基线
#   ./deploy-fingerprint-verify.sh --namespace prod --service emb-svc
#   ./deploy-fingerprint-verify.sh --mode CronJob               # CronJob 巡检模式
#   ./deploy-fingerprint-verify.sh --dry-run                    # 仅渲染不部署
#   ./deploy-fingerprint-verify.sh --cleanup                    # 部署后清理
#
# 退出码:
#   0 = 全部 Check 通过, 数据一致性已验证
#   1 = 任一硬性 Check 失败 (Check 1/2/3), 指纹漂移
#   2 = 服务不可达 / 预检失败
#   3 = 前提条件不满足 (helm/kubectl 缺失)
#   4 = Job 超时未完成
#   5 = Helm 部署失败
# ===========================================================================

set -euo pipefail

# ---- 默认参数 ----
BASELINE_SHA="${V9_BASELINE_SHA:-1f1f307f2eab7e11}"
NAMESPACE="${V9_NAMESPACE:-v9-embedding}"
SERVICE_NAME="${V9_SERVICE_NAME:-v9-embedding}"
SERVICE_PORT="${V9_SERVICE_PORT:-8001}"
CHART_PATH="${V9_CHART_PATH:-$(cd "$(dirname "$0")" && pwd)/helm/fingerprint-verify}"
RELEASE_NAME="${V9_RELEASE_NAME:-fp-verify}"
MODE="${V9_JOB_MODE:-Job}"
TIMEOUT="${V9_JOB_TIMEOUT:-5m}"
DRY_RUN=false
CLEANUP=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULT_DIR="${V9_RESULT_DIR:-/tmp/fingerprint-results}"

# ---- 颜色 ----
RED='\033[0;31m'
GRE='\033[0;32m'
YLW='\033[0;33m'
BLU='\033[0;34m'
NC='\033[0m'

p_ok()   { echo -e "${GRE}[PASS]${NC} $*"; }
p_fail() { echo -e "${RED}[FAIL]${NC} $*"; }
p_warn() { echo -e "${YLW}[WARN]${NC} $*"; }
p_info() { echo -e "${BLU}[INFO]${NC} $*"; }

# ---- 参数解析 ----
while [[ $# -gt 0 ]]; do
    case "$1" in
        --baseline)   BASELINE_SHA="$2"; shift 2 ;;
        --namespace)  NAMESPACE="$2"; shift 2 ;;
        --service)    SERVICE_NAME="$2"; shift 2 ;;
        --port)       SERVICE_PORT="$2"; shift 2 ;;
        --chart)      CHART_PATH="$2"; shift 2 ;;
        --release)    RELEASE_NAME="$2"; shift 2 ;;
        --mode)       MODE="$2"; shift 2 ;;
        --timeout)    TIMEOUT="$2"; shift 2 ;;
        --dry-run)    DRY_RUN=true; shift ;;
        --cleanup)    CLEANUP=true; shift ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --baseline SHA    基线指纹 (16 hex, 默认: 1f1f307f2eab7e11)"
            echo "  --namespace NS    K8s Namespace (默认: v9-embedding)"
            echo "  --service NAME    Embedding Service 名 (默认: v9-embedding)"
            echo "  --port PORT       Service 端口 (默认: 8001)"
            echo "  --chart PATH      Helm Chart 路径 (默认: ./helm/fingerprint-verify)"
            echo "  --release NAME    Helm Release 名 (默认: fp-verify)"
            echo "  --mode MODE       Job | CronJob (默认: Job)"
            echo "  --timeout DUR     等待超时 (默认: 5m)"
            echo "  --dry-run         仅渲染模板不部署"
            echo "  --cleanup         部署验证后卸载 Release"
            exit 0 ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
done

# ===========================================================================
# Step 1: 前提条件检查
# ===========================================================================
p_info "=== Step 1: 前提条件检查 ==="

check_tool() {
    if command -v "$1" &>/dev/null; then
        local ver
        ver=$("$1" version --client 2>/dev/null | head -1 || echo "unknown")
        p_ok "$1: $ver"
        return 0
    else
        p_fail "$1 未安装"
        return 1
    fi
}

check_tool helm || exit 3
check_tool kubectl || exit 3

# 检查集群连通性
if ! kubectl cluster-info &>/dev/null; then
    p_fail "Kubernetes 集群不可达"
    exit 3
fi
p_ok "Kubernetes 集群连通"

# 检查 Chart 路径
if [[ ! -f "$CHART_PATH/Chart.yaml" ]]; then
    p_fail "Helm Chart 不存在: $CHART_PATH/Chart.yaml"
    p_info "提示: 使用 --chart 指定 Chart 路径"
    exit 3
fi
p_ok "Chart 路径: $CHART_PATH"

# 检查脚本文件是否在 Chart files/ 目录
if [[ ! -f "$CHART_PATH/files/verify-embedding-fingerprint.py" ]]; then
    p_warn "Chart files/ 缺少 verify-embedding-fingerprint.py, 尝试从上级目录复制..."
    SCRIPT_SRC="$SCRIPT_DIR/verify-embedding-fingerprint.py"
    if [[ -f "$SCRIPT_SRC" ]]; then
        cp "$SCRIPT_SRC" "$CHART_PATH/files/verify-embedding-fingerprint.py"
        p_ok "已复制脚本到 Chart files/"
    else
        p_fail "找不到 verify-embedding-fingerprint.py"
        exit 3
    fi
fi

echo ""
p_info "部署参数:"
echo "  Baseline SHA : $BASELINE_SHA"
echo "  Namespace    : $NAMESPACE"
echo "  Service      : $SERVICE_NAME:$SERVICE_PORT"
echo "  Mode         : $MODE"
echo "  Timeout      : $TIMEOUT"
echo "  Dry Run      : $DRY_RUN"
echo ""

# ===========================================================================
# Step 2: Helm Lint
# ===========================================================================
p_info "=== Step 2: Helm Lint ==="
if helm lint "$CHART_PATH"; then
    p_ok "Lint 通过"
else
    p_fail "Lint 失败"
    exit 5
fi
echo ""

# ===========================================================================
# Step 3: Dry Run / Template 渲染
# ===========================================================================
if [[ "$DRY_RUN" == true ]]; then
    p_info "=== Dry Run: 仅渲染模板 ==="
    helm template "$RELEASE_NAME" "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --set baseline.sha="$BASELINE_SHA" \
        --set service.name="$SERVICE_NAME" \
        --set service.namespace="$NAMESPACE" \
        --set service.port="$SERVICE_PORT" \
        --set job.mode="$MODE"
    p_ok "Dry Run 完成 (未部署)"
    exit 0
fi

# ===========================================================================
# Step 4: 创建 Namespace
# ===========================================================================
p_info "=== Step 3: 创建 Namespace ==="
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    p_ok "Namespace 已存在: $NAMESPACE"
else
    kubectl create namespace "$NAMESPACE"
    p_ok "已创建 Namespace: $NAMESPACE"
fi
echo ""

# ===========================================================================
# Step 5: Helm Upgrade --install
# ===========================================================================
p_info "=== Step 4: Helm Upgrade --install ==="

HELM_ARGS=(
    --namespace "$NAMESPACE"
    --create-namespace
    --set baseline.sha="$BASELINE_SHA"
    --set service.name="$SERVICE_NAME"
    --set service.namespace="$NAMESPACE"
    --set service.port="$SERVICE_PORT"
    --set job.mode="$MODE"
)

if helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" "${HELM_ARGS[@]}"; then
    p_ok "Helm 部署成功"
else
    p_fail "Helm 部署失败"
    helm rollback "$RELEASE_NAME" --namespace "$NAMESPACE" 2>/dev/null || true
    exit 5
fi
echo ""

# ===========================================================================
# Step 6: 等待 Job 完成
# ===========================================================================
p_info "=== Step 5: 等待 Job 完成 (超时: $TIMEOUT) ==="

# 确定资源名 (Helm fullname + -job 后缀)
if [[ "$MODE" == "CronJob" ]]; then
    JOB_PREFIX="${RELEASE_NAME}-v9-fingerprint-verify"
    # CronJob 模式: 手动触发一次
    p_info "CronJob 模式: 手动触发 Job..."
    kubectl -n "$NAMESPACE" create job "${JOB_PREFIX}-manual" \
        --from="cronjob/${JOB_PREFIX}-cron" 2>/dev/null || true
    JOB_NAME="${JOB_PREFIX}-manual"
    # 等待 Job 出现
    sleep 2
else
    JOB_NAME="${RELEASE_NAME}-v9-fingerprint-verify-job"
fi

p_info "等待 Job: $JOB_NAME"

# 等待 Job Complete 或 Failed
WAIT_START=$(date +%s)
JOB_STATUS=""

while true; do
    # 检查 Job 是否存在
    if ! kubectl -n "$NAMESPACE" get job "$JOB_NAME" &>/dev/null; then
        sleep 2
        continue
    fi

    # 检查 Complete
    COMPLETE=$(kubectl -n "$NAMESPACE" get job "$JOB_NAME" \
        -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || echo "")
    FAILED=$(kubectl -n "$NAMESPACE" get job "$JOB_NAME" \
        -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null || echo "")

    if [[ "$COMPLETE" == "True" ]]; then
        JOB_STATUS="Complete"
        p_ok "Job 完成 (Complete)"
        break
    elif [[ "$FAILED" == "True" ]]; then
        JOB_STATUS="Failed"
        p_fail "Job 失败 (Failed)"
        break
    fi

    # 超时检查
    ELAPSED=$(( $(date +%s) - WAIT_START ))
    TIMEOUT_SEC=$(echo "$TIMEOUT" | sed 's/m$/*60/;s/s$//' | bc)
    if [[ $ELAPSED -ge $TIMEOUT_SEC ]]; then
        p_fail "Job 超时 (${TIMEOUT})"
        JOB_STATUS="Timeout"
        break
    fi

    # 进度提示
    POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l "job-name=$JOB_NAME" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [[ -n "$POD_NAME" ]]; then
        POD_PHASE=$(kubectl -n "$NAMESPACE" get pod "$POD_NAME" \
            -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
        printf "\r  等待中... (%ds) Pod: %s [%s]    " "$ELAPSED" "$POD_NAME" "$POD_PHASE"
    else
        printf "\r  等待中... (%ds)                        " "$ELAPSED"
    fi
    sleep 3
done
echo ""
echo ""

# ===========================================================================
# Step 7: 提取结果 JSON
# ===========================================================================
p_info "=== Step 6: 提取验证结果 ==="

# 创建结果目录
mkdir -p "$RESULT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$RESULT_DIR/fp-verify-$TIMESTAMP.log"
JSON_FILE="$RESULT_DIR/fp-verify-$TIMESTAMP.json"

# 获取 Pod 名
POD_NAME=$(kubectl -n "$NAMESPACE" get pods -l "job-name=$JOB_NAME" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [[ -z "$POD_NAME" ]]; then
    p_fail "无法找到 Job 对应的 Pod"
    exit 4
fi

p_info "Pod: $POD_NAME"

# 获取完整日志
kubectl -n "$NAMESPACE" logs "$POD_NAME" -c verifier > "$LOG_FILE" 2>&1 || true
p_ok "日志已保存: $LOG_FILE"

# 提取 RESULT JSON (从 === RESULT BEGIN === 到 === RESULT END ===)
if grep -q "=== RESULT BEGIN ===" "$LOG_FILE"; then
    sed -n '/=== RESULT BEGIN ===/,/=== RESULT END ===/p' "$LOG_FILE" \
        | sed '1d;$d' > "$JSON_FILE"
    p_ok "结果 JSON 已保存: $JSON_FILE"
else
    p_warn "日志中未找到 RESULT JSON 标记, 尝试从日志解析退出码..."
    # 从日志提取退出码
    EXIT_LINE=$(grep "Exit code" "$LOG_FILE" | tail -1 || echo "")
    if [[ -n "$EXIT_LINE" ]]; then
        EXIT_CODE=$(echo "$EXIT_LINE" | grep -oP 'exit code = \K\d+' || echo "1")
    else
        EXIT_CODE=1
    fi
    # 构造最小 JSON
    cat > "$JSON_FILE" <<EOF
{
    "exit_code": $EXIT_CODE,
    "job_status": "$JOB_STATUS",
    "pod_name": "$POD_NAME",
    "log_file": "$LOG_FILE",
    "_warning": "RESULT JSON 标记未找到, 退出码从日志解析"
}
EOF
    p_warn "已构造最小 JSON (退出码: $EXIT_CODE)"
fi

echo ""

# ===========================================================================
# Step 8: 合规性判断
# ===========================================================================
p_info "=== Step 7: 合规性判断 ==="

# 读取 JSON 并判断
if command -v python3 &>/dev/null; then
    COMPLIANCE_RESULT=$(python3 -c "
import json, sys
with open('$JSON_FILE') as f:
    try:
        data = json.load(f)
    except json.JSONDecodeError:
        print('PARSE_ERROR')
        sys.exit(0)

exit_code = data.get('exit_code', -1)
checks = data.get('checks', [])

print(f'exit_code={exit_code}')
print(f'job_status={data.get(\"job_status\", \"N/A\")}')
print(f'duration_ms={data.get(\"duration_ms\", \"N/A\")}')
print(f'host={data.get(\"host\", \"N/A\")}')
print(f'k8s_mode={data.get(\"k8s_mode\", \"N/A\")}')

hard_pass = 0
hard_total = 0
for c in checks:
    name = c.get('name', '?')
    val = c.get('value', '?')
    passed = c.get('pass', False)
    is_hard = 'check4' not in name
    if is_hard:
        hard_total += 1
        if passed:
            hard_pass += 1
    status = 'PASS' if passed else 'FAIL'
    blocking = '(阻塞)' if is_hard else '(非阻塞)'
    print(f'  {name}: {val} [{status}] {blocking}')

print(f'hard_checks={hard_pass}/{hard_total}')
if exit_code == 0:
    print('VERDICT=PASS')
elif exit_code == 2:
    print('VERDICT=UNREACHABLE')
else:
    print('VERDICT=FAIL')
" 2>&1)
    echo "$COMPLIANCE_RESULT"

    # 提取判定
    VERDICT=$(echo "$COMPLIANCE_RESULT" | grep "VERDICT=" | cut -d= -f2)
    EXIT_CODE=$(echo "$COMPLIANCE_RESULT" | grep "exit_code=" | head -1 | cut -d= -f2)
else
    # 无 Python 时用 jq 或简单 grep
    if command -v jq &>/dev/null; then
        EXIT_CODE=$(jq -r '.exit_code // 1' "$JSON_FILE")
        jq '.' "$JSON_FILE"
    else
        EXIT_CODE=$(grep -o '"exit_code":\s*[0-9]*' "$JSON_FILE" | grep -o '[0-9]*' || echo "1")
        cat "$JSON_FILE"
    fi

    if [[ "$EXIT_CODE" == "0" ]]; then
        VERDICT="PASS"
    elif [[ "$EXIT_CODE" == "2" ]]; then
        VERDICT="UNREACHABLE"
    else
        VERDICT="FAIL"
    fi
fi

echo ""

# ===========================================================================
# Step 9: 最终报告
# ===========================================================================
echo "=========================================="
echo "  V9 指纹验证报告"
echo "=========================================="
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Namespace: $NAMESPACE"
echo "  Service: $SERVICE_NAME:$SERVICE_PORT"
echo "  Baseline: $BASELINE_SHA"
echo "  Job: $JOB_NAME ($JOB_STATUS)"
echo "  Pod: $POD_NAME"
echo "  日志: $LOG_FILE"
echo "  JSON: $JSON_FILE"
echo "------------------------------------------"

case "$VERDICT" in
    PASS)
        echo -e "  ${GRE}结论: ✅ 全部 Check 通过, 数据一致性已验证${NC}"
        echo "  允许: 关闭 RCA 工单 / 合并 PR / 完成发布"
        FINAL_EXIT=0
        ;;
    FAIL)
        echo -e "  ${RED}结论: ❌ 指纹漂移或元数据不匹配${NC}"
        echo "  动作: 按 OPS-CHEATSHEET-FINGERPRINT.md FAQ-P1 排查"
        echo "  禁止: 发布 / 合并 PR / 关闭工单"
        FINAL_EXIT=1
        ;;
    UNREACHABLE)
        echo -e "  ${YLW}结论: ⚠️ 服务不可达${NC}"
        echo "  动作: 检查 Embedding Service 是否正常运行"
        echo "  kubectl -n $NAMESPACE get svc $SERVICE_NAME"
        echo "  kubectl -n $NAMESPACE get pods -l app=$SERVICE_NAME"
        FINAL_EXIT=2
        ;;
    *)
        echo -e "  ${RED}结论: ❓ 未知状态 ($VERDICT)${NC}"
        echo "  动作: 手动检查日志 $LOG_FILE"
        FINAL_EXIT=1
        ;;
esac
echo "=========================================="
echo ""

# ===========================================================================
# Step 10: 清理 (可选)
# ===========================================================================
if [[ "$CLEANUP" == true ]]; then
    p_info "=== 清理 Helm Release ==="
    helm uninstall "$RELEASE_NAME" --namespace "$NAMESPACE"
    p_ok "已卸载 Release: $RELEASE_NAME"
    p_info "结果文件保留在: $RESULT_DIR"
fi

exit "$FINAL_EXIT"
