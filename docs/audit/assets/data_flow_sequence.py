# -*- coding: utf-8 -*-
"""
订单数据闭环 - 数据流转时序图生成器
五泳道：UI交互层、业务Store层、DataBridge事件总线、dataLayer持久化层、IndexedDB
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

# ============================================================
# 配置中文字体
# ============================================================
plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

# ============================================================
# 泳道定义
# ============================================================
LANES = [
    {"name": "UI交互层", "color": "#E3F2FD", "x": 0},
    {"name": "业务Store层", "color": "#FFF3E0", "x": 1},
    {"name": "DataBridge\n事件总线", "color": "#F3E5F5", "x": 2},
    {"name": "dataLayer\n持久化层", "color": "#E8F5E9", "x": 3},
    {"name": "IndexedDB", "color": "#FFEBEE", "x": 4},
]

LANE_WIDTH = 2.2
FIG_HEIGHT = 16
TIME_STEP = 0.7  # 每个步骤的时间间隔

# ============================================================
# 绘制辅助函数
# ============================================================

def draw_lane(ax, lane_idx, name, color, y_start, y_end):
    """绘制泳道背景和标题"""
    x = lane_idx * LANE_WIDTH
    # 泳道背景
    rect = FancyBboxPatch(
        (x, y_start), LANE_WIDTH, y_end - y_start,
        boxstyle="round,pad=0.02",
        facecolor=color, edgecolor='#90A4AE', linewidth=1.2, alpha=0.7
    )
    ax.add_patch(rect)
    # 泳道标题
    ax.text(
        x + LANE_WIDTH / 2, y_end + 0.2, name,
        ha='center', va='bottom', fontsize=11, fontweight='bold',
        color='#37474F'
    )
    # 虚线生命线
    ax.plot(
        [x + LANE_WIDTH / 2, x + LANE_WIDTH / 2],
        [y_start, y_end],
        linestyle=':', color='#B0BEC5', linewidth=1, zorder=1
    )


def draw_activation(ax, lane_idx, y_top, y_bottom, color='#90CAF9'):
    """绘制激活条（执行期）"""
    x = lane_idx * LANE_WIDTH + LANE_WIDTH / 2
    width = 0.15
    rect = mpatches.Rectangle(
        (x - width / 2, y_bottom), width, y_top - y_bottom,
        facecolor=color, edgecolor='#1565C0', linewidth=0.8, zorder=3
    )
    ax.add_patch(rect)


def draw_sync_arrow(ax, from_lane, to_lane, y_from, y_to, label, color='#1565C0', label_offset=(0, 0)):
    """绘制同步调用箭头（实线）"""
    x_from = from_lane * LANE_WIDTH + LANE_WIDTH / 2
    x_to = to_lane * LANE_WIDTH + LANE_WIDTH / 2
    
    arrow = FancyArrowPatch(
        (x_from, y_from), (x_to, y_to),
        arrowstyle='->', mutation_scale=15,
        color=color, linewidth=1.5, zorder=4
    )
    ax.add_patch(arrow)
    
    # 标签
    mid_x = (x_from + x_to) / 2 + label_offset[0]
    mid_y = (y_from + y_to) / 2 + label_offset[1]
    ax.text(
        mid_x, mid_y, label,
        ha='center', va='center', fontsize=8,
        bbox=dict(boxstyle='round,pad=0.2', facecolor='white',
                  edgecolor=color, alpha=0.9),
        zorder=5
    )


def draw_async_arrow(ax, from_lane, to_lane, y_from, y_to, label, color='#E65100', label_offset=(0, 0)):
    """绘制异步事件广播箭头（虚线）"""
    x_from = from_lane * LANE_WIDTH + LANE_WIDTH / 2
    x_to = to_lane * LANE_WIDTH + LANE_WIDTH / 2
    
    arrow = FancyArrowPatch(
        (x_from, y_from), (x_to, y_to),
        arrowstyle='->', mutation_scale=15,
        color=color, linewidth=1.5, linestyle='--', zorder=4
    )
    ax.add_patch(arrow)
    
    # 标签
    mid_x = (x_from + x_to) / 2 + label_offset[0]
    mid_y = (y_from + y_to) / 2 + label_offset[1]
    ax.text(
        mid_x, mid_y, label,
        ha='center', va='center', fontsize=8,
        bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFF3E0',
                  edgecolor=color, alpha=0.9),
        zorder=5
    )


def draw_return_arrow(ax, from_lane, to_lane, y_from, y_to, label, color='#558B2F'):
    """绘制返回箭头（细实线，开箭头）"""
    x_from = from_lane * LANE_WIDTH + LANE_WIDTH / 2
    x_to = to_lane * LANE_WIDTH + LANE_WIDTH / 2
    
    arrow = FancyArrowPatch(
        (x_from, y_from), (x_to, y_to),
        arrowstyle='->', mutation_scale=12,
        color=color, linewidth=1, linestyle='-', zorder=3, alpha=0.7
    )
    ax.add_patch(arrow)
    
    mid_x = (x_from + x_to) / 2
    mid_y = (y_from + y_to) / 2
    ax.text(
        mid_x, mid_y, label,
        ha='center', va='center', fontsize=7, color=color,
        style='italic', zorder=5
    )


def draw_issue_marker(ax, lane_idx, y, text, issue_type='error'):
    """绘制问题标记（红框警示）"""
    x = lane_idx * LANE_WIDTH + LANE_WIDTH / 2
    colors = {
        'error': ('#F44336', '#FFEBEE'),
        'warning': ('#FF9800', '#FFF8E1'),
        'info': ('#2196F3', '#E3F2FD')
    }
    border, bg = colors.get(issue_type, colors['error'])
    
    bbox_props = dict(
        boxstyle='round,pad=0.3', facecolor=bg,
        edgecolor=border, linewidth=1.5
    )
    prefix = {'error': '[!]', 'warning': '[!]', 'info': '[i]'}.get(issue_type, '[!]')
    ax.text(
        x, y, f"{prefix} {text}",
        ha='center', va='center', fontsize=7.5, color='#B71C1C',
        fontweight='bold', bbox=bbox_props, zorder=6
    )


def draw_time_gap(ax, y_pos, label, color='#7B1FA2'):
    """绘制关键时序缝隙标注"""
    x_start = 0.2
    x_end = len(LANES) * LANE_WIDTH - 0.2
    
    # 横向虚线
    ax.plot(
        [x_start, x_end], [y_pos, y_pos],
        linestyle='-.', color=color, linewidth=1.2, alpha=0.6, zorder=2
    )
    # 标注
    ax.text(
        x_end - 0.1, y_pos + 0.05, f"[时序] {label}",
        ha='right', va='bottom', fontsize=8, color=color,
        fontweight='bold',
        bbox=dict(boxstyle='round,pad=0.2', facecolor='#F3E5F5',
                  edgecolor=color, alpha=0.9),
        zorder=6
    )


# ============================================================
# 主绘图函数
# ============================================================

def draw_sequence_diagram(output_path='data_flow_sequence.png'):
    """绘制完整的订单数据流转时序图"""
    fig, ax = plt.subplots(1, 1, figsize=(14, FIG_HEIGHT))
    
    total_width = len(LANES) * LANE_WIDTH
    y_start = 0
    y_end = 14.5  # 总时间轴长度
    
    # 绘制泳道
    for i, lane in enumerate(LANES):
        draw_lane(ax, i, lane["name"], lane["color"], y_start, y_end)
    
    # ============================================================
    # 时序步骤定义（从上到下）
    # ============================================================
    # 时间节点（y坐标，从上往下递减）
    t = {}
    t['user_click'] = 14.0       # 用户点击新增订单
    t['store_save_call'] = 13.2  # Store调用dataLayer.save
    t['datalayer_forward'] = 12.4  # dataLayer调用dataBridge.forward
    t['bridge_routetodb'] = 11.6  # DataBridge调用routeToDB
    t['db_write'] = 10.8          # IndexedDB写入
    t['db_complete'] = 10.0       # 写入完成返回
    t['gap_persist_broadcast'] = 9.4  # 时序缝隙：持久化完成 vs 广播时机
    t['bridge_broadcast'] = 9.0   # DataBridge广播事件
    t['broadcast_gap'] = 8.5      # 广播时序缝隙标注
    
    # 各Store订阅回调
    t['orderstore_callback'] = 7.8  # orderStore收到广播
    t['orderstore_refresh'] = 7.2   # orderStore.refresh
    
    t['positionstore_callback'] = 6.6  # positionStore收到广播（频道不匹配）
    t['positionstore_issue'] = 6.0     # positionStore问题标注
    
    t['signalstore_callback'] = 5.4  # signalStore收到广播
    t['signalstore_issue'] = 4.8     # signalStore只打日志不刷新
    
    t['hotsector_missing'] = 4.2  # hotSectorStore无订阅
    t['valuepit_missing'] = 3.6   # valuePitStore无订阅
    
    t['ui_redraw'] = 2.8          # UI重绘
    t['end'] = 2.0                # 结束
    
    # ============================================================
    # 绘制激活条
    # ============================================================
    # Store层激活
    draw_activation(ax, 1, t['store_save_call'], t['orderstore_refresh'], '#FFB74D')
    # DataBridge激活
    draw_activation(ax, 2, t['datalayer_forward'], t['bridge_broadcast'], '#BA68C8')
    # dataLayer激活
    draw_activation(ax, 3, t['store_save_call'], t['db_complete'], '#81C784')
    # IndexedDB激活
    draw_activation(ax, 4, t['bridge_routetodb'], t['db_complete'], '#E57373')
    
    # ============================================================
    # 绘制消息流
    # ============================================================
    
    # 1. 用户点击新增订单
    draw_sync_arrow(ax, 0, 1, t['user_click'], t['store_save_call'],
                    '新增订单\nsaveOrder()', '#1565C0', (0, 0.15))
    
    # 2. Store调用dataLayer.save（同步）
    draw_sync_arrow(ax, 1, 3, t['store_save_call'], t['store_save_call'] - 0.3,
                    'dataLayer.save(order)', '#1565C0', (0.15, 0))
    
    # 3. dataLayer调用dataBridge.forward（同步）
    draw_sync_arrow(ax, 3, 2, t['datalayer_forward'], t['datalayer_forward'] - 0.3,
                    'dataBridge.forward\n(channel:"orders")', '#1565C0', (-0.15, 0))
    
    # 4. DataBridge调用routeToDB写入IndexedDB（同步）
    draw_sync_arrow(ax, 2, 4, t['bridge_routetodb'], t['db_write'],
                    'routeToDB()\n写入orders表', '#1565C0', (0.2, 0))
    
    # 5. IndexedDB写入完成返回
    draw_return_arrow(ax, 4, 2, t['db_complete'], t['db_complete'] + 0.3,
                      '写入成功 {ok:true}')
    
    draw_return_arrow(ax, 2, 3, t['db_complete'] + 0.3, t['db_complete'] + 0.6,
                      'resolve()')
    
    # ============================================================
    # 关键时序缝隙：先持久化后广播
    # ============================================================
    draw_time_gap(ax, t['gap_persist_broadcast'],
                  '关键时序缝隙：先持久化 → 后广播\n（持久化完成后才触发广播，保证数据一致性）',
                  '#7B1FA2')
    
    # 6. DataBridge广播事件（异步）
    draw_async_arrow(ax, 2, 1, t['bridge_broadcast'], t['orderstore_callback'],
                     'broadcast("orders")\n异步事件', '#E65100', (-0.35, 0.2))
    
    # 广播时序缝隙说明
    draw_time_gap(ax, t['broadcast_gap'],
                  '对比方案：先广播 → 后持久化\n（可能导致UI刷新时数据尚未持久化）',
                  '#00695C')
    
    # ============================================================
    # 各Store订阅回调分支
    # ============================================================
    
    # --- orderStore（正常流程）---
    ax.text(1 * LANE_WIDTH + LANE_WIDTH / 2, t['orderstore_callback'] + 0.3,
            'orderStore', ha='center', va='bottom', fontsize=8,
            fontweight='bold', color='#E65100')
    
    draw_sync_arrow(ax, 1, 1, t['orderstore_callback'], t['orderstore_refresh'],
                    'onOrdersChange()\n→ refresh()', '#2E7D32', (0.4, -0.1))
    
    # --- positionStore（频道不匹配问题）---
    ax.text(1 * LANE_WIDTH + LANE_WIDTH / 2, t['positionstore_callback'] + 0.3,
            'positionStore', ha='center', va='bottom', fontsize=8,
            fontweight='bold', color='#E65100')
    
    draw_issue_marker(ax, 1, t['positionstore_issue'],
                      '频道不匹配\n订阅"trading" 但广播"orders"\n收不到事件 → 不刷新',
                      'error')
    
    # --- signalStore（只打日志不刷新）---
    ax.text(1 * LANE_WIDTH + LANE_WIDTH / 2, t['signalstore_callback'] + 0.3,
            'signalStore', ha='center', va='bottom', fontsize=8,
            fontweight='bold', color='#E65100')
    
    draw_sync_arrow(ax, 1, 1, t['signalstore_callback'], t['signalstore_issue'] + 0.2,
                    'onSignalEvent()\n→ console.log()', '#FF8F00', (0.45, -0.1))
    
    draw_issue_marker(ax, 1, t['signalstore_issue'],
                      '订阅回调不刷新\n只打日志不调用refresh()\nUI数据不同步',
                      'warning')
    
    # --- hotSectorStore / valuePitStore（完全没有订阅）---
    ax.text(1 * LANE_WIDTH + LANE_WIDTH / 2, t['hotsector_missing'] + 0.3,
            'hotSectorStore', ha='center', va='bottom', fontsize=8,
            fontweight='bold', color='#9E9E9E')
    
    draw_issue_marker(ax, 1, t['hotsector_missing'] - 0.1,
                      '完全无订阅机制\nhotSectorStore未订阅任何频道\n订单变化无感',
                      'error')
    
    ax.text(1 * LANE_WIDTH + LANE_WIDTH / 2, t['valuepit_missing'] + 0.2,
            'valuePitStore', ha='center', va='bottom', fontsize=8,
            fontweight='bold', color='#9E9E9E')
    
    draw_issue_marker(ax, 1, t['valuepit_missing'] - 0.2,
                      '完全无订阅机制\nvaluePitStore未订阅任何频道\n订单变化无感',
                      'error')
    
    # ============================================================
    # UI重绘
    # ============================================================
    draw_sync_arrow(ax, 1, 0, t['ui_redraw'] + 0.5, t['ui_redraw'],
                    '触发UI重绘\n(仅orderStore正常刷新)', '#2E7D32', (-0.3, 0))
    
    # ============================================================
    # 图例
    # ============================================================
    legend_y = 0.5
    legend_items = [
        ('同步调用（实线）', '#1565C0', '-'),
        ('异步广播（虚线）', '#E65100', '--'),
        ('返回值', '#558B2F', '-'),
        ('错误/缺失', '#F44336', '-'),
        ('警告', '#FF9800', '-'),
    ]
    
    for i, (label, color, ls) in enumerate(legend_items):
        x_pos = 0.3 + i * 2.5
        ax.plot([x_pos, x_pos + 0.8], [legend_y, legend_y],
                color=color, linestyle=ls, linewidth=2)
        ax.text(x_pos + 0.9, legend_y, label, ha='left', va='center', fontsize=8)
    
    # ============================================================
    # 图表标题
    # ============================================================
    ax.set_title(
        '订单数据闭环 - 数据流转时序图\n'
        '五泳道：UI交互层 → 业务Store层 → DataBridge事件总线 → dataLayer持久化层 → IndexedDB',
        fontsize=13, fontweight='bold', color='#263238', pad=20
    )
    
    # 设置坐标范围
    ax.set_xlim(-0.3, total_width + 0.3)
    ax.set_ylim(-0.5, y_end + 1)
    ax.set_aspect('equal')
    ax.axis('off')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=180, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print(f"✓ 时序图已保存: {output_path}")
    plt.close()
    return output_path


# ============================================================
# Mermaid 时序图代码生成
# ============================================================

def generate_mermaid_sequence(output_path='sequence_diagram.mmd'):
    """生成Mermaid时序图代码"""
    
    mermaid_code = '''```mermaid
sequenceDiagram
    %% ============================
    %% 参与者定义（五泳道）
    %% ============================
    participant UI as UI交互层
    participant Store as 业务Store层
    participant Bridge as DataBridge事件总线
    participant Data as dataLayer持久化层
    participant IDB as IndexedDB

    %% ============================
    %% 核心流程：新增订单
    %% ============================
    Note over UI,IDB: ━━━ 核心流程：用户新增订单 ━━━

    UI->>Store: 新增订单 saveOrder()
    activate Store

    Store->>Data: dataLayer.save(order)
    activate Data

    Data->>Bridge: dataBridge.forward(channel:"orders")
    activate Bridge

    Bridge->>IDB: routeToDB() 写入orders表
    activate IDB

    %% IndexedDB写入
    Note over IDB: 持久化操作<br/>put/transactions

    IDB-->>Bridge: 写入成功 {ok: true}
    deactivate IDB

    Bridge-->>Data: resolve()
    Data-->>Store: save完成

    %% ============================
    %% 关键时序缝隙标注
    %% ============================
    Note over Bridge,IDB: ⏱ 关键时序缝隙：先持久化 → 后广播<br/>（持久化完成后才触发广播，保证数据一致性）<br/><br/>对比方案：先广播 → 后持久化<br/>（可能导致UI刷新时数据尚未持久化）

    %% ============================
    %% 异步广播阶段
    %% ============================
    Note over Bridge,Store: ━━━ 异步广播阶段 ━━━

    Bridge-)Store: broadcast("orders") [异步事件]
    deactivate Bridge

    %% ============================
    %% 各Store订阅回调分支
    %% ============================
    Note over Store: ━━━ 各Store订阅回调（并行）━━━

    %% --- orderStore（正常流程）---
    Note right of Store: 【orderStore ✅ 正常】
    Store->>Store: onOrdersChange()回调
    Store->>Store: refresh() 刷新数据
    Store->>UI: 触发UI重绘

    %% --- positionStore（频道不匹配）---
    Note right of Store: 【positionStore ❌ 频道不匹配】
    Note over Store: ❌ 订阅频道 "trading"<br/>❌ 广播频道 "orders"<br/>❌ 频道不匹配 → 收不到事件 → 不刷新

    %% --- signalStore（只打日志不刷新）---
    Note right of Store: 【signalStore ⚠ 回调不刷新】
    Store->>Store: onSignalEvent()回调
    Store->>Store: console.log() 仅打日志
    Note over Store: ⚠ 只打日志不调用refresh()<br/>⚠ UI数据不同步

    %% --- hotSectorStore（无订阅）---
    Note right of Store: 【hotSectorStore ❌ 完全无订阅】
    Note over Store: ❌ 完全没有订阅机制<br/>❌ 订单变化无感

    %% --- valuePitStore（无订阅）---
    Note right of Store: 【valuePitStore ❌ 完全无订阅】
    Note over Store: ❌ 完全没有订阅机制<br/>❌ 订单变化无感

    deactivate Store

    %% ============================
    %% 底部总结
    %% ============================
    Note over UI,IDB: ━━━ 问题总结 ━━━<br/>
    Note over UI,IDB: 1. 频道不匹配：positionStore订阅"trading"但广播"orders"<br/>
    Note over UI,IDB: 2. 订阅回调不刷新：signalStore只打日志不refresh<br/>
    Note over UI,IDB: 3. 完全无订阅：hotSectorStore / valuePitStore 未订阅任何频道<br/>
    Note over UI,IDB: 4. 时序设计：当前为先持久化后广播（保证一致性）
```'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(mermaid_code)
    
    print(f"✓ Mermaid时序图代码已保存: {output_path}")
    return mermaid_code


# ============================================================
# 主入口
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("订单数据闭环 - 数据流转时序图生成器")
    print("=" * 60)
    
    # 1. 生成matplotlib时序图
    png_path = r'c:\Users\huawei\.trae-cn\work\6a406ac459f8ecc595828aa8\data_flow_sequence.png'
    draw_sequence_diagram(png_path)
    
    # 2. 生成Mermaid时序图代码
    mmd_path = r'c:\Users\huawei\.trae-cn\work\6a406ac459f8ecc595828aa8\sequence_diagram.mmd'
    mermaid_code = generate_mermaid_sequence(mmd_path)
    
    print("\n" + "=" * 60)
    print("生成完成！")
    print(f"  时序图PNG: {png_path}")
    print(f"  Mermaid代码: {mmd_path}")
    print("=" * 60)
    
    # 打印Mermaid代码预览
    print("\n--- Mermaid 时序图代码 ---")
    print(mermaid_code[:500] + "...")
