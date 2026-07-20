import json
import re
from pathlib import Path
import os

BASE_DIR = Path(__file__).parent.parent.parent
DOCS_DIR = BASE_DIR / "docs"
RELATION_INDEX = DOCS_DIR / "00-meta" / "ai-index" / "relation-index.json"
MASTER_INDEX = DOCS_DIR / "00-meta" / "ai-index" / "master-index.json"

GARBLED_CHARS = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

def load_relation_index():
    with open(RELATION_INDEX, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_master_index():
    with open(MASTER_INDEX, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_doc_info(doc_id, master_index):
    documents = master_index.get('documents', {})
    if doc_id in documents:
        return documents[doc_id]
    return None

def get_file_metadata(filepath):
    try:
        stats = os.stat(filepath)
        ctime = stats.st_ctime
        mtime = stats.st_mtime
        return {
            'created': ctime,
            'modified': mtime,
            'size': stats.st_size
        }
    except:
        return None

def decode_garbled_attempts(garbled):
    attempts = []
    try:
        attempts.append(garbled.encode('latin-1').decode('utf-8'))
    except:
        pass
    try:
        attempts.append(garbled.encode('latin-1').decode('gbk'))
    except:
        pass
    attempts.append(garbled)
    return list(set(attempts))

def get_importance(path):
    if path.startswith('docs/00-meta/'):
        return ('HIGH', '元文档')
    elif path.startswith('docs/reports/'):
        return ('HIGH', '报告文档')
    elif path.startswith('docs/explanation/design/'):
        return ('HIGH', '设计文档')
    elif path.startswith('docs/explanation/'):
        return ('MEDIUM', '说明文档')
    elif path.startswith('docs/reference/'):
        return ('MEDIUM', '参考文档')
    elif path.startswith('docs/_pending-review/'):
        return ('LOW', '待审核')
    elif path.startswith('docs/archive/'):
        return ('LOW', '归档文档')
    else:
        return ('MEDIUM', '其他')

def main():
    print("Loading indices...")
    relation_index = load_relation_index()
    master_index = load_master_index()
    
    active_unresolved = relation_index.get('active_unresolved', {})
    
    garbled_links = {}
    for source_doc_id, links in active_unresolved.items():
        source_info = get_doc_info(source_doc_id, master_index)
        source_path = source_info.get('path', '') if source_info else ''
        
        for link_obj in links:
            raw_link = link_obj.get("link", "")
            resolved = link_obj.get("resolved", "")
            
            has_garbled = any(c in raw_link for c in GARBLED_CHARS)
            if not has_garbled:
                continue
            
            filename = Path(raw_link).name
            if filename not in garbled_links:
                garbled_links[filename] = []
            garbled_links[filename].append({
                'source_doc_id': source_doc_id,
                'source_path': source_path,
                'raw_link': raw_link,
                'resolved': resolved
            })
    
    print(f"\n{'='*80}")
    print(f"GARBLED LINKS IMPORTANCE ANALYSIS")
    print(f"{'='*80}")
    print(f"Total unique garbled links: {len(garbled_links)}")
    print(f"{'='*80}\n")
    
    for filename, occurrences in garbled_links.items():
        attempts = decode_garbled_attempts(filename)
        
        print(f"\n{'─'*60}")
        print(f"GARBLED: {filename}")
        print(f"Decode attempts:")
        for i, attempt in enumerate(attempts):
            print(f"  [{i+1}] {attempt}")
        
        print(f"\nReferenced by {len(occurrences)} files:")
        for occ in occurrences:
            source_path = occ['source_path']
            importance, category = get_importance(source_path)
            metadata = get_file_metadata(BASE_DIR / source_path)
            
            mtime_str = ''
            if metadata:
                from datetime import datetime
                mtime_str = datetime.fromtimestamp(metadata['modified']).strftime('%Y-%m-%d %H:%M')
            
            print(f"  - {source_path}")
            print(f"    Importance: {importance} | Category: {category}")
            print(f"    Modified: {mtime_str}")
    
    print(f"\n{'='*80}")
    print(f"SUMMARY BY IMPORTANCE")
    print(f"{'='*80}")
    
    importance_counts = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    for filename, occurrences in garbled_links.items():
        for occ in occurrences:
            importance, _ = get_importance(occ['source_path'])
            importance_counts[importance] += 1
    
    total = sum(importance_counts.values())
    print(f"Total garbled link occurrences: {total}")
    print(f"  HIGH importance: {importance_counts['HIGH']} ({importance_counts['HIGH']/total*100:.1f}%)")
    print(f"  MEDIUM importance: {importance_counts['MEDIUM']} ({importance_counts['MEDIUM']/total*100:.1f}%)")
    print(f"  LOW importance: {importance_counts['LOW']} ({importance_counts['LOW']/total*100:.1f}%)")

if __name__ == "__main__":
    main()