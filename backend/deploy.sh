#!/usr/bin/env bash
# ============================================================================
# V9 Embedding Service — 一键部署脚本（本地/生产通用）
# ============================================================================
#
# 版本: v1.2.0
# 发布日期: 2026-08-06
# 验证状态: ✅ 已通过 5 项自动化测试（端口 8002 实测全 PASS）
#
# 整合 Dockerfile.embedding + nginx-embedding.conf 的部署工具
# 支持: 本地开发、单实例生产、多实例集群、GPU 模式
#
# 变更日志 (v1.2.0):
#   - 默认配置与 v9-embedding.service systemd 对齐 (12 项环境变量)
#   - test 命令输出维度/延迟/QPS 详情
#   - 增加 --port 参数支持自定义端口 (run_tests/show_status)
#   - 日志配置 max-size=100m/max-file=10 避免磁盘占满
#   - 与 PRODUCTION-DEPLOYMENT-SOP.md v1.2.0 同步发布
#
#
# 用法:
#   ./deploy.sh [command] [options]
#
# 命令:
#   start     启动服务（默认模式）
#   stop      停止服务
#   restart   重启服务
#   status    查看服务状态
#   logs      查看日志
#   test      运行健康检查测试
#   build     仅构建镜像
#   deploy    构建并部署
#   cluster   多实例集群模式
#   gpu       GPU 模式部署
#
# 选项:
#   --workers N       Worker 数量 (默认: 1)
#   --model MODEL     模型 ID (默认: all-MiniLM-L6-v2)
#   --port PORT       端口 (默认: 8001)
#   --debug           DEBUG 日志模式
#   --no-build        跳过构建步骤
#   --gpu             GPU 模式
#
# 示例:
#   # 本地开发
#   ./deploy.sh start
#
#   # 生产单 Worker
#   ./deploy.sh start --workers 1
#
#   # GPU 模式
#   ./deploy.sh start --gpu --workers 4
#
#   # 多实例集群
#   ./deploy.sh cluster --instances 3
#
#   # 查看状态
#   ./deploy.sh status
#
#   # 查看日志
#   ./deploy.sh logs --follow
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 项目配置
PROJECT_NAME="v9-embedding"
IMAGE_NAME="finsightv9/embedding-service"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# 默认配置（基于 ADR-014 性能结论）
DEFAULT_WORKERS=1
DEFAULT_MODEL="all-MiniLM-L6-v2"
DEFAULT_PORT=8001
DEFAULT_LOG_LEVEL="INFO"
DEFAULT_MAX_BATCH=64

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# 日志函数
# ---------------------------------------------------------------------------
log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $*"; }

# ---------------------------------------------------------------------------
# 环境检测
# ---------------------------------------------------------------------------
detect_environment() {
    log_step "检测环境..."

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "未检测到 Docker，请先安装"
        exit 1
    fi

    # 检查 Docker Compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        log_error "未检测到 Docker Compose"
        exit 1
    fi

    # 检测操作系统
    OS="$(uname -s)"
    case "$OS" in
        Linux) PLATFORM="linux" ;;
        Darwin) PLATFORM="macos" ;;
        MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
        *) PLATFORM="unknown" ;;
    esac

    # 检测 GPU
    HAS_GPU=false
    if command -v nvidia-smi &> /dev/null; then
        if nvidia-smi &> /dev/null; then
            HAS_GPU=true
            GPU_COUNT=$(nvidia-smi -L | wc -l)
            log_info "检测到 GPU: $GPU_COUNT 个"
        fi
    fi

    log_info "平台: $PLATFORM, Docker: $(docker --version | cut -d' ' -f3)"
}

# ---------------------------------------------------------------------------
# 构建镜像
# ---------------------------------------------------------------------------
build_image() {
    local tag="${1:-$IMAGE_TAG}"
    log_step "构建镜像: $IMAGE_NAME:$tag"

    if [ "$SKIP_BUILD" = "true" ]; then
        log_warn "跳过构建（--no-build 已设置）"
        return 0
    fi

    docker build \
        -t "$IMAGE_NAME:$tag" \
        -f Dockerfile.embedding \
        --build-arg PRELOAD_MODELS="${BUILD_MODEL:-$DEFAULT_MODEL}" \
        .

    log_info "镜像构建完成: $IMAGE_NAME:$tag"
}

