import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_search = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

garbled_patterns = [
    ('bæ¹æ¬¡', 'b批次'),
    ('ä½ç³»å', '体系化'),
    ('åå¸è®¡', '发布计划'),
    ('åæ»æ¹æ¡', '回滚方案'),
    ('é«ä»·å¼', '高价值'),
    ('å­¤å¿', '孤儿'),
    ('éæç¶', '集成'),
    ('ææ¥å', '报告'),
    ('è¯å®', '评审'),
    ('ä¸æ¼ç»', '演练'),
    ('ç»¼åéª', '综合验证'),
    ('ä¸å®ä½', '定位分析')
]

def search_file(filepath):
    full_path = BASE_DIR / filepath
    with open(full_path, "rb") as f:
        content_bytes = f.read()
    
    content_str = content_bytes.decode('utf-8', errors='replace')
    
    print(f"\n=== Searching: {filepath} ===")
    for garbled, correct in garbled_patterns:
        if garbled in content_str:
            print(f"  FOUND: '{garbled}' (should be '{correct}')")
    
    return content_str

def main():
    for filepath in files_to_search:
        search_file(filepath)

if __name__ == "__main__":
    main()