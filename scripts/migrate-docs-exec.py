import os
import shutil
import csv
import json

def load_migration_inventory(csv_path):
    docs = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            docs.append(row)
    return docs

def build_redirect_map(docs):
    redirects = []
    for doc in docs:
        old_path = doc['old_path']
        new_path = doc['target_path']
        category = doc['diataxis_category']
        
        if old_path == new_path or new_path.startswith('docs/00-meta'):
            status = 'skipped'
        else:
            status = 'pending'
        
        redirects.append({
            'old_path': old_path,
            'new_path': new_path,
            'diataxis_category': category,
            'status': status
        })
    
    return redirects

def migrate_docs(docs, docs_root, dry_run=False):
    migrated = 0
    skipped = 0
    failed = 0
    
    for doc in docs:
        old_path = doc['old_path']
        new_path = doc['target_path']
        
        full_old_path = os.path.join(docs_root, old_path)
        full_new_path = os.path.join(docs_root, new_path.replace('docs/', ''))
        
        if old_path == new_path or new_path.startswith('docs/00-meta'):
            skipped += 1
            continue
        
        if not os.path.exists(full_old_path):
            print(f'❌ 源文件不存在: {full_old_path}')
            failed += 1
            continue
        
        new_dir = os.path.dirname(full_new_path)
        if not os.path.exists(new_dir):
            os.makedirs(new_dir)
        
        if dry_run:
            print(f'🔄 [DRY-RUN] {old_path} -> {new_path}')
        else:
            try:
                shutil.move(full_old_path, full_new_path)
                print(f'✅ {old_path} -> {new_path}')
                migrated += 1
            except Exception as e:
                print(f'❌ 迁移失败 {old_path}: {e}')
                failed += 1
    
    print(f'\n=== 迁移统计 ===')
    print(f'迁移: {migrated}')
    print(f'跳过: {skipped}')
    print(f'失败: {failed}')
    
    return migrated, skipped, failed

def save_redirect_map(redirects, output_path):
    map_data = {
        'version': '1.0.0',
        'created_at': '2026-07-14T00:00:00Z',
        'redirects': redirects,
        'preserved_directories': [
            '00-meta',
            'assets',
            'reports',
            'drafts',
            'prompts'
        ]
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(map_data, f, indent=2, ensure_ascii=False)
    
    print(f'\n✅ Redirect map saved to {output_path}')

def create_diataxis_dirs(docs_root):
    dirs = ['tutorials', 'how-to', 'reference', 'explanation']
    for dir_name in dirs:
        dir_path = os.path.join(docs_root, dir_name)
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f'Created {dir_name}/')

if __name__ == '__main__':
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    inventory_path = os.path.join(docs_root, '00-meta', '_migration-inventory.csv')
    redirect_map_path = os.path.join(docs_root, '_redirect-map.json')
    
    print('=== Creating Diátaxis directories ===')
    create_diataxis_dirs(docs_root)
    
    docs = load_migration_inventory(inventory_path)
    redirects = build_redirect_map(docs)
    
    print(f'\n=== 文档迁移执行 ===')
    print(f'总文档数: {len(docs)}')
    
    print('\n--- 执行迁移 ---')
    migrate_docs(docs, docs_root, dry_run=False)
    
    print('\n--- 保存 Redirect Map ---')
    save_redirect_map(redirects, redirect_map_path)