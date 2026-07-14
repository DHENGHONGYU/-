import os
import csv
import json
import re
from datetime import datetime

SCRIPT_TYPES = [
    {'name': 'audit', 'patterns': ['audit-', 'audit_', '-audit'], 'subdir': 'audit'},
    {'name': 'verify', 'patterns': ['verify-', 'verify_', '-verify'], 'subdir': 'verify'},
    {'name': 'generate', 'patterns': ['generate-', 'generate_', '-generate'], 'subdir': 'generate'},
    {'name': 'fix', 'patterns': ['fix-', 'fix_', '-fix'], 'subdir': 'fix'},
    {'name': 'doc', 'patterns': ['doc-', 'doc_', '-doc', 'docs'], 'subdir': 'docs-tool'},
    {'name': 'test', 'patterns': ['test-', 'test_', '-test'], 'subdir': 'test-tool'},
    {'name': 'quality', 'patterns': ['quality', 'complexity', 'lint', 'eslint'], 'subdir': 'quality'},
    {'name': 'security', 'patterns': ['security', 'acl', 'mcp'], 'subdir': 'security'},
    {'name': 'config', 'patterns': ['config', 'settings'], 'subdir': 'config'},
    {'name': 'migrate', 'patterns': ['migrate', 'migration'], 'subdir': 'migrate'},
    {'name': 'automation', 'patterns': ['automation-', 'automation_'], 'subdir': 'automation'},
    {'name': 'build', 'patterns': ['build', 'deploy'], 'subdir': 'build'},
    {'name': 'monitor', 'patterns': ['monitor', 'health', 'check'], 'subdir': 'monitor'},
]

def detect_script_type(filename):
    lower_name = filename.lower()
    if lower_name.startswith('_'):
        return {'type': 'debug', 'subdir': '_debug'}
    for script_type in SCRIPT_TYPES:
        for pattern in script_type['patterns']:
            if pattern in lower_name:
                return {'type': script_type['name'], 'subdir': script_type['subdir']}
    return {'type': 'other', 'subdir': 'other'}

def extract_description(content):
    match = re.match(r'^(\/\/.*|#.*)', content, re.MULTILINE)
    return match.group(1).lstrip('//# ').strip() if match else ''

def extract_dependencies(content):
    deps = set()
    for match in re.finditer(r"import\s+(?:\{[^}]+\}\s+from\s+)?['\"]([^'\"]+)['\"]", content):
        dep = match.group(1)
        if not dep.startswith(('@/', '.', '/')):
            deps.add(dep)
    for match in re.finditer(r"require\(['\"]([^'\"]+)['\"]\)", content):
        dep = match.group(1)
        if not dep.startswith(('.', '/')):
            deps.add(dep)
    return list(deps)

def is_registered_in_package_json(filename, package_json):
    script_name = filename
    for ext in ['.ts', '.js', '.mjs', '.cjs', '.sh', '.py', '.ps1']:
        if script_name.endswith(ext):
            script_name = script_name[:-len(ext)]
            break
    for key, value in package_json.get('scripts', {}).items():
        if filename in value or script_name in value:
            return True
    return False

def scan_scripts(scripts_root, package_json):
    results = []
    for root, dirs, files in os.walk(scripts_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'security']]
        for filename in files:
            ext = os.path.splitext(filename)[1]
            if ext not in ['.ts', '.js', '.mjs', '.cjs', '.sh', '.py', '.ps1']:
                continue
            full_path = os.path.join(root, filename)
            rel_path = os.path.relpath(full_path, scripts_root).replace('\\', '/')
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                stats = os.stat(full_path)
                script_info = detect_script_type(filename)
                registered = is_registered_in_package_json(filename, package_json)
                description = extract_description(content)
                dependencies = extract_dependencies(content)
                results.append({
                    'old_path': rel_path,
                    'filename': filename,
                    'size': stats.st_size,
                    'last_modified': datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    'script_type': script_info['type'],
                    'target_subdir': script_info['subdir'],
                    'package_json_registered': 'true' if registered else 'false',
                    'dependencies': '; '.join(dependencies),
                    'description': description
                })
            except Exception as e:
                print(f'Error reading {full_path}: {e}')
    return results

def write_csv(scripts, output_path):
    headers = ['old_path', 'filename', 'size', 'last_modified', 'script_type', 'target_subdir', 'package_json_registered', 'dependencies', 'description']
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(scripts)
    print(f'Wrote {len(scripts)} entries to {output_path}')

def create_subdirectories(scripts_root):
    subdirs = ['audit', 'verify', 'generate', 'fix', 'docs-tool', 'test-tool', 'quality', 'security', 'config', 'migrate', 'automation', 'build', 'monitor', '_debug', 'other']
    for subdir in subdirs:
        dir_path = os.path.join(scripts_root, subdir)
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f'Created {subdir}/')
        else:
            print(f'Exists {subdir}/')

if __name__ == '__main__':
    scripts_root = os.path.dirname(__file__)
    package_json_path = os.path.join(os.path.dirname(__file__), '..', 'package.json')
    output_path = os.path.join(scripts_root, '_migration-inventory.csv')
    
    print('=== Creating subdirectories ===')
    create_subdirectories(scripts_root)
    
    with open(package_json_path, 'r', encoding='utf-8') as f:
        package_json = json.load(f)
    
    scripts = scan_scripts(scripts_root, package_json)
    write_csv(scripts, output_path)
    
    print(f'\n=== Script Inventory Statistics ===')
    print(f'Total scripts: {len(scripts)}')
    
    type_counts = {}
    for script in scripts:
        type_counts[script['script_type']] = type_counts.get(script['script_type'], 0) + 1
    
    print('Type distribution:')
    for type_name, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f'  {type_name}: {count}')