#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文档编码修复工具

功能：
1. 扫描 Git 仓库中的文档，识别编码类型
2. 将 GBK 编码的文档转换为 UTF-8 无 BOM
3. 将工作区中损坏的文件从 Git 恢复
4. 生成修复报告

使用方法：
    python recover-docs-encoding.py --scan           # 只扫描，不修改
    python recover-docs-encoding.py --recover        # 恢复可修复的文件
    python recover-docs-encoding.py --recover --dry-run  # 预览恢复
    python recover-docs-encoding.py --report out.json  # 输出详细报告
"""

import os
import sys
import json
import argparse
import subprocess
import re
from pathlib import Path
from collections import defaultdict


def run_git(args, repo_path):
    """运行 git 命令并返回结果"""
    result = subprocess.run(
        ['git'] + args,
        capture_output=True,
        cwd=repo_path,
    )
    return result


def detect_encoding(raw_bytes):
    """检测字节流的编码类型

    返回: (encoding, chinese_count, status)
    encoding: 'utf-8', 'gbk', 'gb2312', 'unknown'
    status: 'ok', 'damaged', 'partial', 'english-only'
    """
    # 检查 BOM
    if raw_bytes[:3] == b'\xef\xbb\xbf':
        try:
            text = raw_bytes[3:].decode('utf-8')
            chinese = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
            q_segments = len(re.findall(r'\?{5,}', text))
            if chinese > 10 and q_segments == 0:
                return 'utf-8-sig', chinese, 'ok'
            elif chinese == 0 and q_segments > 0:
                return 'utf-8-sig', 0, 'damaged'
            else:
                return 'utf-8-sig', chinese, 'partial'
        except:
            pass

    # 尝试 UTF-8
    try:
        text = raw_bytes.decode('utf-8')
        chinese = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        q_segments = len(re.findall(r'\?{5,}', text))
        fffd = text.count('\ufffd')

        if fffd > 0:
            return 'utf-8', chinese, 'partial' if chinese > 10 else 'damaged'
        elif chinese > 10 and q_segments == 0:
            return 'utf-8', chinese, 'ok'
        elif chinese == 0 and q_segments > 0:
            return 'utf-8', 0, 'damaged'
        elif chinese > 0 and q_segments > 0:
            return 'utf-8', chinese, 'partial'
        elif chinese == 0 and q_segments == 0:
            return 'utf-8', 0, 'english-only'
        else:
            return 'utf-8', chinese, 'ok'
    except UnicodeDecodeError:
        pass

    # 尝试 GBK
    try:
        text = raw_bytes.decode('gbk')
        chinese = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        q_segments = len(re.findall(r'\?{5,}', text))

        if chinese > 10 and q_segments == 0:
            return 'gbk', chinese, 'ok'
        elif chinese > 0:
            return 'gbk', chinese, 'partial'
        else:
            return 'gbk', 0, 'english-only'
    except UnicodeDecodeError:
        pass

    # 尝试 GB2312
    try:
        text = raw_bytes.decode('gb2312')
        chinese = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        if chinese > 10:
            return 'gb2312', chinese, 'ok'
    except UnicodeDecodeError:
        pass

    return 'unknown', 0, 'undecodable'


def scan_git_files(repo_path, pattern='docs/**/*.md'):
    """扫描 Git 中的文件，识别编码"""
    # 获取所有 git 中的 md 文件
    result = run_git(['ls-files', pattern], repo_path)
    if result.returncode != 0:
        print(f"Error: {result.stderr.decode('utf-8', errors='ignore')}")
        return []

    files = [f for f in result.stdout.decode('utf-8').strip().split('\n') if f]
    print(f"Git 中找到 {len(files)} 个文件")

    results = []
    for i, filepath in enumerate(files):
        if i % 100 == 0:
            print(f"  扫描进度: {i}/{len(files)}")

        # 获取 git 对象
        ls_result = run_git(['ls-tree', 'HEAD', filepath], repo_path)
        if ls_result.returncode != 0:
            continue

        parts = ls_result.stdout.decode('utf-8').strip().split()
        if len(parts) < 3:
            continue

        blob_hash = parts[2]

        # 获取原始内容
        cat_result = run_git(['cat-file', '-p', blob_hash], repo_path)
        if cat_result.returncode != 0:
            continue

        raw = cat_result.stdout
        encoding, chinese, status = detect_encoding(raw)

        # 也检查工作区文件
        work_path = os.path.join(repo_path, filepath)
        work_status = 'not-exist'
        work_encoding = 'none'
        work_chinese = 0
        if os.path.exists(work_path):
            with open(work_path, 'rb') as f:
                work_raw = f.read()
            work_encoding, work_chinese, work_status = detect_encoding(work_raw)

        results.append({
            'path': filepath,
            'git_encoding': encoding,
            'git_chinese': chinese,
            'git_status': status,
            'git_size': len(raw),
            'work_encoding': work_encoding,
            'work_chinese': work_chinese,
            'work_status': work_status,
            'work_size': len(work_raw) if os.path.exists(work_path) else 0,
            'recoverable': status == 'ok' and work_status == 'damaged',
        })

    return results


def categorize_results(results):
    """对扫描结果分类"""
    categories = defaultdict(list)
    summary = {
        'total': len(results),
        'recoverable': 0,
        'by_git_status': defaultdict(int),
        'by_work_status': defaultdict(int),
        'by_git_encoding': defaultdict(int),
    }

    for r in results:
        summary['by_git_status'][r['git_status']] += 1
        summary['by_work_status'][r['work_status']] += 1
        summary['by_git_encoding'][r['git_encoding']] += 1

        if r['recoverable']:
            summary['recoverable'] += 1
            categories['recoverable'].append(r)
        elif r['git_status'] == 'ok' and r['work_status'] == 'ok':
            categories['both-ok'].append(r)
        elif r['git_status'] == 'damaged' and r['work_status'] == 'damaged':
            categories['both-damaged'].append(r)
        else:
            categories['other'].append(r)

    summary['by_git_status'] = dict(summary['by_git_status'])
    summary['by_work_status'] = dict(summary['by_work_status'])
    summary['by_git_encoding'] = dict(summary['by_git_encoding'])

    return dict(categories), summary


def recover_files(repo_path, files, dry_run=False):
    """从 Git 恢复文件并转换为 UTF-8"""
    recovered = []
    failed = []
    skipped = []

    for item in files:
        filepath = item['path']
        work_path = os.path.join(repo_path, filepath)

        if not item['recoverable']:
            skipped.append((filepath, '不可恢复'))
            continue

        try:
            # 从 git 获取原始内容
            ls_result = run_git(['ls-tree', 'HEAD', filepath], repo_path)
            parts = ls_result.stdout.decode('utf-8').strip().split()
            blob_hash = parts[2]

            cat_result = run_git(['cat-file', '-p', blob_hash], repo_path)
            raw = cat_result.stdout

            # 按检测到的编码解码
            if item['git_encoding'] == 'gbk':
                text = raw.decode('gbk')
            elif item['git_encoding'] == 'gb2312':
                text = raw.decode('gb2312')
            elif item['git_encoding'] == 'utf-8-sig':
                text = raw[3:].decode('utf-8')
            elif item['git_encoding'] == 'utf-8':
                text = raw.decode('utf-8')
            else:
                # 尝试通用解码
                try:
                    text = raw.decode('utf-8')
                except:
                    text = raw.decode('gbk')

            if dry_run:
                recovered.append((filepath, f"{item['git_encoding']} -> utf-8"))
                continue

            # 确保目录存在
            os.makedirs(os.path.dirname(work_path), exist_ok=True)

            # 写入 UTF-8 无 BOM
            with open(work_path, 'w', encoding='utf-8') as f:
                f.write(text)

            recovered.append((filepath, f"{item['git_encoding']} -> utf-8"))

        except Exception as e:
            failed.append((filepath, str(e)))

    return recovered, failed, skipped


def print_summary(summary, categories):
    """打印汇总"""
    print()
    print("=" * 60)
    print("  文档编码扫描报告")
    print("=" * 60)
    print()
    print(f"  扫描文件总数: {summary['total']}")
    print(f"  可恢复文件数: {summary['recoverable']}")
    print()
    print("  Git 中状态分布:")
    for status, count in sorted(summary['by_git_status'].items(), key=lambda x: -x[1]):
        pct = count / summary['total'] * 100
        bar = '█' * int(pct / 2)
        print(f"    {status:15s} {count:5d} ({pct:5.1f}%) {bar}")
    print()
    print("  工作区状态分布:")
    for status, count in sorted(summary['by_work_status'].items(), key=lambda x: -x[1]):
        pct = count / summary['total'] * 100
        bar = '█' * int(pct / 2)
        print(f"    {status:15s} {count:5d} ({pct:5.1f}%) {bar}")
    print()
    print("  Git 中编码分布:")
    for enc, count in sorted(summary['by_git_encoding'].items(), key=lambda x: -x[1]):
        print(f"    {enc:15s} {count:5d}")
    print()

    if categories.get('recoverable'):
        print(f"  可恢复文件 ({len(categories['recoverable'])} 个) - 前 20:")
        for r in sorted(categories['recoverable'], key=lambda x: x['path'])[:20]:
            print(f"    [{r['git_encoding']:8s}] {r['path']}")
        if len(categories['recoverable']) > 20:
            print(f"    ... 还有 {len(categories['recoverable']) - 20} 个")
        print()


def main():
    parser = argparse.ArgumentParser(description='文档编码修复工具')
    parser.add_argument('--repo', default='.', help='仓库路径')
    parser.add_argument('--pattern', default='docs/**/*.md', help='文件匹配模式')
    parser.add_argument('--scan', action='store_true', help='只扫描')
    parser.add_argument('--recover', action='store_true', help='执行恢复')
    parser.add_argument('--dry-run', action='store_true', help='预览模式')
    parser.add_argument('--report', help='输出 JSON 报告文件')
    args = parser.parse_args()

    repo_path = os.path.abspath(args.repo)
    print(f"仓库路径: {repo_path}")
    print()

    # 扫描
    results = scan_git_files(repo_path, args.pattern)
    categories, summary = categorize_results(results)

    print_summary(summary, categories)

    # 保存报告
    if args.report:
        report = {
            'summary': summary,
            'files': results,
        }
        with open(args.report, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"详细报告已保存到: {args.report}")
        print()

    # 恢复
    if args.recover:
        if args.dry_run:
            print("=== 预览恢复 ===")
        else:
            print("=== 执行恢复 ===")

        recoverable = categories.get('recoverable', [])
        print(f"待恢复文件: {len(recoverable)} 个")
        print()

        recovered, failed, skipped = recover_files(repo_path, recoverable, dry_run=args.dry_run)

        print(f"成功恢复: {len(recovered)} 个")
        print(f"失败: {len(failed)} 个")
        print(f"跳过: {len(skipped)} 个")

        if failed:
            print()
            print("失败列表:")
            for f, err in failed[:10]:
                print(f"  {f}: {err}")

        print()
        if args.dry_run:
            print("（预览模式，未实际修改文件）")
        else:
            print("恢复完成！建议用 git diff 检查变更后再提交。")


if __name__ == '__main__':
    main()
