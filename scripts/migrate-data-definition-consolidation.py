import os
import shutil

DATA_DEFINITION_FILES = [
    ('explanation/ai-center-data-definition.md', 'ai-center', 'AI 中心数据结构'),
    ('explanation/dataflow-data-definition.md', 'dataflow', '数据流定义'),
    ('explanation/multi-factor-screening-data-definition.md', 'screening', '多因子筛选'),
    ('explanation/news-data-definition.md', 'news', '新闻资讯'),
    ('explanation/seven-dim-config-data-definition.md', 'seven-dim-config', '七维配置'),
    ('docs/reference/backtest-data-definition.md', 'backtest', '回测数据'),
    ('docs/reference/risk-derived-data-definition.md', 'risk', '衍生风险'),
]

def update_data_dictionary_index(docs_root):
    index_path = os.path.join(docs_root, 'reference', 'DATA_DICTIONARY_INDEX.md')
    
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_section = """## 2. 独立域定义（命名规范 `*-data-definition.md`，合法，保留）

| 文件 | 归属子域 | 内容 |
|------|----------|------|
| `docs/explanation/ai-center-data-definition.md` | ai-center | AI 中心数据结构 |
| `docs/explanation/dataflow-data-definition.md` | dataflow | 数据流定义 |
| `docs/explanation/multi-factor-screening-data-definition.md` | screening | 多因子筛选 |
| `docs/explanation/news-data-definition.md` | news | 新闻资讯 |
| `docs/explanation/seven-dim-config-data-definition.md` | seven-dim-config | 七维配置 |
| `docs/reference/backtest-data-definition.md` | backtest | 回测数据 |
| `docs/reference/risk-derived-data-definition.md` | risk | 衍生风险 |

> **整合状态**：7 份独立域定义已全部登记，保持独立存在以避免过度合并导致维护困难。
> **引用规范**：新增域定义统一 `kebab-case` + `-data-definition.md` 后缀，并必须在此索引登记。
"""
    
    old_section_start = '## 2. 独立域定义（命名规范 `*-data-definition.md`，合法，保留）'
    old_section_end = '## 3. 统一数据模型锚点'
    
    start_idx = content.find(old_section_start)
    end_idx = content.find(old_section_end)
    
    if start_idx != -1 and end_idx != -1:
        new_content = content[:start_idx] + new_section + '\n' + content[end_idx:]
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print('✅ 更新 DATA_DICTIONARY_INDEX.md')
    else:
        print('❌ 未找到更新位置')

def deprecate_old_versions(docs_root):
    deprecated_dir = os.path.join(docs_root, '00-meta', 'deprecated-docs', 'old-versions')
    if not os.path.exists(deprecated_dir):
        os.makedirs(deprecated_dir)
    
    for rel_path, _, _ in DATA_DEFINITION_FILES:
        full_path = os.path.join(docs_root, rel_path)
        if os.path.exists(full_path):
            filename = os.path.basename(full_path)
            dest_path = os.path.join(deprecated_dir, f'{filename}.deprecated')
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            deprecation_header = f"""---
deprecated: true
deprecated_date: 2026-07-14
deprecated_reason: 已整合至 DATA_DICTIONARY_INDEX.md 索引，建议通过主索引访问
replaced_by: docs/reference/DATA_DICTIONARY_INDEX.md
---

# DEPRECATED - {filename}

> ⚠️ **此文件已废弃**（2026-07-14）
> 
> 数据定义已整合至 `docs/reference/DATA_DICTIONARY_INDEX.md`，请通过主索引访问最新定义。

---

"""
            
            new_content = deprecation_header + content
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f'✅ 标记废弃: {rel_path}')

if __name__ == '__main__':
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    
    print('=== P1-1: 数据定义去重整合 ===')
    
    update_data_dictionary_index(docs_root)
    
    deprecate_old_versions(docs_root)
    
    print('\n✅ P1-1 数据定义去重整合完成')