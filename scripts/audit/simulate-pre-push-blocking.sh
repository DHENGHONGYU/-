#!/bin/sh
# ============================================================
# pre-push 钩子拦截模拟脚本
#
# 模拟本地推送包含不合规 scope 的提交，验证 pre-push 钩子是否成功拦截。
# 包含两个场景：
#   1. 不合规 scope (fix(p0)) — 预期被拦截
#   2. 合规 scope (fix(FIN-P0)) — 预期通过 scope 校验
#
# 运行方式:
#   sh scripts/audit/simulate-pre-push-blocking.sh
#
# 输出:
#   - 钩子 stdout/stderr 输出
#   - .tmp/logs/pre-push.log 日志内容
#   - 测试结果汇总
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRE_PUSH="${PROJECT_ROOT}/.husky/pre-push"
LOG_FILE="${PROJECT_ROOT}/.tmp/logs/pre-push.log"
ZERO_SHA="0000000000000000000000000000000000000000"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "============================================================"
echo "  pre-push 钩子拦截模拟测试"
echo "============================================================"
echo "  项目路径: ${PROJECT_ROOT}"
echo "  钩子文件: .husky/pre-push"
echo "  日志文件: .tmp/logs/pre-push.log"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# ── 工具函数 ──

# 创建临时 commit 对象（dangling，不影响分支历史）
create_temp_commit() {
  _msg="$1"
  _parent="$2"
  _tree=$(git rev-parse "HEAD^{tree}" 2>/dev/null)
  if [ -z "$_tree" ]; then
    echo "ERROR: 无法获取 HEAD tree" >&2
    return 1
  fi
  _parent_arg=""
  if [ -n "$_parent" ]; then
    _parent_arg="-p $_parent"
  fi
  git commit-tree "$_tree" $_parent_arg -m "$_msg" 2>/dev/null
}

