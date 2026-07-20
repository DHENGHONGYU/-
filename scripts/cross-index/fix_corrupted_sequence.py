from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

corrupted_patterns = [
    (b'\xe3\x80\x3f', b'\xe3\x80\x80'),
    (b'\xe3\x80\x0a', b'\xe3\x80\x80'),
    (b'\xe3\x80\x0d', b'\xe3\x80\x80'),
]

for filepath in files_to_fix:
    full_path = BASE_DIR / filepath
    with open(full_path, "rb") as f:
        content = f.read()
    
    original_len = len(content)
    for old, new in corrupted_patterns:
        content = content.replace(old, new)
    
    if len(content) != original_len:
        with open(full_path, "wb") as f:
            f.write(content)
        print(f"Fixed {filepath}: {original_len} -> {len(content)} bytes")
    else:
        print(f"No changes needed for {filepath}")

    try:
        with open(full_path, "r", encoding="utf-8") as f:
            f.read()
        print(f"UTF-8 validation passed for {filepath}")
    except UnicodeDecodeError as e:
        print(f"UTF-8 validation failed for {filepath}: {e}")