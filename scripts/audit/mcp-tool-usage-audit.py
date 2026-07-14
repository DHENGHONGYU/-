import os
import re
import json

def main():
    servers_dir = r'D:\FinSightV9\src\mcp\servers'
    src_dir = r'D:\FinSightV9\src'

    # ── 1. 精确提取每个 Server 的 Tool 名称 ──
    # 只匹配 getTools() 返回数组中的 name: 'xxx'
    server_tools = {}
    for d in sorted(os.listdir(servers_dir)):
        server_path = os.path.join(servers_dir, d)
        if not os.path.isdir(server_path):
            continue
        tools = []
        for f in os.listdir(server_path):
            if not f.endswith('.ts'):
                continue
            filepath = os.path.join(server_path, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            # 找到 getTools() 方法体
            tools_match = re.search(r'getTools\(\)[^{]*\{([\s\S]*?)\n  \}', content)
            if not tools_match:
                # 尝试更宽松的匹配
                tools_match = re.search(r'getTools\(\)[^{]*\{(.*)\n\}', content, re.DOTALL)
            if tools_match:
                body = tools_match.group(1)
                matches = re.findall(r"name:\s*'([^']+)'", body)
                for name in matches:
                    if ' ' in name or re.search(r'[\u4e00-\u9fff]', name):
                        continue
                    if name not in tools:
                        tools.append(name)
        if tools:
            server_tools[d] = tools

    # ── 2. 全项目搜索每个 Tool 的精确引用 ──
    # 模式A: callTool(..., 'toolName' 或 callTool(..., "toolName"
    # 模式B: agentComponentRegistry 中的 tool 引用
    # 模式C: 直接字符串匹配（排除自身定义文件和纯测试文件）
    def count_refs(tool_name):
        count = 0
        files = []
        for root, dirs, filenames in os.walk(src_dir):
            for f in filenames:
                if not (f.endswith('.ts') or f.endswith('.tsx')):
                    continue
                filepath = os.path.join(root, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                # 精确匹配 callTool 调用
                pattern1 = re.compile(r"callTool\s*\([^)]*['\"]" + re.escape(tool_name) + r"['\"]")
                matches1 = list(pattern1.finditer(content))
                # 匹配 agent registry 等处的 tool 引用
                pattern2 = re.compile(r"['\"]" + re.escape(tool_name) + r"['\"]")
                matches2 = list(pattern2.finditer(content))
                total = len(matches1) + len(matches2)
                if total > 0:
                    count += total
                    files.append(filepath)
        return count, files

    stats = {}
    for server, tools in server_tools.items():
        stats[server] = {}
        for tool in tools:
            cnt, files = count_refs(tool)
            server_path_prefix = os.path.join(servers_dir, server)
            external_refs = [f for f in files if not f.startswith(server_path_prefix)]
            stats[server][tool] = {
                'total_refs': cnt,
                'external_refs': len(external_refs),
                'external_files': external_refs[:5]
            }

    # ── 3. 输出结果 ──
    result = {
        'server_tools': server_tools,
        'stats': stats,
        'zombie_report': {}
    }

    for server, tools in stats.items():
        zombie_tools = []
        active_tools = []
        for tool, info in tools.items():
            if info['external_refs'] == 0:
                zombie_tools.append(tool)
            else:
                active_tools.append(tool)
        result['zombie_report'][server] = {
            'total': len(tools),
            'active': len(active_tools),
            'zombie': len(zombie_tools),
            'zombie_tools': zombie_tools,
            'active_tools': active_tools
        }

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
