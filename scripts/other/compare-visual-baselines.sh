#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# 视觉回归基线对比脚本
# 用途：对比 Windows 本地基线与 Docker 容器基线，输出差异报告
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

WINDOWS_DIR="${1:-e2e/snapshots.win-2026-07-12}"
DOCKER_DIR="${2:-e2e/visual-regression.spec.ts-snapshots}"
REPORT_DIR="${3:-docs/reports/visual-baseline-diff}"

mkdir -p "$REPORT_DIR"

echo "========================================"
echo "视觉回归基线对比报告"
echo "========================================"
echo "Windows 基线: $WINDOWS_DIR"
echo "Docker 基线:  $DOCKER_DIR"
echo "报告输出:     $REPORT_DIR"
echo ""

# 统计文件数量和总大小
win_count=$(find "$WINDOWS_DIR" -name '*.png' | wc -l)
docker_count=$(find "$DOCKER_DIR" -name '*.png' | wc -l)
win_size=$(du -sh "$WINDOWS_DIR" | awk '{print $1}')
docker_size=$(du -sh "$DOCKER_DIR" | awk '{print $1}')

echo "## 基线统计"
echo ""
echo "| 维度 | Windows 基线 | Docker 基线 |"
echo "|------|-------------|------------|"
echo "| 文件数 | $win_count | $docker_count |"
echo "| 总大小 | $win_size | $docker_size |"
echo ""

# 逐文件对比（尺寸、文件大小）
echo "## 逐文件对比"
echo ""
echo "| 文件名 | Windows 尺寸 | Docker 尺寸 | Windows 大小 | Docker 大小 | 差异 |"
echo "|--------|-------------|------------|-------------|------------|------|"

for docker_file in "$DOCKER_DIR"/*.png; do
    filename=$(basename "$docker_file")
    win_file="$WINDOWS_DIR/$filename"

    if [ ! -f "$win_file" ]; then
        echo "| $filename | N/A | $(file "$docker_file" | grep -oP '\d+ x \d+' || echo 'unknown') | N/A | $(stat -c%s "$docker_file" | numfmt --to=iec) | 🆕 新增 |"
        continue
    fi

    win_dim=$(file "$win_file" | grep -oP '\d+ x \d+' || echo 'unknown')
    docker_dim=$(file "$docker_file" | grep -oP '\d+ x \d+' || echo 'unknown')
    win_bytes=$(stat -c%s "$win_file")
    docker_bytes=$(stat -c%s "$docker_file")
    win_size_human=$(numfmt --to=iec "$win_bytes" 2>/dev/null || echo "$win_bytes")
    docker_size_human=$(numfmt --to=iec "$docker_bytes" 2>/dev/null || echo "$docker_bytes")

    if [ "$win_dim" != "$docker_dim" ]; then
        diff_marker="📐 尺寸不同"
    elif [ "$win_bytes" != "$docker_bytes" ]; then
        diff_marker="🎨 渲染差异"
    else
        diff_marker="✅ 一致"
    fi

    echo "| $filename | $win_dim | $docker_dim | $win_size_human | $docker_size_human | $diff_marker |"
done

echo ""
echo "## 说明"
echo ""
echo "- 📐 尺寸不同：截图宽高有差异，通常由页面内容高度变化引起"
echo "- 🎨 渲染差异：尺寸相同但像素内容不同，由字体/渲染引擎差异引起"
echo "- ✅ 一致：Windows 和 Docker 生成的基线完全一致（理想状态）"
echo "- 🆕 新增：Docker 基线中有但 Windows 基线中没有的文件"
echo ""
echo "报告生成时间: $(date -Iseconds)"
