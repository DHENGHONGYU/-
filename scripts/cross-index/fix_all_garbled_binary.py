from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

files_to_fix = [
    'docs/reference/meta/registry-index.md',
    'docs/explanation/design/registry-index.md',
    'docs/00-meta/REGISTRY_INDEX.md'
]

binary_replacements = [
    (b'\xc3\xa6\xc2\x89\xc2\xb9\xc3\xa6\xc2\xac\xc2\xa1', '批次'.encode('utf-8')),
    (b'\xc3\xa9\xc2\xab\xc2\x98\xc3\xa4\xc2\xbb\xc2\xb7\xc3\xa5\xc2\x80\xc2\xbc', '高价值'.encode('utf-8')),
    (b'\xc3\xa5\xc2\xad\xc2\xa4\xc3\xa5\xc2\x84\xc2\xbf', '孤儿'.encode('utf-8')),
    (b'\xc3\xa9\xc2\x9b\xc2\x86\xc3\xa6\xc2\x88\xc2\x90', '集成'.encode('utf-8')),
    (b'\xc3\xa7\xc2\x8a\xc2\xb6\xc3\xa6\xc2\x80\xc2\x81', '状态'.encode('utf-8')),
    (b'\xc3\xa6\xc2\x8a\xc2\xa5\xc3\xa5\xc2\x91', '报告'.encode('utf-8')),
    (b'\xc3\xa5\xc2\x8f\xc2\x91\xc3\xa5\xc2\x87\xc2\xba', '发布'.encode('utf-8')),
    (b'\xc3\xa8\xc2\xae\xc2\xa1\xc3\xa5\xc2\x88\xc2\x92', '计划'.encode('utf-8')),
    (b'\xc3\xa4\xc2\xb8\xc2\x8e', '与'.encode('utf-8')),
    (b'\xc3\xa8\xc2\xaf\xc2\x84\xc3\xa8\xc2\xae\xc2\xa1', '评审'.encode('utf-8')),
    (b'\xc3\xa5\xc2\x9b\xc2\x9e', '回'.encode('utf-8')),
    (b'\xc3\xa6\xc2\xbb\xc2\xa4', '滚'.encode('utf-8')),
    (b'\xc3\xa6\xc2\x96\xc2\xb9\xc3\xa6\xc2\xa1\xc2\x88', '方案'.encode('utf-8')),
    (b'\xc3\xa6\xc2\xbc\xc2\x94\xc3\xa7\xc2\xbb\xc2\x83', '演练'.encode('utf-8')),
    (b'\xc3\xa4\xc2\xbd\xc2\x93\xc3\xa4\xc2\xbd\xc2\x93', '体系'.encode('utf-8')),
    (b'\xc3\xa7\xc2\xb3\xc2\xbb', '化'.encode('utf-8')),
    (b'\xc3\xa4\xc2\xb8\xc2\x8a\xc3\xa7\xc2\xba\xc2\xbf', '上线'.encode('utf-8')),
    (b'\xc3\xa6\xc2\xb5\xc2\x8b\xc2\x8a', '测试'.encode('utf-8')),
    (b'\xc3\xa7\xc2\xbb\xc2\xbc\xc3\xa5\xc2\x90\xc2\x88', '综合'.encode('utf-8')),
    (b'\xc3\xa9\xc2\xaa\xc2\x8c\xc2\x81', '验证'.encode('utf-8')),
    (b'\xc3\xa5\xc2\xae\xc2\x9a\xc3\xa4\xc2\xbd\xc2\x8d', '定位'.encode('utf-8')),
    (b'\xc3\xa5\xc2\x88\xc2\x86\xc3\xa6\xc2\x9e\xc2\x90', '分析'.encode('utf-8')),
    (b'\xc3\xa6\xc2\x96\xc2\x87\xc3\xa6\xc2\xa1\xc2\xa3', '文档'.encode('utf-8')),
    (b'\xc3\xa6\xc2\x95\xc2\xb4\xc3\xa7\xc2\x90\xc2\x86', '整理'.encode('utf-8')),
    (b'\xc3\xa4\xc2\xba\xc2\x94\xc3\xa4\xc2\xba\xc2\x8c', '五大'.encode('utf-8')),
    (b'\xc3\xa6\xc2\xb2\xc2\xb9\xc3\xa6\xc2\xb6\xc2\xa1', '油脂'.encode('utf-8')),
    (b'\xc3\xa5\xc2\xb9\xc2\xb3\xc3\xa5\xc2\x8f\xc2\xb0', '平台'.encode('utf-8')),
    (b'\xc3\xa8\xc2\xae\xc2\xbe\xc3\xa8\xc2\xae\xc2\xa1', '设计'.encode('utf-8')),
    (b'\xc3\xa4\xc2\xb8\xc2\x80\xc3\xa8\xc2\x87\xc2\xb4', '一致'.encode('utf-8')),
    (b'\xc3\xa6\xc2\x80\xc2\xa7', '性'.encode('utf-8')),
    (b'\xc3\xa5\xc2\xae\xc2\xa1', '审核'.encode('utf-8'))
]

def fix_file(filepath):
    full_path = BASE_DIR / filepath
    
    with open(full_path, "rb") as f:
        content = f.read()
    
    original = content
    changes = 0
    
    for old, new in binary_replacements:
        if old in content:
            content = content.replace(old, new)
            changes += 1
            print(f"  REPLACED: {old.hex()} ({old.decode('utf-8', errors='replace')}) -> {new.hex()} ({new.decode('utf-8')})")
    
    if content != original:
        with open(full_path, "wb") as f:
            f.write(content)
    
    return changes

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