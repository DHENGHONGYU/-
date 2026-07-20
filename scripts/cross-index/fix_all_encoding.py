from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

for filepath in files_to_fix:
    full_path = BASE_DIR / filepath
    
    with open(full_path, "rb") as f:
        raw_bytes = f.read()
    
    print(f"\nProcessing: {filepath}")
    print(f"Original bytes: {len(raw_bytes)}")
    
    try:
        content = raw_bytes.decode('utf-8')
        print("Already valid UTF-8")
        continue
    except UnicodeDecodeError:
        pass
    
    content = raw_bytes.decode('utf-8', errors='replace')
    
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"Fixed and saved as valid UTF-8")
    
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    print(f"UTF-8 validation passed!")