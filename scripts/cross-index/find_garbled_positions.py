import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_search = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

garbled_chars = ['ä', 'æ', 'ç', 'â', 'ã', 'å', 'ê', 'ë', 'è']

def find_garbled_in_file(filepath):
    full_path = BASE_DIR / filepath
    with open(full_path, "r", encoding="utf-8", errors='replace') as f:
        lines = f.readlines()
    
    print(f"\n=== {filepath} ===")
    for i, line in enumerate(lines, 1):
        if any(c in line for c in garbled_chars):
            print(f"Line {i}: {line.strip()}")

def main():
    for filepath in files_to_search:
        find_garbled_in_file(filepath)

if __name__ == "__main__":
    main()