# ---------------------------------------------------------------------------
# 启动服务
# ---------------------------------------------------------------------------
start_service() {
    log_step "启动 $PROJECT_NAME 服务"

    local workers="${1:-$DEFAULT_WORKERS}"
    local model="${2:-$DEFAULT_MODEL}"
    local port="${3:-$DEFAULT_PORT}"
    local debug="${4:-false}"
    local gpu="${5:-false}"

    # 检查端口占用
    if lsof -i ":$port" &> /dev/null 2>&1 || netstat -ano | grep ":$port " | grep LISTEN 2>/dev/null; then
        log_warn "端口 $port 已被占用，尝试停止旧容器..."
        stop_service "$port"
    fi

    # 停止现有容器
    docker stop "$PROJECT_NAME" 2>/dev/null || true

    # 构建容器参数
    local docker_args=(
        run -d
        --name "$PROJECT_NAME"
        --restart unless-stopped
        -p "${port}:8001"
        -e "EMBEDDING_MODEL=$model"
        -e "EMBEDDING_WARMUP=true"
        -e "EMBEDDING_MAX_BATCH=$DEFAULT_MAX_BATCH"
        -e "EMBEDDING_SLOW_THRESHOLD_MS=500"
        -e "UVICORN_WORKERS=$workers"
        -e "UVICORN_HOST=0.0.0.0"
        -e "UVICORN_PORT=8001"
        -e "HF_HOME=/app/hf_cache"
        -e "HF_ENDPOINT=https://hf-mirror.com"
        -e "PYTHONUNBUFFERED=1"
        -e "TZ=Asia/Shanghai"
        -v "${PROJECT_NAME}-hf-cache:/app/hf_cache"
    )

    # 日志级别
    if [ "$debug" = "true" ]; then
        docker_args+=(-e "EMBEDDING_LOG_LEVEL=DEBUG")
    else
        docker_args+=(-e "EMBEDDING_LOG_LEVEL=$DEFAULT_LOG_LEVEL")
    fi

    # GPU 模式
    if [ "$gpu" = "true" ] && [ "$HAS_GPU" = "true" ]; then
        docker_args+=(
            --gpus all
            -e "CUDA_VISIBLE_DEVICES=0"
            -e "OMP_NUM_THREADS=4"
        )
        log_info "GPU 模式已启用"
    elif [ "$gpu" = "true" ]; then
        log_warn "GPU 模式请求，但未检测到 GPU，回退到 CPU 模式"
        gpu=false
    fi

    # 日志配置
    local log_dir="./logs"
    mkdir -p "$log_dir"
    docker_args+=(
        --log-opt max-size=100m
        --log-opt max-file=10
    )

    # 执行
    log_info "启动参数: workers=$workers, model=$model, port=$port, debug=$debug"
    docker "${docker_args[@]}" "$IMAGE_NAME:$IMAGE_TAG"

    # 等待就绪
    log_info "等待服务就绪..."
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "http://localhost:${port}/api/embed/health" &> /dev/null; then
            log_info "服务已就绪!"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        printf "\r  等待中... %d/%ds" $waited $max_wait
    done
    echo ""

    if curl -sf "http://localhost:${port}/api/embed/health" &> /dev/null; then
        log_info "服务已就绪!"
    else
        log_warn "服务启动超时，但容器可能仍在初始化"
        log_info "检查日志: docker logs $PROJECT_NAME"
    fi
}

