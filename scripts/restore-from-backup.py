#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从备份目录恢复损坏的文档

功能：
1. 对比备份目录和当前 docs 目录
2. 找出备份中正常但当前损坏的文件
3. 从备份恢复（自动转换为 UTF-8 无 BOM）

使用方法：
    python restore-from-backup.py --backup docs-backup-20260719-085501 --target docs [--dry-run]
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path


def detect_encoding(filepath):
    """检测文件编码和健康状态"""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()

        if len(raw) == 0:
            return {'encoding': 'empty', 'chinese': 0, 'status': 'empty', 'raw': raw}

        # 检查 BOM
        has_bom = raw[:3] == b'\xef\xbb\xbf'
        if has_bom:
            raw_body = raw[3:]
        else:
            raw_body = raw

        # 尝试 UTF-8
        try:
            text = raw_body.decode('utf-8')
            cn = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
            q_segments = len(re.findall(r'\?{5,}', text))
            fffd = text.count('\ufffd')

            if fffd > 0:
                status = 'partial' if cn > 10 else 'damaged'
            elif cn > 10 and q_segments == 0:
                status = 'ok'
            elif cn == 0 and q_segments > 0:
                status = 'damaged'
            elif cn > 0 and q_segments > 0:
                status = 'partial'
            elif cn == 0 and q_segments == 0:
                status = 'english-only'
            else:
                status = 'ok'

            return {
                'encoding': 'utf-8-sig' if has_bom else 'utf-8',
                'chinese': cn,
                'status': status,
                'raw': raw,
                'text': text,
                'question_segments': q_segments,
            }
        except UnicodeDecodeError:
            pass

        # 尝试 GBK
        try:
            text = raw.decode('gbk')
            cn = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
            q_segments = len(re.findall(r'\?{5,}', text))

            if cn > 10 and q_segments == 0:
                status = 'ok'
            elif cn > 0:
                status = 'partial'
            else:
                status = 'english-only'

            return {
                'encoding': 'gbk',
                'chinese': cn,
                'status': status,
                'raw': raw,
                'text': text,
                'question_segments': q_segments,
            }
        except UnicodeDecodeError:
            pass

        return {'encoding': 'unknown', 'chinese': 0, 'status': 'undecodable', 'raw': raw}

    except Exception as e:
        return {'encoding': 'error', 'chinese': 0, 'status': 'error', 'error': str(e)}


def scan_directory(directory, extensions=None):
    """扫描目录下的文件"""
    if extensions is None:
        extensions = {'.md'}

    results = {}
    dir_path = Path(directory)

    for root, dirs, files in os.walk(dir_path):
        dirs[:] = [d for d in dirs if d not in {'node_modules', '.git'}]
        for filename in files:
            filepath = Path(root) / filename
            if filepath.suffix.lower() in extensions:
                rel_path = str(filepath.relative_to(dir_path))
                info = detect_encoding(str(filepath))
                results[rel_path] = info

    return results


def find_recoverable(backup_files, target_files):
    """找出可恢复的文件"""
    recoverable = []
    already_ok = []
    backup_only = []

    for rel_path, backup_info in backup_files.items():
        if backup_info['status'] == 'ok':
            if rel_path in target_files:
                target_info = target_files[rel_path]
                if target_info['status'] in ('damaged', 'partial', 'undecodable'):
                    recoverable.append({
                        'rel_path': rel_path,
                        'backup_encoding': backup_info['encoding'],
                        'backup_chinese': backup_info['chinese'],
                        'target_status': target_info['status'],
                    })
                elif target_info['status'] == 'ok':
                    already_ok.append(rel_path)
                else:
                    recoverable.append({
                        'rel_path': rel_path,
                        'backup_encoding': backup_info['encoding'],
                        'backup_chinese': backup_info['chinese'],
                        'target_status': target_info['status'],
                    })
            else:
                backup_only.append({
                    'rel_path': rel_path,
                    'backup_encoding': backup_info['encoding'],
                    'backup_chinese': backup_info['chinese'],
                })

    return recoverable, already_ok, backup_only


