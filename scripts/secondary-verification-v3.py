import os
import json
import re

def verify_doc_integrity(docs_root):
    print('=== 文档完整性校验 ===')
    
    issues = []
    total_files = 0
    empty_files = 0
    
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '_generated', 'deprecated-docs', 'old-versions']]
        
        for filename in files:
            if not filename.endswith('.md'):
                continue
            
            total_files += 1
            full_path = os.path.join(root, filename)
            
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if len(content.strip()) == 0:
                    empty_files += 1
                    issues.append(f'❌ 空文件: {os.path.relpath