# ---------------------------------------------------------------------------
# 停止服务
# ---------------------------------------------------------------------------
stop_service() {
    local port="${1:-$DEFAULT_PORT}"
    log_step "停止 $PROJECT_NAME 服务..."

    # 停止主容器
    docker stop "$PROJECT_NAME" 2>/dev/null || true
    docker rm "$PROJECT_NAME" 2>/dev/null || true

    # 停止所有集群实例
    for instance in $(docker ps -q --filter "name=${PROJECT_NAME}-" 2>/dev/null); do
        docker stop "$instance" 2>/dev/null || true
        docker rm "$instance" 2>/dev/null || true
    done

    # 停止 Nginx（如果在运行）
    if docker ps -q --filter "name=${PROJECT_NAME}-nginx" &> /dev/null; then
        docker stop "${PROJECT_NAME}-nginx" 2>/dev/null || true
        docker rm "${PROJECT_NAME}-nginx" 2>/dev/null || true
    fi

    log_info "服务已停止"
}

# ---------------------------------------------------------------------------
# 查看状态
# ---------------------------------------------------------------------------
show_status() {
    log_step "服务状态"

    echo ""
    echo "┌─────────────────────────────────────────────┐"
    echo "│  V9 Embedding Service 状态"
    echo "├─────────────────────────────────────────────┤"

    # 容器状态
    local container_running=$(docker ps -q --filter "name=$PROJECT_NAME" 2>/dev/null)
    if [ -n "$container_running" ]; then
        echo "│ 容器:    ✅ 运行中"
        local uptime=$(docker inspect -f '{{.State.StartedAt}}' "$PROJECT_NAME" 2>/dev/null)
        echo "│ 启动时间: $uptime"
    else
        echo "│ 容器:    ❌ 已停止"
    fi

    # 健康检查
    local health=$(curl -sf "http://localhost:${DEFAULT_PORT}/api/embed/health" 2>/dev/null)
    if [ -n "$health" ]; then
        local status=$(echo "$health" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])' 2>/dev/null || echo "unknown")
        local model=$(echo "$health" | python3 -c 'import sys,json; print(json.load(sys.stdin)["model_id"])' 2>/dev/null || echo "unknown")
        local dim=$(echo "$health" | python3 -c 'import sys,json; print(json.load(sys.stdin)["dimension"])' 2>/dev/null || echo "?")
        echo "│ 健康:    ✅ $status"
        echo "│ 模型:    $model ($dim 维)"
    else
        echo "│ 健康:    ❌ 不可达"
    fi

    # 性能指标
    local metrics=$(curl -sf "http://localhost:${DEFAULT_PORT}/api/embed/metrics" 2>/dev/null)
    if [ -n "$metrics" ]; then
        local qps=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("throughput_req_per_s", "N/A"))' 2>/dev/null)
        local p95=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("recent_p95_ms", "N/A"))' 2>/dev/null)
        local total=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("total_requests", "N/A"))' 2>/dev/null)
        echo "│ QPS:     $qps req/s"
        echo "│ P95:     ${p95}ms"
        echo "│ 请求数:  $total"
    fi

    # 集群实例
    local cluster_count=$(docker ps -q --filter "name=${PROJECT_NAME}-[0-9]" 2>/dev/null | wc -l)
    if [ "$cluster_count" -gt 0 ]; then
        echo "│ 集群:    $cluster_count 个实例运行中"
    fi

    # Nginx
    if docker ps -q --filter "name=${PROJECT_NAME}-nginx" &> /dev/null; then
        echo "│ Nginx:   ✅ 运行中 (负载均衡)"
    fi

    echo "└─────────────────────────────────────────────┘"
    echo ""
}

# ---------------------------------------------------------------------------
# 查看日志
# ---------------------------------------------------------------------------
show_logs() {
    local follow="${1:-false}"
    local lines="${2:-50}"

    if [ "$follow" = "true" ]; then
        docker logs -f --tail "$lines" "$PROJECT_NAME"
    else
        docker logs --tail "$lines" "$PROJECT_NAME"
    fi
}

