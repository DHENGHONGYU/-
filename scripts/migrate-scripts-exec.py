import os
import shutil
import csv
import json

def load_script_inventory(csv_path):
    scripts = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            scripts.append(row)
    return scripts

def update_package_json(package_json_path, scripts_map):
    with open(package_json_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
    
    updated_count = 0
    for script_name, script_value in pkg.get('scripts', {}).items():
        for old_path, new_path in scripts_map.items():
            if old_path in script_value:
                pkg['scripts'][script_name] = script_value.replace(old_path, new_path)
                updated_count += 1
                print(f'  📦 更新脚本: {script_name} -> {pkg["scripts"][script_name]}')
    
    with open(package_json_path, 'w', encoding='utf-8') as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
    
    return updated_count

def update_husky_scripts(husky_dir, scripts_map):
    updated_count = 0
    if not os.path.exists(husky_dir):
        return updated_count
    
    for filename in os.listdir(husky_dir):
        filepath = os.path.join(husky_dir, filename)
        if not os.path.isfile(filepath):
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        modified = False
        for old_path, new_path in scripts_map.items():
            if old_path in content:
                content = content.replace(old_path, new_path)
                modified = True
                updated_count += 1
        
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'  🐶 更新 husky: {filename}')
    
    return updated_count

def migrate_scripts(scripts, scripts_root, dry_run=False):
    migrated = 0
    skipped = 0
    failed = 0
    scripts_map = {}
    
    for script in scripts:
        old_path = script['old_path']
        target_subdir = script['target_subdir']
        filename = script['filename']
        
        full_old_path = os.path.join(scripts_root, old_path)
        full_new_path = os.path.join(scripts_root, target_subdir, filename)
        
        if old_path.startswith(target_subdir):
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
            print(f'🔄 [DRY-RUN] {old_path} -> {target_subdir}/{filename}')
            scripts_map[old_path] = f'{target_subdir}/{filename}'
        else:
            try:
                shutil.move(full_old_path, full_new_path)
                print(f'✅ {old_path} -> {target_subdir}/{filename}')
                scripts_map[old_path] = f'{target_subdir}/{filename}'
                migrated += 1
            except Exception as e:
                print(f'❌ 迁移失败 {old_path}: {e}')
                failed += 1
    
    print(f'\n=== 迁移统计 ===')
    print(f'迁移: {migrated}')
    print(f'跳过: {skipped}')
    print(f'失败: {failed}')
    
    return migrated, skipped, failed, scripts_map

if __name__ == '__main__':
    scripts_root = os.path.dirname(__file__)
    inventory_path = os.path.join(scripts_root, '_migration-inventory.csv')
    package_json_path = os.path.join(os.path.dirname(__file__), '..', 'package.json')
    husky_dir = os.path.join(os.path.dirname(__file__), '..', '.husky')
    
    scripts = load_script_inventory(inventory_path)
    
    print(f'=== 脚本迁移执行 ===')
    print(f'总脚本数: {len(scripts)}')
    
    print('\n--- 执行迁移 ---')
    migrated, skipped, failed, scripts_map = migrate_scripts(scripts, scripts_root, dry_run=False)
    
    print('\n--- 更新 package.json ---')
    pkg_updated = update_package_json(package_json_path, scripts_map)
    print(f'更新 {pkg_updated} 个脚本引用')
    
    print('\n--- 更新 .husky/ ---')
    husky_updated = update_husky_scripts(husky_dir, scripts_map)
    print(f'更新 {husky_updated} 个 hook 引用')
    
    print('\n✅ 脚本迁移完成')