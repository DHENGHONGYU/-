import os
import shutil

GENERATED_EXTENSIONS = ['.html', '.json']

def move_generated_files(docs_root):
    generated_dir = os.path.join(docs_root, 'reports', '_generated')
    if not os.path.exists(generated_dir):
        os.makedirs(generated_dir)
    
    moved = 0
    
    print('=== 移动自动产物至 _generated/ ===')
    
    for root, dirs, files in os.walk(os.path.join(docs_root, 'reports')):
        dirs[:] = [d for d in dirs if d not in ['_generated']]
        
        for filename in files:
            ext = os.path.splitext(filename)[1]
            if ext in GENERATED_EXTENSIONS and filename.startswith(('audit-', 'verify-', 'mock-', 'automation-pipeline-', 'directory-audit-', 'directory-scan-', 'directory-update-', 'directory-validate-', 'jsdoc-audit-', 'debug-output-')):
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, os.path.join(docs_root, 'reports'))
                dest_path = os.path.join(generated_dir, filename)
                
                shutil.move(full_path, dest_path)
                print(f'✅ {rel_path} -> _generated/{filename}')
                moved += 1
    
    print(f'\n移动文件数: {moved}')
    return moved

def update_gitignore(project_root):
    gitignore_path = os.path.join(project_root, '.gitignore')
    
    with open(gitignore_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_rules = """
# Generated artifacts in docs/reports/
docs/reports/_generated/
docs/reports/**/*.html
docs/reports/automation-pipeline/*.json
"""
    
    if 'docs/reports/_generated/' not in content:
        content += new_rules
        
        with open(gitignore_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print('✅ 更新 .gitignore')
    else:
        print('⚠️ .gitignore 已包含规则')

if __name__ == '__main__':
    project_root = os.path.dirname(os.path.dirname(__file__))
    docs_root = os.path.join(project_root, 'docs')
    
    print('=== P1-3: 隔离自动产物 ===')
    
    move_generated_files(docs_root)
    
    update_gitignore(project_root)
    
    print('\n✅ P1-3 隔离自动产物完成')