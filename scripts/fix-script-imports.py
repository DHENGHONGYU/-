import os
import re

def fix_script_imports(scripts_root):
    print('=== 修复脚本导入路径 ===')
    
    fixed = 0
    skipped = 0
    
    for root, dirs, files in os.walk(scripts_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git']]
        
        for filename in files:
            if not filename.endswith(('.ts', '.js', '.mjs', '.cjs')):
                continue
            
            full_path = os.path.join(root, filename)
            rel_path = os.path.relpath(full_path, scripts_root).replace('\\', '/')
            
            depth = rel_path.count('/')
            
            if depth == 0:
                skipped += 1
                continue
            
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                old_content = content
                
                for old_import, new_import in [
                    ("from '../src/", f"from '../{'../' * depth}src/"),
                    ("require('../src/", f"require('../{'../' * depth}src/"),
                    ("from '../scripts/", f"from '../{'../' * depth}scripts/"),
                    ("require('../scripts/", f"require('../{'../' * depth}scripts/"),
                ]:
                    content = content.replace(old_import, new_import)
                
                if content != old_content:
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f'✅ {rel_path}')
                    fixed += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f'❌ {rel_path}: {e}')
                skipped += 1
    
    print(f'\n修复: {fixed}, 跳过: {skipped}')
    return fixed

def fix_specific_imports(scripts_root):
    print('\n=== 修复特定导入路径 ===')
    
    fixes = {
        'docs-tool/doc-freshness-alert.ts': [
            ('from ./doc-notify', "from '../other/doc-notify'"),
        ],
        'docs-tool/llm-doc-generator.ts': [
            ('from ./semantic-validation', "from '../other/semantic-validation'"),
        ],
        'monitor/system-check-loop.ts': [
            ('from ./quality-config.js', "from '../quality/quality-config.js'"),
        ],
        'other/scaffold-widget.ts': [
            ("from './components/WidgetStateShell'", "from '../../src/components/WidgetStateShell'"),
        ],
        'other/split-constants.ts': [
            ("from './theme/theme.tokens.base'", "from '../../src/theme/theme.tokens.base'"),
            ("from './theme/theme.tokens.color'", "from '../../src/theme/theme.tokens.color'"),
            ("from './theme/theme.tokens.shades'", "from '../../src/theme/theme.tokens.shades'"),
        ],
    }
    
    fixed = 0
    
    for rel_path, import_fixes in fixes.items():
        full_path = os.path.join(scripts_root, rel_path)
        
        if not os.path.exists(full_path):
            print(f'⚠️ 文件不存在: {rel_path}')
            continue
        
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            old_content = content
            
            for old_import, new_import in import_fixes:
                content = content.replace(old_import, new_import)
            
            if content != old_content:
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'✅ {rel_path}')
                fixed += 1
        except Exception as e:
            print(f'❌ {rel_path}: {e}')
    
    print(f'\n修复: {fixed}')
    return fixed

if __name__ == '__main__':
    scripts_root = os.path.dirname(__file__)
    
    print('=== P1 脚本导入路径修复 ===')
    
    fix_script_imports(scripts_root)
    
    fix_specific_imports(scripts_root)
    
    print('\n✅ 脚本导入路径修复完成')