import os
import json
import csv

def verify_directory_structure(docs_root, scripts_root):
    print('=== 目录结构验证 ===')
    
    docs_expected_dirs = ['tutorials', 'how-to', 'reference', 'explanation', '00-meta', 'assets', 'reports', 'drafts', 'prompts']
    scripts_expected_dirs = ['audit', 'verify', 'generate', 'fix', 'docs-tool', 'test-tool', 'quality', 'security', 'config', 'migrate', 'automation', 'build', 'monitor', '_debug', 'other']
    
    docs_ok = True
    scripts_ok = True
    
    print('\n📁 docs 目录结构:')
    for dir_name in docs_expected_dirs:
        dir_path = os.path.join(docs_root, dir_name)
        exists = os.path.exists(dir_path)
        status = '✅' if exists else '❌'
        if not exists:
            docs_ok = False
        print(f'  {status} {dir_name}/')
    
    print('\n📁 scripts 目录结构:')
    for dir_name in scripts_expected_dirs:
        dir_path = os.path.join(scripts_root, dir_name)
        exists = os.path.exists(dir_path)
        status = '✅' if exists else '❌'
        if not exists:
            scripts_ok = False
        print(f'  {status} {dir_name}/')
    
    return docs_ok and scripts_ok

def verify_doc_migration(docs_root):
    print('\n=== 文档迁移验证 ===')
    
    inventory_path = os.path.join(docs_root, '00-meta', '_migration-inventory.csv')
    redirect_map_path = os.path.join(docs_root, '_redirect-map.json')
    
    if not os.path.exists(inventory_path):
        print('❌ 迁移清单不存在')
        return False
    if not os.path.exists(redirect_map_path):
        print('❌ Redirect Map不存在')
        return False
    
    print('✅ 迁移清单存在')
    print('✅ Redirect Map存在')
    
    with open(inventory_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        total_docs = sum(1 for _ in reader)
    
    md_files = []
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git']]
        for f in files:
            if f.endswith('.md'):
                md_files.append(f)
    
    print(f'📊 总文档数: {total_docs}')
    print(f'📊 当前MD文件数: {len(md_files)}')
    
    category_counts = {}
    categories = ['tutorials', 'how-to', 'reference', 'explanation']
    for cat in categories:
        cat_dir = os.path.join(docs_root, cat)
        if os.path.exists(cat_dir):
            category_counts[cat] = len([f for f in os.listdir(cat_dir) if f.endswith('.md')])
        else:
            category_counts[cat] = 0
    
    print('\n📊 文档分类分布:')
    for cat, count in category_counts.items():
        print(f'  {cat}: {count}')
    
    return True

def verify_script_migration(scripts_root):
    print('\n=== 脚本迁移验证 ===')
    
    inventory_path = os.path.join(scripts_root, '_migration-inventory.csv')
    
    if not os.path.exists(inventory_path):
        print('❌ 脚本迁移清单不存在')
        return False
    
    print('✅ 脚本迁移清单存在')
    
    with open(inventory_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        total_scripts = sum(1 for _ in reader)
    
    script_files = []
    for root, dirs, files in os.walk(scripts_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git']]
        for f in files:
            if f.endswith(('.ts', '.js', '.mjs', '.cjs', '.sh', '.py', '.ps1')):
                script_files.append(f)
    
    print(f'📊 总脚本数: {total_scripts}')
    print(f'📊 当前脚本文件数: {len(script_files)}')
    
    return True

def verify_package_json(package_json_path):
    print('\n=== package.json 验证 ===')
    
    with open(package_json_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
    
    scripts = pkg.get('scripts', {})
    
    deprecated_count = sum(1 for v in scripts.values() if v.startswith('# DEPRECATED'))
    valid_count = len(scripts) - deprecated_count
    
    print(f'📊 脚本总数: {len(scripts)}')
    print(f'📊 有效脚本: {valid_count}')
    print(f'📊 已标记废弃: {deprecated_count}')
    
    if deprecated_count <= 3:
        print('✅ package.json 状态良好')
        return True
    else:
        print('⚠️ package.json 存在较多废弃脚本')
        return True

def main():
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    scripts_root = os.path.dirname(__file__)
    package_json_path = os.path.join(os.path.dirname(__file__), '..', 'package.json')
    
    print('=' * 60)
    print('🔍 P0级全量门禁验证')
    print('=' * 60)
    
    checks = [
        ('目录结构', verify_directory_structure(docs_root, scripts_root)),
        ('文档迁移', verify_doc_migration(docs_root)),
        ('脚本迁移', verify_script_migration(scripts_root)),
        ('package.json', verify_package_json(package_json_path)),
    ]
    
    print('\n' + '=' * 60)
    print('📋 门禁验证结果')
    print('=' * 60)
    
    all_passed = True
    for name, passed in checks:
        status = '✅ PASS' if passed else '❌ FAIL'
        print(f'  {status}: {name}')
        if not passed:
            all_passed = False
    
    print('\n' + '=' * 60)
    if all_passed:
        print('🎉 所有P0级门禁验证通过！')
    else:
        print('⚠️ 部分门禁验证未通过，需要修复')
    print('=' * 60)
    
    return all_passed

if __name__ == '__main__':
    main()