import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

replacements = [
    ('bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å', 'b批次高价值孤儿集成状态报告'),
    ('åå¸è®¡åä¸è¯å®', '发布计划与评审'),
    ('åæ»æ¹æ¡ä¸æ¼ç»', '回滚方案与演练'),
    ('V9-ä½ç³»åä¸çº¿æµè¯', 'V9-体系化上线测试'),
    ('V9 ä½ç³»åä¸çº¿æµè¯', 'V9 体系化上线测试'),
    ('ç»¼åéªè¯ä¸å®ä½åææµ', '综合验证与定位分析'),
    ('COCKPIT_æä½è®¾è®¡ä¸è§æµ', 'COCKPIT_整体设计一致性'),
    ('cockpit_æä½è®¾è®¡ä¸è§æµ', 'cockpit_整体设计一致性'),
    ('DOCUMENTATION-EXPORTER-æ', 'DOCUMENTATION-EXPORTER-文档'),
    ('FILE-MANAGEMENT-GUIDE-æ', 'FILE-MANAGEMENT-GUIDE-文档'),
    ('FILE-MANAGEMENT-GUIDE-RCA', 'FILE-MANAGEMENT-GUIDE-RCA'),
    ('ä¸å¤å¿æ²¹å¹³å', '五大油脂平台'),
    ('P4-ææ¡£åéæ¸', 'P4-文档整理'),
    ('ææ¡£åéæ¸å待办清单', '文档整理待办清单'),
    ('p4-ææ¡£åéæ¸', 'p4-文档整理')
]

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    
    try:
        with open(full_path, "rb") as f:
            content_bytes = f.read()
        
        content = content_bytes.decode('utf-8', errors='replace')
        original_content = content
        
        for old, new in replacements:
            content = content.replace(old, new)
        
        if content != original_content:
            with open(full_path, "wb") as f:
                f.write(content.encode('utf-8'))
            return True, content != original_content
        return False, False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False, False

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        success, changed = fix_file(filepath)
        if changed:
            print("  FIXED")
        else:
            print("  No changes needed")

if __name__ == "__main__":
    main()