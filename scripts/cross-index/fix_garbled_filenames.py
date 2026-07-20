import re
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"

garbled_mappings = {
    '%E8%B8%A9%E5%9D%91%E8%A7%84%E5%88%99%E9%97%A8%E7%A6%81%E6%8C%87%E5%8D%97.md': '踩坑规则门禁指南.md',
    'V9-ææ¡£æ²»çä¿®å¤è¡å¨è®¡å.md': 'V9-文档治理修复行动计划.md',
    'V9-é¡¹ç®å¥åº·ç¶ææ»è§.md': 'V9-项目健康状态总览.md',
    'V9æ°æ®å®ªæ³.md': 'V9数据宪法.md',
    'bæ¹æ¬¡ç»ä»¶éææµè¯æ¥å-b6-2026-07-08.md': 'b批次组件集成测试报告-b6-2026-07-08.md',
    'databridgeæ¹è¿å»ºè®®æ´æ¹å®æ½è®¡å.md': 'databridge改进建议整改实施计划.md',
    'databridgeæ¹è¿å»ºè®®æ´æ¹æ¥å.md': 'databridge改进建议整改报告.md',
    'rbacæ´åå¯è¡æ§åæä¸å®æ½è®¡å-2026-07-08.md': 'rbac整合可行性分析与实施计划-2026-07-08.md',
    'v6-v9çé¢è®¾è®¡htmlç²¾è¯»æ¥å.md': 'v6-v9界面设计html精读报告.md'
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
    for garbled, correct in garbled_mappings.items():
        if garbled in content:
            content = content.replace(garbled, correct)
            fixed_count += 1
            print(f"  FIX: {garbled} -> {correct}")
    
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