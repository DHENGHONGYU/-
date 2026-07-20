from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/reference/meta/registry-index.md'
full_path = BASE_DIR / filepath

with open(full_path, "r", encoding="utf-8") as f:
    content = f.read()

test_strings = [
    'bæ¹æ¬¡é«ä»·å¼å­¤å¿éæç¶ææ¥å',
    'b批次高价值孤儿集成状态报告',
    'åå¸è®¡åä¸è¯å®',
    '发布计划与评审',
    'æ¹æ¬¡',
    '批次'
]

print("Checking if garbled strings exist in file:")
for s in test_strings:
    exists = s in content
    print(f"  '{s}': {exists}")

print("\nSample from content:")
lines = content.split('\n')
for i, line in enumerate(lines[230:235], 231):
    print(f"  Line {i}: {line}")

print("\nChecking if '批次' already exists:")
if '批次' in content:
    print("  '批次' FOUND in file!")
else:
    print("  '批次' NOT found")