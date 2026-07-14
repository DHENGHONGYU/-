import os
import csv
import re
from datetime import datetime

DIATAXIS_CATEGORIES = ['tutorials', 'how-to', 'reference', 'explanation']

def extract_frontmatter(content):
    match = re.match(r'^---\n([\s\S]*?)\n---', content)
    if not match:
        return {}
    result = {}
    for line in match.group(1).split('\n'):
        parts = line.split(':', 1)
        if len(parts) == 2:
            key = parts[0].strip()
            value = parts[1].strip().strip('\'"')
            result[key] = value
    return result

def detect_diataxis_category(filename, content, frontmatter):
    lower_name = filename.lower()
    lower_content = content.lower()
    
    if 'type' in frontmatter:
        ft = frontmatter['type'].lower()
        if 'tutorial' in ft:
            return 'tutorials'
        if 'guide' in ft:
            return 'how-to'
        if 'reference' in ft:
            return 'reference'
        if 'explanation' in ft or 'explain' in ft:
            return 'explanation'
    
    if any(x in lower_name for x in ['tutorial', 'getting-started', 'introduction']):
        return 'tutorials'
    if any(x in lower_name for x in ['guide', 'how-to', 'manual', 'walkthrough']):
        return 'how-to'
    if any(x in lower_name for x in ['reference', 'api', 'contract', 'schema', 'spec', 'dictionary']):
        return 'reference'
    if any(x in lower_name for x in ['architecture', 'design', 'analysis', 'overview', 'report']):
        return 'explanation'
    
    if any(x in lower_content for x in ['learn how', 'step by step', 'get started']):
        return 'tutorials'
    if 'how to' in lower_content and 'how to install' not in lower_content:
        return 'how-to'
    if any(x in lower_content for x in ['api ', 'endpoint', 'interface']):
        return 'reference'
    if any(x in lower_content for x in ['architecture', 'design', 'analysis']):
        return 'explanation'
    
    return 'explanation'

def get_target_path(old_path, diataxis_category):
    if old_path.startswith('00-meta'):
        return f'docs/00-meta/{os.path.basename(old_path)}'
    if any(old_path.startswith(x) for x in ['assets', 'reports', 'drafts', 'prompts']):
        return f'docs/{old_path}'
    return f'docs/{diataxis_category}/{os.path.basename(old_path)}'

def extract_cross_refs(content):
    refs = []
    pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    for match in re.finditer(pattern, content):
        link = match.group(2)
        if link.startswith(('./', '../', 'docs/', '/')):
            refs.append(link)
    return list(set(refs))

def scan_docs(docs_root):
    results = []
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '07-archive']]
        for filename in files:
            if not filename.endswith('.md'):
                continue
            full_path = os.path.join(root, filename)
            rel_path = os.path.relpath(full_path, docs_root).replace('\\', '/')
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                stats = os.stat(full_path)
                frontmatter = extract_frontmatter(content)
                diataxis_category = detect_diataxis_category(filename, content, frontmatter)
                target_path = get_target_path(rel_path, diataxis_category)
                cross_refs = extract_cross_refs(content)
                results.append({
                    'old_path': rel_path,
                    'filename': filename,
                    'size': stats.st_size,
                    'last_modified': datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    'frontmatter_title': frontmatter.get('title', ''),
                    'frontmatter_version': frontmatter.get('version', frontmatter.get('Version', '')),
                    'frontmatter_type': frontmatter.get('type', ''),
                    'diataxis_category': diataxis_category,
                    'target_path': target_path,
                    'cross_refs': '; '.join(cross_refs)
                })
            except Exception as e:
                print(f'Error reading {full_path}: {e}')
    return results

def write_csv(docs, output_path):
    headers = ['old_path', 'filename', 'size', 'last_modified', 'frontmatter_title', 'frontmatter_version', 'frontmatter_type', 'diataxis_category', 'target_path', 'cross_refs']
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(docs)
    print(f'Wrote {len(docs)} entries to {output_path}')

if __name__ == '__main__':
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    output_path = os.path.join(docs_root, '00-meta', '_migration-inventory.csv')
    
    docs = scan_docs(docs_root)
    write_csv(docs, output_path)
    
    print(f'\n=== Document Inventory Statistics ===')
    print(f'Total documents: {len(docs)}')
    
    category_counts = {cat: sum(1 for d in docs if d['diataxis_category'] == cat) for cat in DIATAXIS_CATEGORIES}
    print('Category distribution:')
    for cat, count in category_counts.items():
        print(f'  {cat}: {count}')