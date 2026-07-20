import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

fixes = {
    '评�?r01': '评审-r01',
    'widget�?0': 'widget 40',
    '核�?·': '核查·',
    '蓝�?(ER)': '蓝图(ER)',
    '检�?�?': '检查 /',
    '治�?-': '治理-',
    '实现�?data': '实现 /data',
    '归�?P0': '归类 P0',
    '画�?�?': '画像 /',
    '流�?': '流程',
    '迁移�?V9': '迁移 /V9',
    '比对�?V9': '比对 /V9',
    '体�?�?': '体系 /',
    '资源�?交易': '资源 /交易',
    '输入�?UI': '输入舱UI',
    '基线�?0': '基线 /0',
    '收�?�?': '收敛 /',
    '文�?�?V9': '文档 /V9',
    '最�?HTML': '最佳HTML',
    '分析�?�?': '分析舱 /',
    '分�?+': '分析 +',
    '分�?PPT': '分享 PPT',
    '评审�?0': '评审 /0',
    '分布�?AGENT': '分布 /AGENT',
    '驾驶�?Widget': '驾驶舱Widget',
}

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for old, new in fixes.items():
        content = content.replace(old, new)
    
    content = content.replace('�?RCA', '/RCA')
    content = content.replace('�?file-wandering', '/file-wandering')
    content = content.replace('�?optimization', '/optimization')
    content = content.replace('�?task-list', '/task-list')
    
    if content != original:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"No changes needed for {filepath}")

for filepath in files_to_fix:
    fix_file(filepath)

print("\nDone!")