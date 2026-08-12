#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render_mermaid_images.py — 将 MERMAID-FLOWCHARTS.md 中的 Mermaid 流程图渲染为 PNG 图片

渲染策略 (按优先级尝试):
  1. mermaid.ink 在线渲染 (base64 URL 方式)
  2. Kroki API (带浏览器 User-Agent)
  3. 生成独立 HTML 文件 (含 Mermaid.js CDN, 浏览器打开即可截图)

用法:
  python3 render_mermaid_images.py              # 尝试在线渲染
  python3 render_mermaid_images.py --html-only  # 仅生成 HTML 文件
"""

import base64
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import zlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "MERMAID-FLOWCHARTS.md")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "flowchart-images")
HTML_DIR = os.path.join(SCRIPT_DIR, "flowchart-html")

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)


def extract_mermaid_blocks(filepath):
    """从 Markdown 文件中提取所有 Mermaid 代码块及其标题."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = []
    pattern = r"```mermaid\s*\n(.*?)```"
    matches = re.finditer(pattern, content, re.DOTALL)

    for match in matches:
        pos = match.start()
        preceding = content[:pos]
        header_match = re.findall(r"^## (.+)$", preceding, re.MULTILINE)
        title = header_match[-1] if header_match else f"flowchart_{len(blocks)+1}"

        safe_name = re.sub(r"[^\w\-]", "_", title)
        safe_name = re_name_cleanup(safe_name)

        blocks.append({
            "title": title,
            "filename": f"{safe_name}.png",
            "html_filename": f"{safe_name}.html",
            "code": match.group(1).strip(),
        })

    return blocks


def re_name_cleanup(name):
    """清理文件名中的多余下划线."""
    while "__" in name:
        name = name.replace("__", "_")
    return name.strip("_")


def render_via_mermaid_ink(mermaid_code, output_format="png"):
    """通过 mermaid.ink 渲染 Mermaid 图表.

    URL 格式: https://mermaid.ink/img/{base64url(mermaid_code)}
    支持 png, svg 等格式.
    """
    encoded = base64.urlsafe_b64encode(mermaid_code.encode("utf-8")).decode("ascii")
    url = f"https://mermaid.ink/img/{encoded}"

    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", BROWSER_UA)
    req.add_header("Accept", "image/png,image/*;q=0.8,*/*;q=0.5")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")[:200]
        raise RuntimeError(f"mermaid.ink HTTP {e.code}: {error_body}") from e


def render_via_kroki(mermaid_code, output_format="png"):
    """通过 Kroki API 渲染 (带浏览器 User-Agent)."""
    url = f"https://kroki.io/mermaid/{output_format}"
    data = mermaid_code.encode("utf-8")

    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "text/plain")
    req.add_header("User-Agent", BROWSER_UA)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")[:200]
        raise RuntimeError(f"Kroki HTTP {e.code}: {error_body}") from e


