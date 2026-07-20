from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_check = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

garbled_chars = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

for filepath in files_to_check:
    full_path = BASE_DIR / filepath
    with open(full_path, "rb") as f:
        content_bytes = f.read()
    
    content = content_bytes.decode('latin-1')
    
    lines = content.split('\n')
    print(f"\n=== {filepath} ===")
    found = False
    for i, line in enumerate(lines, 1):
        has_garbled = any(c in line for c in garbled_chars)
        has_question = '?' in line and '.md' in line
        if has_garbled or has_question:
            print(f"Line {i}: {line.strip()}")
            found = True
    if not found:
        print("  No garbled or problematic links found")