from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

hex_replacements = [
    (b'\xc3\xa5\xc2\x8f\xc2\x91\xc3\xa5\xc2\x87\xc2\xba\xc3\xa8\xc2\xae\xc2\xa1\xc3\xa5\xc2\x88\xc2\x92\xc3\xa4\xc2\xb8\xc2\x8e\xc3\xa8\xc2\xaf\xc2\x84\xc3\xa8\xc2\xae\xc2\xa1', '发布计划与评审'.encode('utf-8')),
    (b'\xc3\xa5\xc2\x9b\xc2\x9e\xc3\xa6\xc2\xbb\xc2\xa4\xc3\xa6\xc2\x96\xc2\xb9\xc3\xa6\xc2\xa1\xc2\x88\xc2\xa4\xc3\xa4\xc2\xb8\xc2\x8e\xc3\xa6\xc2\xbc\xc2\x94\xc3\xa7\xc2\xbb\xc2\x83', '回滚方案与演练'.encode('utf-8'))
]

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    
    with open(full_path, "rb") as f:
        content = f.read()
    
    original_content = content
    changes_made = 0
    
    for old, new in hex_replacements:
        if old in content:
            content = content.replace(old, new)
            changes_made += 1
            print(f"  REPLACED: {len(old)} bytes -> {len(new)} bytes")
    
    if content != original_content:
        with open(full_path, "wb") as f:
            f.write(content)
    
    return changes_made

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        changes = fix_file(filepath)
        if changes > 0:
            print(f"  Total changes: {changes}")
        else:
            print("  No changes needed")

if __name__ == "__main__":
    main()