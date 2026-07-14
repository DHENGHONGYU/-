import os
import json
import re

def validate_package_json_scripts(package_json_path, scripts_root):
    with open(package_json_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
    
    valid_count = 0
    missing_count = 0
    warnings = []
    
    for script_name, script_value in pkg.get('scripts', {}).items():
        matches = re.findall(r'scripts/([\w\-/]+)\.(ts|js|mjs|cjs|sh|py|ps1)', script_value)
        for match in matches:
            script_path = os.path.join(scripts_root, match[0]) + '.' + match[1]
            if os.path.exists(script_path):
                valid_count += 1
            else:
                missing_count += 1
                warnings.append(f'❌ {script_name}: {script_path}')
    
    print(f'=== package.json 脚本路径验证 ===')
    print(f'有效路径: {valid_count}')
    print(f'缺失路径: {missing_count}')
    
    if warnings:
        print('\n警告列表:')
        for warning in warnings[:20]:
            print(warning)
        if len(warnings) > 20:
            print(f'... 还有 {len(warnings) - 20} 个警告')
    
    return valid_count, missing_count, warnings

def validate_script_imports(scripts_root):
    issues = []
    
    for root, dirs, files in os.walk(scripts_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git']]
        
        for filename in files:
            if not filename.endswith(('.ts', '.js', '.mjs', '.cjs')):
                continue
            
            full_path = os.path.join(root, filename)
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                relative_imports = re.findall(r"from\s+['\"](\.\.?/[^'\"]+)['\"]", content)
                relative_imports += re.findall(r"require\(['\"](\.\.?/[^'\"]+)['\"]\)", content)
                
                for imp in relative_imports:
                    abs_imp_path = os.path.normpath(os.path.join(root, imp))
                    if not os.path.exists(abs_imp_path) and not os.path.exists(abs_imp_path + '.ts') and not os.path.exists(abs_imp_path + '.js'):
                        issues.append(f'❌ {os.path.relpath(full_path, scripts_root)} -> {imp}')
            except Exception as e:
                issues.append(f'⚠️ 读取失败 {filename}: {e}')
    
    print(f'\n=== 脚本相对导入验证 ===')
    print(f'导入问题: {len(issues)}')
    
    if issues:
        print('\n问题列表:')
        for issue in issues[:20]:
            print(issue)
        if len(issues) > 20:
            print(f'... 还有 {len(issues) - 20} 个问题')
    
    return issues

def count_scripts_per_category(scripts_root):
    categories = {}
    
    for dir_name in os.listdir(scripts_root):
        dir_path = os.path.join(scripts_root, dir_name)
        if os.path.isdir(dir_path) and not dir_name.startswith('.'):
            script_count = len([f for f in os.listdir(dir_path) if f.endswith(('.ts', '.js', '.mjs', '.cjs', '.sh', '.py', '.ps1'))])
            if script_count > 0:
                categories[dir_name] = script_count
    
    print(f'\n=== 脚本分类统计 ===')
    total = sum(categories.values())
    for category, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f'  {category}: {count}')
    print(f'  总计: {total}')
    
    return categories

if __name__ == '__main__':
    scripts_root = os.path.dirname(__file__)
    package_json_path = os.path.join(os.path.dirname(__file__), '..', 'package.json')
    
    print('=== 脚本冒烟测试（文件级别验证） ===\n')
    
    count_scripts_per_category(scripts_root)
    
    validate_package_json_scripts(package_json_path, scripts_root)
    
    validate_script_imports(scripts_root)
    
    print('\n✅ 脚本冒烟测试完成')