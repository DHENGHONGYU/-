import os
import json
import csv
import re

def verify_doc_integrity(docs_root):
    print('=== 文档完整性校验 ===')
    
    issues = []
    total_files = 0
    empty_files = 0
    large_files = 0
    
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '_generated']]
        
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
                    issues.append(f'❌ 空文件: {os.path.relpath(full_path, docs_root)}')
                
                if len(content) > 500000:
                    large_files += 1
                    issues.append(f'⚠️ 大文件 (>500KB): {os.path.relpath(full_path, docs_root)} ({len(content)} bytes)')
            except Exception as e:
                issues.append(f'❌ 读取失败: {os.path.relpath(full_path, docs_root)} - {e}')
    
    print(f'📊 总文件数: {total_files}')
    print(f'📊 空文件数: {empty_files}')
    print(f'📊 大文件数: {large_files}')
    
    if issues:
        print('\n问题列表:')
        for issue in issues[:10]:
            print(issue)
        if len(issues) > 10:
            print(f'... 还有 {len(issues) - 10} 个问题')
    
    return len(issues) == 0

def verify_cross_references(docs_root):
    print('\n=== 交叉引用校验 ===')
    
    all_files = []
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '_generated']]
        for f in files:
            if f.endswith('.md'):
                rel_path = os.path.relpath(os.path.join(root, f), docs_root).replace('\\', '/')
                all_files.append(rel_path)
    
    broken_refs = []
    checked_files = 0
    
    for rel_path in all_files:
        full_path = os.path.join(docs_root, rel_path)
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            matches = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
            for _, link in matches:
                if link.startswith(('http://', 'https://', 'mailto:', '#')):
                    continue
                
                if link.startswith('./'):
                    link_path = os.path.normpath(os.path.join(os.path.dirname(rel_path), link[2:])).replace('\\', '/')
                elif link.startswith('../'):
                    link_path = os.path.normpath(os.path.join(os.path.dirname(rel_path), link)).replace('\\', '/')
                elif link.startswith('docs/'):
                    link_path = link[5:]
                else:
                    link_path = link
                
                if link_path not in all_files and not os.path.exists(os.path.join(docs_root, link_path)):
                    broken_refs.append(f'❌ {rel_path} -> {link}')
            
            checked_files += 1
        except Exception as e:
            print(f'⚠️ 检查失败: {rel_path} - {e}')
    
    print(f'📊 检查文件数: {checked_files}')
    print(f'📊 损坏引用数: {len(broken_refs)}')
    
    if broken_refs:
        print('\n损坏引用列表:')
        for ref in broken_refs[:15]:
            print(ref)
        if len(broken_refs) > 15:
            print(f'... 还有 {len(broken_refs) - 15} 个损坏引用')
    
    return len(broken_refs) == 0

def verify_script_imports(scripts_root):
    print('\n=== 脚本导入校验 ===')
    
    issues = []
    
    for root, dirs, files in os.walk(scripts_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git']]
        
        for filename in files:
            if not filename.endswith(('.ts', '.js', '.mjs', '.cjs')):
                continue
            
            full_path = os.path.join(root, filename)
            rel_path = os.path.relpath(full_path, scripts_root).replace('\\', '/')
            
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                relative_imports = re.findall(r"from\s+['\"](\.\.?/[^'\"]+)['\"]", content)
                relative_imports += re.findall(r"require\(['\"](\.\.?/[^'\"]+)['\"]\)", content)
                
                for imp in relative_imports:
                    abs_imp_path = os.path.normpath(os.path.join(root, imp))
                    if not os.path.exists(abs_imp_path) and not os.path.exists(abs_imp_path + '.ts') and not os.path.exists(abs_imp_path + '.js'):
                        issues.append(f'❌ {rel_path} -> {imp}')
            except Exception as e:
                issues.append(f'⚠️ 读取失败 {rel_path}: {e}')
    
    print(f'📊 导入问题数: {len(issues)}')
    
    if issues:
        print('\n问题列表:')
        for issue in issues[:15]:
            print(issue)
        if len(issues) > 15:
            print(f'... 还有 {len(issues) - 15} 个问题')
    
    return len(issues) == 0

def verify_directory_structure(docs_root):
    print('\n=== 目录结构校验 ===')
    
    expected_dirs = ['tutorials', 'how-to', 'reference', 'explanation', '00-meta', 'assets', 'reports', 'drafts', 'prompts', '07-archive']
    missing_dirs = []
    extra_dirs = []
    
    for dir_name in expected_dirs:
        dir_path = os.path.join(docs_root, dir_name)
        if not os.path.exists(dir_path):
            missing_dirs.append(dir_name)
    
    actual_dirs = [d for d in os.listdir(docs_root) if os.path.isdir(os.path.join(docs_root, d)) and not d.startswith('.')]
    
    print('📁 当前目录结构:')
    for dir_name in sorted(actual_dirs):
        file_count = len([f for f in os.listdir(os.path.join(docs_root, dir_name)) if f.endswith('.md')])
        print(f'  ✅ {dir_name}/ ({file_count} MD files)')
    
    if missing_dirs:
        print(f'\n❌ 缺失目录: {missing_dirs}')
        return False
    
    return True

def verify_package_json(package_json_path):
    print('\n=== package.json 校验 ===')
    
    with open(package_json_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
    
    scripts = pkg.get('scripts', {})
    
    deprecated_count = sum(1 for v in scripts.values() if v.startswith('# DEPRECATED'))
    valid_count = len(scripts) - deprecated_count
    
    print(f'📊 脚本总数: {len(scripts)}')
    print(f'📊 有效脚本: {valid_count}')
    print(f'📊 已标记废弃: {deprecated_count}')
    
    if deprecated_count > 5:
        print('⚠️ 过多废弃脚本')
        return False
    
    return True

def main():
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    scripts_root = os.path.dirname(__file__)
    package_json_path = os.path.join(os.path.dirname(__file__), '..', 'package.json')
    
    print('=' * 70)
    print('🔍 P1 二次校对与测试')
    print('=' * 70)
    
    checks = [
        ('文档完整性', verify_doc_integrity(docs_root)),
        ('交叉引用', verify_cross_references(docs_root)),
        ('脚本导入', verify_script_imports(scripts_root)),
        ('目录结构', verify_directory_structure(docs_root)),
        ('package.json', verify_package_json(package_json_path)),
    ]
    
    print('\n' + '=' * 70)
    print('📋 校对结果')
    print('=' * 70)
    
    all_passed = True
    for name, passed in checks:
        status = '✅ PASS' if passed else '❌ FAIL'
        print(f'  {status}: {name}')
        if not passed:
            all_passed = False
    
    print('\n' + '=' * 70)
    if all_passed:
        print('🎉 所有校对项通过！可以进入下一阶段')
    else:
        print('⚠️ 部分校对项未通过，需要修复')
    print('=' * 70)
    
    return all_passed

if __name__ == '__main__':
    main()