#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文件编码健康检查工具

功能：
1. 扫描指定目录下的所有文本文件
2. 检测文件编码（UTF-8 / GBK / 其他）
3. 检测中文损坏情况（问号乱码 / 替换字符）
4. 生成健康报告

使用方法：
    python check-encoding-health.py <目录> [--output report.json]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from collections import defaultdict


def detect_encoding_and_health(filepath):
    """检测文件编码和中文健康状态"""
    result = {
        'path': str(filepath),
        'size': 0,
        'encoding': 'unknown',
        'has_bom': False,
        'chinese_chars': 0,
        'question_mark_segments': 0,  # 连续5个以上问号的段数
        'replacement_chars': 0,  # U+FFFD 替换字符数
        'status': 'unknown',  # ok / damaged / partial / english-only
        'confidence': 0.0,
    }

    try:
        with open(filepath, 'rb') as f:
            raw = f.read()

        result['size'] = len(raw)

        if len(raw) == 0:
            result['status'] = 'empty'
            return result

        # 检查 BOM
        if raw[:3] == b'\xef\xbb\xbf':
            result['has_bom'] = True
            result['encoding'] = 'utf-8-sig'
            content = raw[3:].decode('utf-8', errors='replace')
        elif raw[:2] == b'\xff\xfe':
            result['encoding'] = 'utf-16-le'
            content = raw.decode('utf-16-le', errors='replace')
        elif raw[:2] == b'\xfe\xff':
            result['encoding'] = 'utf-16-be'
            content = raw.decode('utf-16-be', errors='replace')
        else:
            # 尝试 UTF-8 解码
            try:
                content = raw.decode('utf-8')
                result['encoding'] = 'utf-8'
                result['confidence'] = 0.95
            except UnicodeDecodeError:
                # 尝试 GBK
                try:
                    content = raw.decode('gbk')
                    result['encoding'] = 'gbk'
                    result['confidence'] = 0.8
                except UnicodeDecodeError:
                    # 用替换字符解码
                    content = raw.decode('utf-8', errors='replace')
                    result['encoding'] = 'unknown'
                    result['confidence'] = 0.3

        # 统计中文字符
        chinese_count = sum(1 for c in content if '\u4e00' <= c <= '\u9fff')
        result['chinese_chars'] = chinese_count

        # 统计替换字符 U+FFFD
        result['replacement_chars'] = content.count('\ufffd')

        # 统计连续问号段（5个以上）
        import re
        question_segments = len(re.findall(r'\?{5,}', content))
        result['question_mark_segments'] = question_segments

        # 判断健康状态
        if chinese_count == 0 and question_segments == 0:
            result['status'] = 'english-only'
        elif chinese_count == 0 and question_segments > 0:
            result['status'] = 'damaged'  # 中文完全损坏
        elif chinese_count > 0 and question_segments > 0:
            result['status'] = 'partial'  # 部分损坏
        elif result['replacement_chars'] > 0:
            result['status'] = 'partial'
        else:
            result['status'] = 'ok'

    except Exception as e:
        result['status'] = 'error'
        result['error'] = str(e)

    return result


def scan_directory(directory, extensions=None):
    """扫描目录下的文件"""
    if extensions is None:
        extensions = {'.md', '.txt', '.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.css'}

    results = []
    dir_path = Path(directory)

    for root, dirs, files in os.walk(dir_path):
        # 跳过 node_modules 等目录
        dirs[:] = [d for d in dirs if d not in {
            'node_modules', '.git', 'dist', 'build', 'coverage', '.next'
        }]

        for filename in files:
            filepath = Path(root) / filename
            if filepath.suffix.lower() in extensions:
                result = detect_encoding_and_health(filepath)
                results.append(result)

    return results


def generate_summary(results):
    """生成汇总报告"""
    summary = {
        'total': len(results),
        'by_status': defaultdict(int),
        'by_encoding': defaultdict(int),
        'damaged_files': [],
        'partial_files': [],
        'total_chinese_chars': 0,
        'total_question_segments': 0,
    }

    for r in results:
        summary['by_status'][r['status']] += 1
        summary['by_encoding'][r['encoding']] += 1
        summary['total_chinese_chars'] += r.get('chinese_chars', 0)
        summary['total_question_segments'] += r.get('question_mark_segments', 0)

        if r['status'] == 'damaged':
            summary['damaged_files'].append(r['path'])
        elif r['status'] == 'partial':
            summary['partial_files'].append(r['path'])

    # 转为普通 dict
    summary['by_status'] = dict(summary['by_status'])
    summary['by_encoding'] = dict(summary['by_encoding'])

    return summary


def print_report(summary):
    """打印可读报告"""
    print("=" * 60)
    print("  文件编码健康检查报告")
    print("=" * 60)
    print()
    print(f"  扫描文件总数: {summary['total']}")
    print(f"  中文字符总数: {summary['total_chinese_chars']:,}")
    print(f"  连续问号段总数: {summary['total_question_segments']:,}")
    print()
    print("  按状态分布:")
    for status, count in sorted(summary['by_status'].items()):
        pct = count / summary['total'] * 100 if summary['total'] > 0 else 0
        bar = '█' * int(pct / 2)
        print(f"    {status:20s} {count:5d} ({pct:5.1f}%) {bar}")
    print()
    print("  按编码分布:")
    for enc, count in sorted(summary['by_encoding'].items(), key=lambda x: -x[1]):
        print(f"    {enc:20s} {count:5d}")
    print()

    if summary['damaged_files']:
        print(f"  完全损坏文件 ({len(summary['damaged_files'])} 个):")
        for f in sorted(summary['damaged_files'])[:20]:
            print(f"    - {f}")
        if len(summary['damaged_files']) > 20:
            print(f"    ... 还有 {len(summary['damaged_files']) - 20} 个")
        print()

    if summary['partial_files']:
        print(f"  部分损坏文件 ({len(summary['partial_files'])} 个):")
        for f in sorted(summary['partial_files'])[:10]:
            print(f"    - {f}")
        if len(summary['partial_files']) > 10:
            print(f"    ... 还有 {len(summary['partial_files']) - 10} 个")
        print()


def main():
    parser = argparse.ArgumentParser(description='文件编码健康检查工具')
    parser.add_argument('directory', help='要扫描的目录')
    parser.add_argument('--output', '-o', help='输出 JSON 报告文件')
    parser.add_argument('--ext', nargs='+', help='要检查的文件扩展名')
    args = parser.parse_args()

    extensions = None
    if args.ext:
        extensions = {e.lower() if e.startswith('.') else '.' + e.lower() for e in args.ext}

    print(f"正在扫描目录: {args.directory}")
    print()

    results = scan_directory(args.directory, extensions)
    summary = generate_summary(results)

    print_report(summary)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump({
                'summary': summary,
                'files': results,
            }, f, ensure_ascii=False, indent=2)
        print(f"详细报告已保存到: {args.output}")


if __name__ == '__main__':
    main()