# 模拟 pre-push 钩子执行（只运行 scope 校验段）
run_prepush_scope_check() {
  _local_sha="$1"
  _remote_sha="$2"

  # 构造 pre-push stdin 格式: <local_ref> <local_sha> <remote_ref> <remote_sha>
  _stdin="refs/heads/test-branch ${_local_sha} refs/heads/test-branch ${_remote_sha}"

  # 提取 scope 校验段（避免触发后续 skill-router / test / build）
  _script=$(cat "$PRE_PUSH")
  _scope_start=$(echo "$_script" | grep -n 'SCOPE_VIOLATIONS=0' | head -1 | cut -d: -f1)
  if [ -z "$_scope_start" ]; then
    echo "ERROR: 无法从 pre-push 提取 scope 校验段" >&2
    return 1
  fi

  # 提取从 SCOPE_VIOLATIONS=0 到 "Scope 校验通过" echo 的代码段
  _scope_section=$(echo "$_script" | tail -n +"$_scope_start" | sed '/^echo.*Scope 校验通过/q')

  # 构建独立测试脚本
  _test_script=$(cat <<EOSCRIPT
#!/bin/sh
# ========== 测试环境自举：避免 scope-regex.sh 自带 set -eu 误杀 ==========
# 项目根目录（由外层脚本注入）
PROJECT_ROOT="${PROJECT_ROOT}"
# 暂时禁用 nounset (-u)：scope-regex.sh 自带 set -eu，仿真脚本中未初始化变量（如 $ZERO_SHA 外部）会误炸
set +eu
# 用绝对路径 source：仿真脚本在 .tmp/ 下运行，$(dirname "$0") 不是 .husky/
if [ -f "\${PROJECT_ROOT}/.husky/scope-regex.sh" ]; then
  . "\${PROJECT_ROOT}/.husky/scope-regex.sh" 2>/tmp/scope-source.err || {
    echo "ERROR: source scope-regex.sh 失败" >&2
    cat /tmp/scope-source.err >&2
    exit 2
  }
else
  echo "ERROR: scope-regex.sh 不存在: \${PROJECT_ROOT}/.husky/scope-regex.sh" >&2
  exit 2
fi
# 恢复 errexit (-e)，保持 nounset 关闭防止仿真环境的未初始化变量误杀
set -e
# ========== 日志函数 ==========
PREPUSH_LOG_DIR=".tmp/logs"
PREPUSH_LOG_FILE="\${PREPUSH_LOG_DIR}/pre-push.log"
_prepush_log() { _level="\$1"; _msg="\$2"; _ts=\$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S'); mkdir -p "\$PREPUSH_LOG_DIR" 2>/dev/null || true; printf '[%s] [%s] %s\\n' "\$_ts" "\$_level" "\$_msg" >> "\$PREPUSH_LOG_FILE" 2>/dev/null || true; }
log_info()  { _prepush_log "INFO"  "\$1"; }
log_warn()  { _prepush_log "WARN"  "\$1"; }
log_error() { _prepush_log "ERROR" "\$1"; }
log_info "===== pre-push 钩子启动 ====="
log_info "Git 版本: \$(git --version 2>/dev/null || echo 'unknown')"
log_info "当前分支: \$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
log_info "HEAD SHA: \$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
EOSCRIPT
)
  # 追加 scope 校验段
  _test_script="${_test_script}
${_scope_section}"

  # 写入临时文件并执行
  _tmp_script="${PROJECT_ROOT}/.tmp/sim-prepush-test.sh"
  mkdir -p "${PROJECT_ROOT}/.tmp"
  echo "$_test_script" > "$_tmp_script"

  # 执行并捕获输出
  echo "$_stdin" | sh "$_tmp_script" 2>&1
  _exit_code=$?

  # 清理临时文件
  rm -f "$_tmp_script"

  return $_exit_code
}

# ── 准备测试数据 ──

echo "▶ 准备测试数据..."
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
BAD_SHA=$(create_temp_commit "fix(p0): 模拟不合规 scope 提交")
GOOD_SHA=$(create_temp_commit "fix(FIN-P0): 模拟合规 Jira Key scope")

echo "  HEAD:       ${HEAD_SHA:0:12}"
echo "  BAD_SHA:    ${BAD_SHA:0:12}  (fix(p0): 不合规)"
echo "  GOOD_SHA:   ${GOOD_SHA:0:12}  (fix(FIN-P0): 合规)"
echo ""

# ── 场景 1: 不合规 scope 推送 ──

echo "============================================================"
echo "  场景 1: 模拟推送 fix(p0) — 预期被拦截"
echo "============================================================"
echo ""
echo "  [执行] 模拟 pre-push 钩子 (local=BAD_SHA, remote=ZERO)"
echo "  [输入] fix(p0): 模拟不合规 scope 提交"
echo ""

SCENARIO1_OUTPUT=$(run_prepush_scope_check "$BAD_SHA" "$ZERO_SHA" 2>&1) || SCENARIO1_EXIT=$?
SCENARIO1_EXIT=${SCENARIO1_EXIT:-0}

echo "  [钩子输出]:"
echo "$SCENARIO1_OUTPUT" | while IFS= read -r line; do
  echo "    $line"
done
echo ""
echo "  [退出码]: ${SCENARIO1_EXIT}"

if echo "$SCENARIO1_OUTPUT" | grep -q "Scope 校验失败"; then
  echo "  ${GREEN}✅ 结果: 拦截成功 — pre-push 钩子正确阻止了不合规 scope 的推送${NC}"
  SCENARIO1_PASS=1
else
  echo "  ${RED}❌ 结果: 拦截失败 — pre-push 钩子未能阻止不合规 scope${NC}"
  SCENARIO1_PASS=0
fi
echo ""

# ── 场景 2: 合规 scope 推送 ──

echo "============================================================"
echo "  场景 2: 模拟推送 fix(FIN-P0) — 预期通过 scope 校验"
echo "============================================================"
echo ""
echo "  [执行] 模拟 pre-push 钩子 (local=GOOD_SHA, remote=ZERO)"
echo "  [输入] fix(FIN-P0): 模拟合规 Jira Key scope"
echo ""

SCENARIO2_OUTPUT=$(run_prepush_scope_check "$GOOD_SHA" "$ZERO_SHA" 2>&1) || SCENARIO2_EXIT=$?
SCENARIO2_EXIT=${SCENARIO2_EXIT:-0}

echo "  [钩子输出]:"
echo "$SCENARIO2_OUTPUT" | while IFS= read -r line; do
  echo "    $line"
done
echo ""
echo "  [退出码]: ${SCENARIO2_EXIT}"

if echo "$SCENARIO2_OUTPUT" | grep -q "Scope 校验通过"; then
  echo "  ${GREEN}✅ 结果: 通过成功 — 合规 scope 未被误拦截${NC}"
  SCENARIO2_PASS=1
else
  echo "  ${RED}❌ 结果: 通过失败 — 合规 scope 被误拦截${NC}"
  SCENARIO2_PASS=0
fi
echo ""

# ── 日志输出 ──

echo "============================================================"
echo "  日志文件内容 (.tmp/logs/pre-push.log)"
echo "============================================================"
echo ""

if [ -f "$LOG_FILE" ]; then
  # 显示最近 30 行日志
  echo "  (最近 30 行)"
  echo "  ---"
  tail -30 "$LOG_FILE" | while IFS= read -r line; do
    echo "  $line"
  done
  echo "  ---"
  echo ""
  echo "  ${CYAN}提示: 完整日志可通过 cat .tmp/logs/pre-push.log 查看${NC}"
else
  echo "  ${YELLOW}⚠ 日志文件不存在${NC}"
fi
echo ""

# ── 结果汇总 ──

echo "============================================================"
echo "  测试结果汇总"
echo "============================================================"
echo ""
echo "  场景 1 (不合规 scope 拦截):  $([ $SCENARIO1_PASS -eq 1 ] && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
echo "  场景 2 (合规 scope 通过):    $([ $SCENARIO2_PASS -eq 1 ] && echo "${GREEN}PASS${NC}" || echo "${RED}FAIL${NC}")"
echo ""

TOTAL=2
PASSED=$((SCENARIO1_PASS + SCENARIO2_PASS))
FAILED=$((TOTAL - PASSED))

echo "  总计: ${PASSED}/${TOTAL} 通过"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "  ${GREEN}✅ 全部通过 — pre-push 钩子拦截功能正常${NC}"
else
  echo "  ${RED}❌ 存在失败 — 请检查上方详情${NC}"
fi
echo "============================================================"
echo ""

exit $FAILED
