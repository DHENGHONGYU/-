from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

def fix_encoding(filepath):
    full_path = BASE_DIR / filepath
    
    with open(full_path, "rb") as f:
        raw_bytes = f.read()
    
    try:
        raw_bytes.decode('utf-8')
        print(f"  File is already valid UTF-8")
        return False
    except UnicodeDecodeError:
        pass
    
    try:
        latin1_str = raw_bytes.decode('latin-1')
        restored_bytes = latin1_str.encode('latin-1')
        utf8_str = restored_bytes.decode('utf-8')
        
        with open(full_path, "wb") as f:
            f.write(utf8_str.encode('utf-8'))
        
        print(f"  FIXED: latin-1 misinterpretation -> UTF-8")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        success = fix_encoding(filepath)
        if success:
            with open(BASE_DIR / filepath, "r", encoding="utf-8") as f:
                sample = f.read()[:100]
            print(f"  Sample: {sample}")

if __name__ == "__main__":
    main()