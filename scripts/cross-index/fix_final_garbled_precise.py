import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
RELATION_INDEX = DOCS_DIR / "00-meta" / "ai-index" / "relation-index.json"

GARBLED_CHARS = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

garbled_mappings = {
    'bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    'V9-ä½ç³»åä¸çº¿æµè¯': 'docs/_pending-review/v9-体系化上线测试-todo-list.md',
    'v9-ä½ç³»åä¸çº¿æµè¯': 'docs/_pending-review/v9-体系化上线测试-todo-list.md',
    'åå¸è®¡åä¸è¯å®': 'docs/explanation/design/发布计划与评审-r01.md',
    'åæ»æ¹æ¡ä¸æ¼ç»': 'docs/explanation/design/回滚方案与演练-r03.md',
    'ç»¼åéªè¯ä¸å®ä½åææ¥å': 'docs/reports/retrospectives/综合验证与定位分析报告-v2.0.0.md',
    'â€?RCA-report': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-RCA-report.md',
    'â€?file-wandering-report': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-file-wandering-report.md',
    'â€?optimization-prompt': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-optimization-prompt.md',
    'â€?task-list': 'docs/00-meta/FILE-MANAGEMENT-GUIDE-task-list.md'
}

def load_relation_index():
    with open(RELATION_INDEX, 'r', encoding='utf-8') as f:
        return json.load(f)

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
        
        if raw_link.startswith("http://") or raw_link.startswith("https://"):
            return match.group(0)
        if raw_link.startswith("#"):
            return match.group(0)
        
        has_garbled = any(c in raw_link for c in GARBLED_CHARS)
        if not has_garbled:
            return match.group(0)
        
        for garbled, correct_path in garbled_mappings.items():
            if garbled in raw_link:
                new_link = correct_path
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
    print("Loading relation index...")
    relation_index = load_relation_index()
    
    active_unresolved = relation_index.get('active_unresolved', {})
    print(f"Total active unresolved sources: {len(active_unresolved)}\n")
    
    total_fixed = 0
    for source_doc_id, links in active_unresolved.items():
        source_path = None
        documents = relation_index.get('links', {})
        for doc_id, info in documents.items():
            if isinstance(info, dict) and info.get('path') and doc_id == source_doc_id:
                source_path = info.get('path')
                break
        
        if not source_path:
            continue
        
        full_path = BASE_DIR / source_path
        
        print(f"\nProcessing: {source_path}")
        fixed = fix_links_in_file(full_path)
        total_fixed += fixed
    
    print(f"\n{'='*60}")
    print(f"Total links fixed: {total_fixed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()