def generate_html_file(block, output_path):
    """生成独立 HTML 文件, 含 Mermaid.js CDN, 浏览器打开即可渲染."""
    mermaid_code_escaped = block["code"].replace("</", "<\\/")

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{block['title']}</title>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
        }}
        h1 {{
            color: #333;
            font-size: 18px;
            margin-bottom: 20px;
        }}
        #diagram {{
            background: #fff;
        }}
        .tip {{
            margin-top: 15px;
            color: #666;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <h1>{block['title']}</h1>
    <div id="diagram" class="mermaid">
{block['code']}
    </div>
    <div class="tip">
        右键点击图表 → "图片另存为" 即可保存 PNG.<br/>
        或使用浏览器截图工具截取整个页面.
    </div>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{
            startOnLoad: true,
            theme: 'default',
            flowchart: {{
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }}
        }});
    </script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def generate_index_html(blocks, output_path):
    """生成索引 HTML, 包含所有流程图的链接."""
    links = "\n".join(
        f'        <li><a href="{b["html_filename"]}">{b["title"]}</a></li>'
        for b in blocks
    )

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Mermaid 流程图索引</title>
    <style>
        body {{
            font-family: "Microsoft YaHei", sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
        }}
        h1 {{ color: #333; }}
        li {{ margin: 8px 0; }}
        a {{ color: #0066cc; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .tip {{
            margin-top: 20px;
            padding: 15px;
            background: #f0f7ff;
            border-radius: 8px;
            color: #555;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <h1>Mermaid 流程图索引 ({len(blocks)} 个)</h1>
    <ol>
{links}
    </ol>
    <div class="tip">
        点击每个链接打开对应流程图页面, 在浏览器中渲染后:<br/>
        1. 右键 → "图片另存为" 保存 PNG<br/>
        2. 或按 F12 打开开发者工具, 截取 SVG 元素<br/>
        3. SVG 可直接插入 PPT (矢量图, 缩放不失真)
    </div>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def main():
    html_only = "--html-only" in sys.argv

    # 1. 提取 Mermaid 代码块
    print(f"读取: {INPUT_FILE}")
    blocks = extract_mermaid_blocks(INPUT_FILE)
    print(f"找到 {len(blocks)} 个 Mermaid 流程图\n")

    # 2. 创建输出目录
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(HTML_DIR, exist_ok=True)

    # 3. 始终生成 HTML 文件 (作为保底方案)
    print("=== 生成 HTML 文件 (浏览器可渲染) ===")
    for i, block in enumerate(blocks, 1):
        html_path = os.path.join(HTML_DIR, block["html_filename"])
        generate_html_file(block, html_path)
        print(f"  [{i}/{len(blocks)}] {block['html_filename']}")

    index_path = os.path.join(HTML_DIR, "index.html")
    generate_index_html(blocks, index_path)
    print(f"  索引: {index_path}")

    if html_only:
        print(f"\n✅ HTML 文件已生成, 用浏览器打开 index.html 查看全部流程图")
        return 0

    # 4. 尝试在线渲染 PNG
    print(f"\n=== 尝试在线渲染 PNG ===")
    success = 0
    failed = 0

    for i, block in enumerate(blocks, 1):
        title = block["title"]
        filename = block["filename"]
        code = block["code"]
        output_path = os.path.join(OUTPUT_DIR, filename)

        print(f"\n[{i}/{len(blocks)}] 渲染: {title}")

        # 策略 1: mermaid.ink
        try:
            image_data = render_via_mermaid_ink(code, "png")
            with open(output_path, "wb") as f:
                f.write(image_data)
            size_kb = len(image_data) / 1024
            print(f"  ✅ 成功 (mermaid.ink, {size_kb:.1f} KB)")
            success += 1
            time.sleep(0.3)
            continue
        except Exception as e:
            print(f"  ⚠️ mermaid.ink 失败: {e}")

        # 策略 2: Kroki (带 UA)
        try:
            image_data = render_via_kroki(code, "png")
            with open(output_path, "wb") as f:
                f.write(image_data)
            size_kb = len(image_data) / 1024
            print(f"  ✅ 成功 (Kroki, {size_kb:.1f} KB)")
            success += 1
            time.sleep(0.3)
            continue
        except Exception as e:
            print(f"  ⚠️ Kroki 失败: {e}")

        print(f"  ❌ 在线渲染失败, 请使用 HTML 文件: {block['html_filename']}")
        failed += 1

    # 5. 汇总
    print(f"\n{'='*60}")
    print(f"PNG 渲染: {success} 成功, {failed} 失败, 共 {len(blocks)} 个")
    print(f"PNG 目录: {OUTPUT_DIR}")
    print(f"HTML 目录: {HTML_DIR}")

    if success > 0:
        print(f"\n✅ PNG 图片可直接插入 PPT:")
        for block in blocks:
            path = os.path.join(OUTPUT_DIR, block["filename"])
            if os.path.exists(path) and os.path.getsize(path) > 0:
                print(f"  {block['filename']:50s} ← {block['title']}")

    if failed > 0:
        print(f"\n⚠️ {failed} 个图片需通过 HTML 文件手动渲染:")
        print(f"  1. 用浏览器打开: {HTML_DIR}\\index.html")
        print(f"  2. 点击对应链接查看流程图")
        print(f"  3. 右键 → '图片另存为' 保存 PNG")

    return 0


if __name__ == "__main__":
    sys.exit(main())
