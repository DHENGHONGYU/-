import os
import json
import re

def load_redirect_map(map_path):
    with open(map_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['redirects']

def build_path_map(redirects):
    path_map = {}
    for entry in redirects:
        if entry['status'] != 'skipped':
            old_path = entry['old_path']
            new_path = entry['new_path'].replace('docs/', '')
            path_map[old_path] = new_path
    return path_map

def fix_cross_references(docs_root, path_map):
    fixed_count = 0
    total_files = 0
    files_with_changes = []
    
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git']]
        
        for filename in files:
            if not filename.endswith('.md'):
                continue
            
            total_files += 1
            full_path = os.path.join(root, filename)
            
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                changed = False
                
                def replace_link(match):
                    nonlocal changed
                    text = match.group(1)
                    link = match.group(2)
                    
                    for old_path, new_path in path_map.items():
                        if old_path in link:
                            new_link = link.replace(old_path, new_path)
                            changed = True
                            return f'[{text}]({new_link})'
                    
                    return match.group(0)
                
                content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', replace_link, content)
                
                if changed:
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    fixed_count += 1
                    files_with_changes.append(full_path)
                    print(f'✅ 修复: {os.path.relpath(full_path, docs_root)}')
            except Exception as e:
                print(f'❌ 处理失败 {filename}: {e}')
    
    print(f'\n=== 交叉引用修复统计 ===')
    print(f'处理文件数: {total_files}')
    print(f'修复文件数: {fixed_count}')
    
    return files_with_changes

if __name__ == '__main__':
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    redirect_map_path = os.path.join(docs_root, '_redirect-map.json')
    
    print('=== 文档交叉引用修复 ===')
    
    redirects = load_redirect_map(redirect_map_path)
    path_map = build_path_map(redirects)
    
    print(f'加载 {len(path_map)} 个路径映射')
    
    fix_cross_references(docs_root, path_map)
    
    print('\n✅ 交叉引用修复完成')