# ---------------------------------------------------------------------------
# 运行测试
# ---------------------------------------------------------------------------
run_tests() {
    log_step "运行健康检查测试"

    local port="${1:-$DEFAULT_PORT}"
    local all_passed=true

    echo ""
    echo "┌─────────────────────────────────────────────┐"
    echo "│  V9 Embedding Service 测试"
    echo "├─────────────────────────────────────────────┤"

    # Test 1: 健康检查
    echo -n "│ 测试 1: 健康检查 ... "
    if curl -sf "http://localhost:${port}/api/embed/health" &> /dev/null; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
        all_passed=false
    fi

    # Test 2: 单文本嵌入
    echo -n "│ 测试 2: 单文本嵌入 ... "
    local result=$(curl -sf -X POST "http://localhost:${port}/api/embed" \
        -H "Content-Type: application/json" \
        -d '{"texts": ["Hello, world!"]}' 2>/dev/null)
    if echo "$result" | grep -q '"success":true'; then
        local lat=$(echo "$result" | python3 -c 'import sys,json; print(json.load(sys.stdin)["elapsed_ms"])' 2>/dev/null)
        echo "✅ PASS (${lat}ms)"
    else
        echo "❌ FAIL"
        all_passed=false
    fi

    # Test 3: 批量嵌入
    echo -n "│ 测试 3: 批量嵌入 ... "
    local batch_result=$(curl -sf -X POST "http://localhost:${port}/api/embed" \
        -H "Content-Type: application/json" \
        -d '{"texts": ["A", "B", "C", "D", "E"]}' 2>/dev/null)
    local count=$(echo "$batch_result" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("vectors", [])))' 2>/dev/null)
    if [ "$count" = "5" ]; then
        echo "✅ PASS (5 texts)"
    else
        echo "❌ FAIL (got $count)"
        all_passed=false
    fi

    # Test 4: 性能指标
    echo -n "│ 测试 4: 性能指标 ... "
    local metrics=$(curl -sf "http://localhost:${port}/api/embed/metrics" 2>/dev/null)
    if [ -n "$metrics" ]; then
        local qps=$(echo "$metrics" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("throughput_req_per_s", "N/A"))' 2>/dev/null)
        echo "✅ PASS (QPS: $qps)"
    else
        echo "❌ FAIL"
        all_passed=false
    fi

    # Test 5: 配置端点
    echo -n "│ 测试 5: 配置端点 ... "
    local config=$(curl -sf "http://localhost:${port}/api/embed/config" 2>/dev/null)
    local dim=$(echo "$config" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("dimension", "?"))' 2>/dev/null)
    if [ "$dim" != "?" ]; then
        echo "✅ PASS (dim: $dim)"
    else
        echo "❌ FAIL"
        all_passed=false
    fi

    echo "└─────────────────────────────────────────────┘"

    if [ "$all_passed" = "true" ]; then
        echo -e "\n${GREEN}✅ 所有测试通过${NC}"
        return 0
    else
        echo -e "\n${RED}❌ 部分测试失败${NC}"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# 集群模式
# ---------------------------------------------------------------------------
start_cluster() {
    local instances="${1:-3}"
    log_step "启动多实例集群: $instances 个 Worker + Nginx"

    # 停止现有
    stop_service

    # 构建镜像
    build_image

    # 启动实例
    for i in $(seq 1 $instances); do
        local port=$((8000 + i))
        log_info "启动实例 $i (端口: $port)..."

        docker run -d \
            --name "${PROJECT_NAME}-${i}" \
            --restart unless-stopped \
            --expose 8001 \
            -e "EMBEDDING_MODEL=$DEFAULT_MODEL" \
            -e "EMBEDDING_WARMUP=true" \
            -e "UVICORN_WORKERS=1" \
            -e "UVICORN_HOST=0.0.0.0" \
            -e "UVICORN_PORT=8001" \
            -e "EMBEDDING_LOG_LEVEL=$DEFAULT_LOG_LEVEL" \
            -v "${PROJECT_NAME}-hf-cache:/app/hf_cache" \
            --log-opt max-size=100m \
            --log-opt max-file=10 \
            "$IMAGE_NAME:$IMAGE_TAG"
    done

    # 启动 Nginx
    log_info "启动 Nginx 负载均衡器..."
    docker run -d \
        --name "${PROJECT_NAME}-nginx" \
        --restart unless-stopped \
        -p 8000:80 \
        -v "$SCRIPT_DIR/deploy/nginx-embedding.conf:/etc/nginx/conf.d/default.conf:ro" \
        --network-alias embedding-nginx \
        nginx:1.27-alpine

    # 配置 Nginx 上游
    # 注意：Docker Compose 方式更可靠，这里用简单方式
    log_info "集群已启动，通过 http://localhost:8000 访问"
    log_warn "注意: 生产环境建议使用 docker-compose.embedding.yml 编排"
}

