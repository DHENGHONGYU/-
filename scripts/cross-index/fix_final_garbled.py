from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/explanation/design/registry-index.md',
]

fixes = {
    '报告�?2026': '报告/2026',
    '历�?Bug': '历史Bug',
    '清单�?026': '清单 /2026',
}

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for old, new in fixes.items():
        content = content.replace(old, new)
    
    if content != original:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"No changes needed for {filepath}")

for filepath in files_to_fix:
    fix_file(filepath)

print("\nDone!")