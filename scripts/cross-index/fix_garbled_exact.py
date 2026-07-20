from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

exact_replacements = {
    'bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'b批次高价值孤儿集成状态报告-2026-07-08.md',
    'bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å_2026-07-08': 'b批次高价值孤儿集成状态报告_2026-07-08',
    'Bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å_2026-07-08': 'B批次高价值孤儿集成状态报告_2026-07-08',
    '../../explanation/bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    '../explanation/bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å?2026-07-08.md': 'docs/explanation/b批次高价值孤儿集成状态报告-2026-07-08.md',
    'åå¸è®¡åä¸è¯å®?r01.md': '发布计划与评审-r01.md',
    '../../explanation/design/åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    '../explanation/design/åå¸è®¡åä¸è¯å®?r01.md': 'docs/explanation/design/发布计划与评审-r01.md',
    'åæ»æ¹æ¡ä¸æ¼ç»?r03.md': '回滚方案与演练-r03.md',
    '../../explanation/design/åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    '../explanation/design/åæ»æ¹æ¡ä¸æ¼ç»?r03.md': 'docs/explanation/design/回滚方案与演练-r03.md',
    'cockpit_æä½è®¾è®¡ä¸è§æµå®¡æ': 'cockpit_整体设计一致性审核',
    'COCKPIT_æä½è®¾è®¡ä¸è§æµå®¡æ': 'COCKPIT_整体设计一致性审核',
    'V9-ä½ç³»åä¸çº¿æµè¯?todo-list.md': 'v9-体系化上线测试-todo-list.md',
    'V9-ä½ç³»åä¸çº¿æµè¯?TODO-LIST.md': 'v9-体系化上线测试-todo-list.md',
    '../_pending-review/V9-ä½ç³»åä¸çº¿æµè¯?todo-list.md': 'docs/_pending-review/v9-体系化上线测试-todo-list.md',
    '../../_pending-review/V9-ä½ç³»åä¸çº¿æµè¯?todo-list.md': 'docs/_pending-review/v9-体系化上线测试-todo-list.md',
    'V9 ä½ç³»åä¸çº¿æµè¯': 'V9 体系化上线测试',
    'ç»¼åéªè¯ä¸å®ä½åææµ?v2.0.0.md': '综合验证与定位分析报告-v2.0.0.md',
    '../explanation/design/ç»¼åéªè¯ä¸å®ä½åææµ?v2.0.0.md': 'docs/explanation/design/综合验证与定位分析报告-v2.0.0.md',
    '../../explanation/design/ç»¼åéªè¯ä¸å®ä½åææµ?v2.0.0.md': 'docs/explanation/design/综合验证与定位分析报告-v2.0.0.md',
    'ä¸å¤å¿æ²¹å¹³å?2026-07-08.md': '五大油脂平台-2026-07-08.md',
    '../explanation/ä¸å¤å¿æ²¹å¹³å?2026-07-08.md': 'docs/explanation/五大油脂平台-2026-07-08.md',
    'P4-ææ¡£åéæ¸': 'P4-文档整理',
    'p4-ææ¡£åéæ¸': 'p4-文档整理',
    'DOCUMENTATION-EXPORTER-æ': 'DOCUMENTATION-EXPORTER-文档',
    'FILE-MANAGEMENT-GUIDE-æ': 'FILE-MANAGEMENT-GUIDE-文档'
}

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original_content = content
    changes_made = 0
    
    for old, new in exact_replacements.items():
        if old in content:
            content = content.replace(old, new)
            changes_made += 1
            print(f"  REPLACED: {old} -> {new}")
    
    if content != original_content:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    return changes_made

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        changes = fix_file(filepath)
        if changes > 0:
            print(f"  Total changes: {changes}")
        else:
            print("  No changes needed")

if __name__ == "__main__":
    main()