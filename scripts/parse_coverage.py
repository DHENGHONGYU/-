import json
from pathlib import Path

coverage_file = Path('coverage/coverage-final.json')
if not coverage_file.exists():
    print("覆盖率文件不存在")
    exit(1)

with open(coverage_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 按目录聚合
layers = {
    'src/core/': {'statements': [], 'branches': [], 'functions': [], 'lines': []},
    'src/data/': {'statements': [], 'branches': [], 'functions': [], 'lines': []},
    'src/lib/': {'statements': [], 'branches': [], 'functions': [], 'lines': []},
    'src/services/': {'statements': [], 'branches': [], 'functions': [], 'lines': []},
}

for file_path, metrics in data.items():
    # 使用正斜杠统一路径
    fp = file_path.replace('\\', '/')
    for prefix in layers:
        if prefix in fp and '/__tests__/' not in fp:
            s = metrics.get('statementMap', {})
            statements_total = len(s)
            statements_covered = sum(1 for v in metrics.get('s', {}).values() if v > 0)
            
            b = metrics.get('branchMap', {})
            branches_total = sum(len(v.get('locations', [])) for v in b.values())
            branches_covered = sum(sum(1 for c in bv if c > 0) for bv in metrics.get('b', {}).values())
            
            fn = metrics.get('fnMap', {})
            functions_total = len(fn)
            functions_covered = sum(1 for v in metrics.get('f', {}).values() if v > 0)
            
            lines_map = {}
            for stmt_id, loc in s.items():
                line = loc.get('start', {}).get('line', 0)
                if line not in lines_map:
                    lines_map[line] = False
                if metrics.get('s', {}).get(str(stmt_id), 0) > 0:
                    lines_map[line] = True
            lines_total = len(lines_map)
            lines_covered = sum(1 for v in lines_map.values() if v)
            
            layers[prefix]['statements'].append((statements_covered, statements_total))
            layers[prefix]['branches'].append((branches_covered, branches_total))
            layers[prefix]['functions'].append((functions_covered, functions_total))
            layers[prefix]['lines'].append((lines_covered, lines_total))
            break

print("=" * 70)
print("当前各层级实际覆盖率（基于 coverage-final.json）")
print("=" * 70)
print(f"{'层级':<20} {'Statements':>12} {'Branches':>12} {'Functions':>12} {'Lines':>12}")
print("-" * 70)

for prefix, stats in layers.items():
    total_s = sum(t for _, t in stats['statements']) or 1
    covered_s = sum(c for c, _ in stats['statements'])
    
    total_b = sum(t for _, t in stats['branches']) or 1
    covered_b = sum(c for c, _ in stats['branches'])
    
    total_f = sum(t for _, t in stats['functions']) or 1
    covered_f = sum(c for c, _ in stats['functions'])
    
    total_l = sum(t for _, t in stats['lines']) or 1
    covered_l = sum(c for c, _ in stats['lines'])
    
    print(f"{prefix:<20} {covered_s/total_s*100:>10.1f}% {covered_b/total_b*100:>10.1f}% {covered_f/total_f*100:>10.1f}% {covered_l/total_l*100:>10.1f}%")

print("\n" + "=" * 70)
print("建议的渐进式阈值（向下取整到5的倍数，确保不破坏构建）")
print("=" * 70)
for prefix, stats in layers.items():
    total_s = sum(t for _, t in stats['statements']) or 1
    covered_s = sum(c for c, _ in stats['statements'])
    pct_s = int(covered_s/total_s*100 // 5 * 5)
    
    total_b = sum(t for _, t in stats['branches']) or 1
    covered_b = sum(c for c, _ in stats['branches'])
    pct_b = int(covered_b/total_b*100 // 5 * 5)
    
    total_f = sum(t for _, t in stats['functions']) or 1
    covered_f = sum(c for c, _ in stats['functions'])
    pct_f = int(covered_f/total_f*100 // 5 * 5)
    
    total_l = sum(t for _, t in stats['lines']) or 1
    covered_l = sum(c for c, _ in stats['lines'])
    pct_l = int(covered_l/total_l*100 // 5 * 5)
    
    print(f"'{prefix}': {{ statements: {pct_s}, branches: {pct_b}, functions: {pct_f}, lines: {pct_l} }}")
