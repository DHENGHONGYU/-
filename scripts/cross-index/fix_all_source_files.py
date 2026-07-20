import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/testing-strategy.md',
    'docs/reference/数据治理路线图.md',
    'docs/reference/03-architecture-standards.md',
    'docs/reference/registry-index.md',
    'docs/reference/data-interaction-protocols.md',
    'docs/reports/retrospectives/综合验证与定位分析报告-v2.0.0.md',
    'docs/explanation/design/databridge改进建议整改报告.md',
    'docs/reference/V9数据宪法.md',
    'docs/reference/v9-system-blueprint.md',
    'docs/00-meta/registry-index.md'
]

fixes = {
    'v9核心数据字典与类型定义整合版': 'v9核心数据字典与类型定义（整合版）',
    'b批次高价值孤儿集成状态报告2026-07-08': 'b批次高价值孤儿集成状态报告-2026-07-08',
    'rm剩余任务全量盘点与整改方案2026-07-08': 'rm剩余任务全量盘点与整改方案-2026-07-08',
    'v9-体系化上线测试TODO-LIST': 'v9-体系化上线测试-todo-list',
    'V9-体系化上线测试TODO-LIST': 'V9-体系化上线测试-TODO-LIST',
    '回滚方案与演练r03': '回滚方案与演练-r03',
    'registry-index.md': '../explanation/design/registry-index.md',
    '/RCA-report': '/RCA-report',
    '/file-wandering-report': '/file-wandering-report',
    '/optimization-prompt': '/optimization-prompt',
    '/task-list': '/task-list',
}

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for old, new in fixes.items():
        content = content.replace(old, new)
    
    content = re.sub(r'\?{3,}', '', content)
    
    if content != original:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"No changes needed for {filepath}")

for filepath in files_to_fix:
    fix_file(filepath)

print("\nDone!")