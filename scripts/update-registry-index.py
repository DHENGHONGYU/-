import os
import re

def update_registry_index(docs_root):
    registry_path = os.path.join(docs_root, '00-meta', 'REGISTRY_INDEX.md')
    
    with open(registry_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    updated_content = content
    
    path_mappings = {
        '《功能模块数据契约》.md': '../reference/《功能模块数据契约》.md',
        '《DataBridge端点与数据映射清单》.md': '../reference/《DataBridge端点与数据映射清单》.md',
        '《V9 代码实现分析报告》.md': '../explanation/《V9 代码实现分析报告》.md',
        '《V9 架构覆盖分析报告》.md': '../explanation/《V9 架构覆盖分析报告》.md',
        '《V9 架构缺陷与整改行动清单》.md': '../explanation/《V9 架构缺陷与整改行动清单》.md',
        '《V9 目标功能清单》.md': '../explanation/《V9 目标功能清单》.md',
        '《V9核心数据字典与类型定义（整合版）》.md': '../reference/《V9核心数据字典与类型定义（整合版）》.md',
        '《V9数据架构修订建议》.md': '../reference/《V9数据架构修订建议》.md',
        '《V9现有数据资产清单》.md': '../reference/《V9现有数据资产清单》.md',
        '01-vision-and-goals.md': '../explanation/01-vision-and-goals.md',
        '02-functional-specs.md': '../reference/02-functional-specs.md',
        '03-architecture-standards.md': '../explanation/03-architecture-standards.md',
        '04-ui-ux-specs.md': '../reference/04-ui-ux-specs.md',
        '05-engine-specs.md': '../reference/05-engine-specs.md',
        '06-routing-specs.md': '../reference/06-routing-specs.md',
        '07-operation-strategy.md': '../reference/07-operation-strategy.md',
        '08-implementation-plan.md': '../reference/08-implementation-plan.md',
        '09-quality-gates.md': '../explanation/09-quality-gates.md',
        '10-glossary.md': '../explanation/10-glossary.md',
        '变更摘要-2026-06-28-Phase0-数据层改造.md': '../reports/changelogs/变更摘要-2026-06-28-Phase0-数据层改造.md',
        '踩坑规则门禁指南.md': '../reference/踩坑规则门禁指南.md',
        '数据治理路线图.md': '../reference/数据治理路线图.md',
        '文件整理清单.md': '../reference/文件整理清单.md',
    }
    
    for old_path, new_path in path_mappings.items():
        updated_content = updated_content.replace(f'({old_path})', f'({new_path})')
    
    with open(registry_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print('✅ 更新 REGISTRY_INDEX.md')

def rebuild_registry_index(docs_root):
    registry_path = os.path.join(docs_root, '00-meta', 'REGISTRY_INDEX.md')
    
    all_files = []
    for root, dirs, files in os.walk(docs_root):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '_generated']]
        for f in files:
            if f.endswith('.md') and not f.startswith('_') and not f.startswith('.'):
                rel_path = os.path.relpath(os.path.join(root, f), docs_root).replace('\\', '/')
                all_files.append((f, rel_path))
    
    all_files.sort(key=lambda x: x[0])
    
    content = """# 文档索引

> 本文件由每日文档验证流程自动生成，请勿手动修改。

## 目录

"""
    
    for filename, rel_path in all_files:
        if rel_path.startswith('00-meta/'):
            continue
        
        link_path = os.path.relpath(rel_path, '00-meta').replace('\\', '/')
        
        content += f"""### {filename}

- [{filename.replace('.md', '')}]({link_path})

"""
    
    with open(registry_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✅ 重新生成 REGISTRY_INDEX.md ({len(all_files)} 个文件)')

if __name__ == '__main__':
    docs_root = os.path.join(os.path.dirname(__file__), '..', 'docs')
    
    print('=== 更新文档索引 ===')
    
    rebuild_registry_index(docs_root)
    
    print('\n✅ 索引更新完成')