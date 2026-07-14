import os
import shutil

MIGRATION_MAP = {
    '02-design/architecture/v9-mcp-analysis.html': 'explanation/v9-mcp-analysis.html',
    '02-design/blueprints/v9-pipeline-sequence.mmd': 'reference/v9-pipeline-sequence.mmd',
}

BACKUP_FILES = [
    '03-development/guides/getting-started/README.md.backup.1783954189100',
    '03-development/guides/getting-started/README.md.backup.1783954189155',
]

def migrate_misplaced_docs(docs_root):
    migrated = 0
    skipped = 0
    
    print('=== 迁移错位文档 ===')
    
    for old_path, new_path in MIGRATION_MAP.items():
        full_old = os.path.join(docs_root, old_path)
        full_new = os.path.join(docs_root, new_path)
        
        if os.path.exists(full_old):
            new_dir = os.path.dirname(full_new)
            if not os.path.exists(new_dir):
                os.makedirs(new_dir)
            
            shutil.move(full_old, full_new)
            print(f'✅ {old_path} -> {new_path}')
            migrated += 1
        else:
            print(f'⚠️ 源文件不存在: {old_path}')
            skipped += 1
    
    print(f'\n迁移: {migrated}, 跳过: {skipped}')
    return migrated, skipped

def clean_backup_files(docs_root):
    cleaned = 0
    failed = 0
    
    print('\n=== 清理备份文件 ===')
    
    for rel_path in BACKUP_FILES:
        full_path = os.path.join(docs_root, rel_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f'✅ 删除: {rel_path}')
            cleaned += 1
        else:
            print(f'⚠️ 文件不存在: {rel_path}')
            failed += 1
    
    print(f'\n清理: {cleaned}, 失败: {failed}')
    return cleaned, failed

def clean_empty_directories(docs_root):
    cleaned = 0
    
    print('\n=== 清理空目录 ===')
    
    old_dirs = ['02-design', '03-development', '04-testing']
    for dir_name in old_dirs:
        dir_path = os.path.join(docs_root, dir_name)
        if os.path.exists(dir_path):
            if not os.listdir(dir_path):
                os.rmdir(dir_path)
                print(f'✅ 删除空目录: {dir_name}/')
                cleaned += 1
            else:
                print(f'⚠️ 目录非空，保留: {dir_name}/')
    
    print(f'\n清理空目录: {cleaned}')
    return cleaned

if __name__ == '__main__':
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    
    print('=== P1-2: 目录错位清理 ===')
    
    migrate_misplaced_docs(docs_root)
    
    clean_backup_files(docs_root)
    
    clean_empty_directories(docs_root)
    
    print('\n✅ P1-2 目录错位清理完成')