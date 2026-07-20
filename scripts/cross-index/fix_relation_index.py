from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

filepath = 'docs/00-meta/ai-index/relation-index.json'
full_path = BASE_DIR / filepath

with open(full_path, "rb") as f:
    content = f.read()

content_str = content.decode('utf-8')

replacements = [
    ('å\x8f\x91å¸\x83è®¡å\x88\x92ä¸\x8eè¯\x84å®', '发布计划与评审'),
    ('å\x9b\x9eæ»\x9aæ\x96¹æ¡\x88ä¸\x8eæ¼\x94ç»', '回滚方案与演练')
]

original = content_str
for old, new in replacements:
    content_str = content_str.replace(old, new)

if content_str != original:
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content_str)
    print("FIXED relation-index.json")
else:
    print("No changes needed")