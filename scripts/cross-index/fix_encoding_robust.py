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
        print(f"  Already valid UTF-8")
        return False
    except UnicodeDecodeError:
        pass
    
    latin1_str = raw_bytes.decode('latin-1')
    restored_bytes = latin1_str.encode('latin-1')
    
    try:
        utf8_str = restored_bytes.decode('utf-8')
        with open(full_path, "wb") as f:
            f.write(utf8_str.encode('utf-8'))
        print(f"  FIXED: latin-1 misinterpretation -> UTF-8")
        return True
    except UnicodeDecodeError:
        pass
    
    print(f"  Mixed encoding detected, trying character-by-character fix...")
    result = bytearray()
    i = 0
    while i < len(restored_bytes):
        if i + 3 <= len(restored_bytes):
            try:
                char = restored_bytes[i:i+3].decode('utf-8')
                result.extend(restored_bytes[i:i+3])
                i += 3
                continue
            except:
                pass
        if i + 2 <= len(restored_bytes):
            try:
                char = restored_bytes[i:i+2].decode('utf-8')
                result.extend(restored_bytes[i:i+2])
                i += 2
                continue
            except:
                pass
        result.extend(restored_bytes[i:i+1])
        i += 1
    
    with open(full_path, "wb") as f:
        f.write(bytes(result))
    print(f"  FIXED with character-by-character approach")
    return True

def main():
    for filepath in files_to_fix:
        print(f"\nProcessing: {filepath}")
        success = fix_encoding(filepath)
        if success:
            try:
                with open(BASE_DIR / filepath, "r", encoding="utf-8") as f:
                    sample = f.read()[:100]
                print(f"  Sample: {sample}")
            except:
                print("  Could not read sample")

if __name__ == "__main__":
    main()