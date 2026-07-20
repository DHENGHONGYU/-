from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

def fix_encoding(filepath):
    full_path = BASE_DIR / filepath
    
    with open(full_path, "r", encoding="latin-1") as f:
        content_latin1 = f.read()
    
    content_bytes = content_latin1.encode("latin-1")
    
    try:
        content_utf8 = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        print(f"  ERROR: Cannot decode as UTF-8")
        return False
    
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content_utf8)
    
    print(f"  FIXED encoding: latin-1 -> utf-8")
    return True

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        success = fix_encoding(filepath)
        if success:
            sample = ""
            with open(BASE_DIR / filepath, "r", encoding="utf-8") as f:
                sample = f.read()[:100]
            print(f"  Sample after fix: {sample}")

if __name__ == "__main__":
    main()