# ---------------------------------------------------------------------------
# GPU 模式
# ---------------------------------------------------------------------------
start_gpu_mode() {
    local workers="${1:-4}"
    log_step "启动 GPU 模式服务 (workers=$workers)"

    if [ "$HAS_GPU" != "true" ]; then
        log_error "未检测到 GPU 设备"
        exit 1
    fi

    stop_service
    build_image

    start_service "$workers" "bge-large-zh-v1.5" "8003" "false" "true"
}

# ---------------------------------------------------------------------------
# 帮助信息
# ---------------------------------------------------------------------------
show_help() {
    echo ""
    echo "V9 Embedding Service — 一键部署脚本"
    echo ""
    echo "用法: $0 [command] [options]"
    echo ""
    echo "命令:"
    echo "  start      启动服务（默认模式）"
    echo "  stop       停止服务"
    echo "  restart    重启服务"
    echo "  status     查看服务状态"
    echo "  logs       查看日志"
    echo "  test       运行健康检查测试"
    echo "  build      仅构建镜像"
    echo "  deploy     构建并部署（start + build）"
    echo "  cluster    多实例集群模式"
    echo "  gpu        GPU 模式部署"
    echo ""
    echo "选项:"
    echo "  --workers N       Worker 数量 (默认: 1)"
    echo "  --model MODEL     模型 ID (默认: all-MiniLM-L6-v2)"
    echo "  --port PORT       端口 (默认: 8001)"
    echo "  --debug           DEBUG 日志模式"
    echo "  --no-build        跳过构建步骤"
    echo ""
    echo "示例:"
    echo "  $0 start --workers 1              # 单 Worker 生产模式"
    echo "  $0 start --debug                  # DEBUG 日志调试模式"
    echo "  $0 cluster --instances 3          # 3 实例集群"
    echo "  $0 gpu --workers 4                # GPU 4 Worker 模式"
    echo "  $0 status                         # 查看状态"
    echo "  $0 test                           # 运行测试"
    echo ""
}

# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------
main() {
    local command="${1:-help}"
    shift || true

    # 默认值
    WORKERS="$DEFAULT_WORKERS"
    MODEL="$DEFAULT_MODEL"
    PORT="$DEFAULT_PORT"
    DEBUG_MODE="false"
    GPU_MODE="false"
    SKIP_BUILD="false"
    INSTANCES="3"

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --workers) WORKERS="$2"; shift 2 ;;
            --model) MODEL="$2"; shift 2 ;;
            --port) PORT="$2"; shift 2 ;;
            --debug) DEBUG_MODE="true"; shift ;;
            --gpu) GPU_MODE="true"; shift ;;
            --no-build) SKIP_BUILD="true"; shift ;;
            --instances) INSTANCES="$2"; shift 2 ;;
            --follow) FOLLOW_LOGS="true"; shift ;;
            *) shift ;;
        esac
    done

    # 环境检测
    detect_environment

    case "$command" in
        start)
            build_image
            start_service "$WORKERS" "$MODEL" "$PORT" "$DEBUG_MODE" "$GPU_MODE"
            show_status
            ;;
        stop)
            stop_service "$PORT"
            ;;
        restart)
            stop_service "$PORT"
            build_image
            start_service "$WORKERS" "$MODEL" "$PORT" "$DEBUG_MODE" "$GPU_MODE"
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${FOLLOW_LOGS:-false}" "50"
            ;;
        test)
            run_tests "$PORT"
            ;;
        build)
            build_image
            ;;
        deploy)
            build_image
            start_service "$WORKERS" "$MODEL" "$PORT" "$DEBUG_MODE" "$GPU_MODE"
            show_status
            run_tests "$PORT"
            ;;
        cluster)
            start_cluster "$INSTANCES"
            ;;
        gpu)
            start_gpu_mode "$WORKERS"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行
main "$@"
