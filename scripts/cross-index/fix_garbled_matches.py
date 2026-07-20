import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

garbled_mappings = {
    'bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å': 'b批次高价值孤儿集成状态报告-2026-07-08.md',
    'åå¸è®¡åä¸è¯å®': '发布计划与评估-r01.md',
    'åæ»æ¹æ¡ä¸æ¼ç»': '回滚方案与演练-r03.md',
    'ç»¼åéªè¯ä¸å®ä½åææ¥å': '综合验证与定位分析报告-v2.0.0.md',
    'databridgeæ¹è¿å»ºè®®æ´æ¹å®æ½è®¡å': 'databridge改进建议整改实施计划.md',
    'databridgeæ¹è¿å»ºè®®æ´æ¹æ¥å': 'databridge改进建议整改报告.md',
    'rm剩余任务全量盘点与整改方': 'rm剩余任务全量盘点与整改方案-2026-07-08.md',
    'v9核心数据字典与类型定': 'v9核心数据字典与类型定义(整合版).md',
    'V9-ä½ç³»åä¸çº¿æµè¯': 'V9-体系化上线测试-todo-list.md'
}

correct_paths = {
    'b批次高价值孤儿集成状态报告-2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '发布计划与评估-r01.md': 'docs/explanation/design/发布计划与评估-r01.md',
    '回滚方案与演练-r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '综合验证与定位分析报告-v2.0.0.md': 'docs/reports/retrospectives/综合验证与定位分析报告-v2.0.0.md',
    'databridge改进建议整改实施计划.md': 'docs/reference/databridge改进建议整改实施计划.md',
    'databridge改进建议整改报告.md': 'docs/explanation/design/databridge改进建议整改报告.md',
    'rm剩余任务全量盘点与整改方案-2026-07-08.md': 'docs/reference/rm剩余任务全量盘点与整改方案-2026-07-08.md',
    'v9核心数据字典与类型定义(整合版).md': 'docs/reference/v9核心数据字典与类型定义(整合版).md',
    'V9-体系化上线测试-todo-list.md': 'docs/_pending-review/v9-体系化上线测试-todo-list.md'
}

def fix_garbled_links_in_file(filepath):
    content = None
    for enc in ['utf-8', 'gbk', 'gb2312', 'latin-1']:
        try:
            with open(filepath, "r", encoding=enc) as f:
                content = f.read()
                break
        except:
            continue
    
    if content is None:
        return 0
    
    fixed_count = 0
    for garbled, correct_name in garbled_mappings.items():
        if garbled in content:
            correct_path = correct_paths.get(correct_name, correct_name)
            content = content.replace(garbled, correct_path)
            fixed_count += 1
            print(f"  FIX: {garbled} -> {correct_path}")
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
    
    return fixed_count

def main():
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if any(garbled in content for garbled in garbled_mappings.keys()):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files with garbled links")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"\nProcessing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_garbled_links_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*50}")
    print(f"Total garbled links fixed: {total_fixed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()