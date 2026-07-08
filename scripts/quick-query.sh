#!/usr/bin/env bash
# 快速查询模板 — 基于 docs/reports/code-graph.json 的常用查询
# 参照 AGENTS.md §12.6 知识图谱优先
# 用法: ./scripts/quick-query.sh <query-name> [args]

set -euo pipefail
GRAPH_FILE="docs/reports/code-graph.json"

if [ ! -f "$GRAPH_FILE" ]; then
  echo "❌ $GRAPH_FILE 不存在，请先运行 npm run graph:extract 生成" >&2
  exit 1
fi

QUERY="${1:-help}"
shift || true

case "$QUERY" in
  query-store-deps|store-deps)
    # query-store-deps: 查询 Store 依赖关系
    echo "📦 Store 依赖查询"
    node -e "const g=require('./$GRAPH_FILE'); const stores=Object.entries(g.modules||{}).filter(([k])=>k.includes('Store')); stores.forEach(([k,v])=>console.log(k, '→', (v.imports||[]).filter(i=>i.includes('Store')).join(', ')))"
    ;;
  query-cross-layer-violations|layer-violations)
    # query-cross-layer-violations: 查询跨层违规
    echo "🔍 跨层调用查询"
    npm run audit:layers 2>&1 | grep -E "违规|警告" | head -10
    ;;
  query-largest-files|largest-files)
    # query-largest-files: 查询最大文件
    echo "📊 最大文件 Top 10"
    find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -rn | head -11
    ;;
  query-top-imported|top-imported)
    # query-top-imported: 查询被引用最多的模块
    echo "🔗 Top 10 被引用模块"
    node -e "const g=require('./$GRAPH_FILE'); const cnt={}; Object.values(g.modules||{}).forEach(m=>(m.imports||[]).forEach(i=>{cnt[i]=(cnt[i]||0)+1})); Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log(v, k))"
    ;;
  query-orphan-pages|orphan-pages)
    # 查询未注册页面
    echo "🏠 未注册页面查询"
    npm run audit:routes 2>&1 | grep "❌" | head -10
    ;;
  help|*)
    echo "用法: $0 <query-name>"
    echo ""
    echo "可用查询:"
    echo "  query-store-deps              — Store 依赖关系"
    echo "  query-cross-layer-violations  — 跨层调用违规"
    echo "  query-largest-files           — 最大文件 Top 10"
    echo "  query-top-imported            — 被引用最多的模块 Top 10"
    echo "  query-orphan-pages            — 未注册页面"
    ;;
esac