def restore_file(backup_path, target_path, backup_encoding):
    """从备份恢复文件，转换为 UTF-8 无 BOM"""
    # 读取备份文件
    with open(backup_path, 'rb') as f:
        raw = f.read()

    # 根据编码解码
    if backup_encoding == 'gbk':
        text = raw.decode('gbk')
    elif backup_encoding == 'utf-8-sig':
        text = raw[3:].decode('utf-8')
    elif backup_encoding == 'utf-8':
        text = raw.decode('utf-8')
    else:
        # 尝试自动检测
        try:
            text = raw.decode('utf-8')
        except:
            text = raw.decode('gbk')

    # 确保目标目录存在
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    # 写入 UTF-8 无 BOM
    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(text)

    return True


def main():
    parser = argparse.ArgumentParser(description='从备份恢复损坏的文档')
    parser.add_argument('--backup', required=True, help='备份目录路径')
    parser.add_argument('--target', default='docs', help='目标目录路径')
    parser.add_argument('--dry-run', action='store_true', help='预览模式，不实际修改')
    parser.add_argument('--ext', nargs='+', default=['.md'], help='文件扩展名')
    parser.add_argument('--report', help='输出 JSON 报告')
    args = parser.parse_args()

    extensions = {e.lower() if e.startswith('.') else '.' + e.lower() for e in args.ext}

    backup_path = os.path.abspath(args.backup)
    target_path = os.path.abspath(args.target)

    print(f"备份目录: {backup_path}")
    print(f"目标目录: {target_path}")
    print()

    # 扫描
    print("扫描备份目录...")
    backup_files = scan_directory(backup_path, extensions)
    print(f"  找到 {len(backup_files)} 个文件")

    print("扫描目标目录...")
    target_files = scan_directory(target_path, extensions)
    print(f"  找到 {len(target_files)} 个文件")
    print()

    # 找出可恢复文件
    recoverable, already_ok, backup_only = find_recoverable(backup_files, target_files)

    print("=" * 60)
    print("  恢复分析报告")
    print("=" * 60)
    print()
    print(f"  可恢复文件: {len(recoverable)} 个")
    print(f"  目标中已正常: {len(already_ok)} 个")
    print(f"  仅备份中有: {len(backup_only)} 个")
    print()

    if recoverable:
        print("可恢复文件列表（前 20 个）:")
        for item in sorted(recoverable, key=lambda x: x['rel_path'])[:20]:
            print(f"  [{item['backup_encoding']:8s}] {item['rel_path']} (目标状态: {item['target_status']})")
        if len(recoverable) > 20:
            print(f"  ... 还有 {len(recoverable) - 20} 个")
        print()

    # 执行恢复
    if not args.dry_run and recoverable:
        print("=== 执行恢复 ===")
        success = 0
        failed = 0

        for item in recoverable:
            rel_path = item['rel_path']
            backup_file = os.path.join(backup_path, rel_path)
            target_file = os.path.join(target_path, rel_path)

            try:
                restore_file(backup_file, target_file, item['backup_encoding'])
                success += 1
            except Exception as e:
                print(f"  失败: {rel_path} - {e}")
                failed += 1

        print()
        print(f"恢复完成: 成功 {success} 个, 失败 {failed} 个")
        print()
        print("建议:")
        print("  1. 用编码健康检查脚本验证结果")
        print("     python scripts/check-encoding-health.py docs/ --ext .md")
        print("  2. 用 git diff 检查变更")
        print("     git diff --stat docs/")
    elif args.dry_run:
        print("（预览模式，未实际修改文件）")
        print("使用 --dry-run 去掉后执行实际恢复")

    # 保存报告
    if args.report:
        report = {
            'backup_dir': backup_path,
            'target_dir': target_path,
            'recoverable_count': len(recoverable),
            'already_ok_count': len(already_ok),
            'backup_only_count': len(backup_only),
            'recoverable': recoverable,
            'already_ok': already_ok,
            'backup_only': backup_only,
        }
        with open(args.report, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"详细报告已保存到: {args.report}")


if __name__ == '__main__':
    main()
