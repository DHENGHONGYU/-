import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

garbled_mappings = {
    '../bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../../explanation/bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../../explanation/v9-ä½ç³»åä¸çº¿æµè¯?todo-list.md': 'docs/_pending-review/v9-体系化上线测试-todo-list.md',
    '../explanation/V9-ä½ç³»åä¸çº¿æµè¯?TODO-LIST.md': 'docs/_pending-review/v9-体系化上线测试-todo-list.md',
    '../../explanation/design/åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../../explanation/design/åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '../åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '../reports/retrospectives/ç»¼åéªè¯ä¸å®ä½åææ¥å?v2.0.0.md': 'docs/reports/retrospectives/综合验证与定位分析报告-v2.0.0.md',
    '../archive/â€?RCA-report.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-RCA-report.md',
    '../archive/â€?file-wandering-report.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-file-wandering-report.md',
    '../archive/â€?optimization-prompt.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-optimization-prompt.md',
    '../archive/â€?task-list.md': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-task-list.md',
    '../rmå©ä½ä»»å¡å¨éçç¹ä¸æ´æ¹æ¹æ¡?2026-07-08.md': 'docs/reference/rm剩余任务全量盘点与整改方案-2026-07-08.md',
    '../../reference/rmå©ä½ä»»å¡å¨éçç¹ä¸æ´æ¹æ¹æ¡?2026-07-08.md': 'docs/reference/rm剩余任务全量盘点与整改方案-2026-07-08.md'
}

def fix_links_in_file(filepath):
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
    
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    fixed_count = 0
    
    def replace_link(match):
        nonlocal fixed_count
        text = match.group(1)
        raw_link = match.group(2).strip()
        
        if raw_link in garbled_mappings:
            new_link = garbled_mappings[raw_link]
            print(f"  FIX: [{text}]({raw_link}) -> [{text}]({new_link})")
            fixed_count += 1
            return f"[{text}]({new_link})"
        
        return match.group(0)
    
    new_content = link_pattern.sub(replace_link, content)
    
    if fixed_count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
    
    return fixed_count

def main():
    files_to_check = []
    for md_file in DOCS_DIR.rglob("*.md"):
        try:
            with open(md_file, "r", encoding="utf-8", errors='ignore') as f:
                content = f.read()
                if any(old in content for old in garbled_mappings.keys()):
                    files_to_check.append(md_file)
        except:
            pass
    
    print(f"Found {len(files_to_check)} files to fix\n")
    
    total_fixed = 0
    for filepath in files_to_check:
        print(f"Processing: {filepath.relative_to(BASE_DIR)}")
        fixed = fix_links_in_file(filepath)
        total_fixed += fixed
    
    print(f"\n{'='*60}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()