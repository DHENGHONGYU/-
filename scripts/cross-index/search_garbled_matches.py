import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
docs_dir = BASE_DIR / "docs"

patterns_to_search = [
    'V9-体系化上线测试',
    'b批次高价值孤儿集成状态',
    '发布计划与评估',
    '回滚方案与演练',
    '综合验证与定位分析',
    'databridge改进建议整改',
    'v9核心数据字典与类型',
    'rm剩余任务全量盘点与整改'
]

for pattern in patterns_to_search:
    found = []
    for md_file in docs_dir.rglob('*.md'):
        if pattern in md_file.name:
            rel_path = str(md_file.relative_to(docs_dir)).replace('\\', '/')
            found.append(rel_path)
    print(f'Pattern "{pattern}":')
    if found:
        for f in found:
            print(f'  {f}')
    else:
        print('  NOT FOUND')