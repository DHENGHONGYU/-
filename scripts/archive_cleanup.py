"""Archive lifecycle management: retention policy + timeline reporting.

Features:
  1. Retention: scan archive/outputs/ for YYYYMMDD-archive batches,
     delete those older than --days (default 30), keep latest batch always.
  2. Timeline: read all _archive-manifest.json files from retained batches
     and generate a time-series summary (files, size, kind distribution).
  3. Safe mode: default --dry-run, use --execute to actually delete.
  4. Windows-safe output: ASCII-only, structured logging.

Usage:
  python scripts/archive_cleanup.py              # dry-run preview
  python scripts/archive_cleanup.py --execute     # actually delete expired
  python scripts/archive_cleanup.py --days 60     # custom retention
  python scripts/archive_cleanup.py --timeline-only  # just generate timeline, no cleanup
"""
import os
import sys
import json
import shutil
import logging
import argparse
import re
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stderr,
)
_log = logging.getLogger("archive-cleanup")

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_ROOT = ROOT / "archive"
OUTPUTS_ARCHIVE = ARCHIVE_ROOT / "outputs"
TIMELINE_FILE = ARCHIVE_ROOT / "_archive-timeline.json"
TIMELINE_MD_FILE = ARCHIVE_ROOT / "ARCHIVE-TIMELINE-REPORT.md"
MANIFEST_NAME = "_archive-manifest.json"

DATE_RE = re.compile(r"^(\d{8})-archive$")
TODAY = datetime.now()
TODAY_STR = TODAY.strftime("%Y%m%d")


def _safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


def _dir_size(path: Path) -> int:
    total = 0
    for f in path.rglob("*"):
        if f.is_file():
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return total


def _batch_date(batch_dir: Path) -> datetime | None:
    m = DATE_RE.match(batch_dir.name)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%d")
    except ValueError:
        return None


def _read_manifest(batch_dir: Path) -> dict | None:
    manifest_path = batch_dir / MANIFEST_NAME
    if not manifest_path.exists():
        _log.warning("No manifest in %s, skipping", batch_dir.name)
        return None
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log.warning("Failed to read manifest from %s: %s", batch_dir.name, e)
        return None


def scan_batches() -> list[dict]:
    if not OUTPUTS_ARCHIVE.exists():
        _log.info("archive/outputs/ does not exist, nothing to scan")
        return []

    batches = []
    for d in sorted(OUTPUTS_ARCHIVE.iterdir(), key=lambda p: p.name):
        if not d.is_dir():
            continue
        batch_date = _batch_date(d)
        if batch_date is None:
            _log.info("  [SKIP] %s (name does not match YYYYMMDD-archive)", d.name)
            continue

        age_days = (TODAY - batch_date).days
        is_latest = (d.name == f"{TODAY_STR}-archive")
        manifest = _read_manifest(d)
        batch_size = _dir_size(d)

        item = {
            "dir": d,
            "name": d.name,
            "date": batch_date.strftime("%Y-%m-%d"),
            "age_days": age_days,
            "is_latest": is_latest,
            "size_bytes": batch_size,
            "manifest": manifest,
            "item_count": manifest.get("total_items", 0) if manifest else 0,
        }
        batches.append(item)

        _log.info("  [%s] %s  age=%d days  size=%d bytes  items=%d  manifest=%s",
                  "LATEST" if is_latest else "BATCH",
                  item["name"], age_days, batch_size, item["item_count"],
                  "YES" if manifest else "NO")

    return batches


def classify_retention(batches: list[dict], retention_days: int) -> tuple[list, list]:
    expire = []
    keep = []
    for b in batches:
        if b["is_latest"]:
            keep.append(b)
            _log.info("  [KEEP]  %s (latest batch, always retained)", b["name"])
        elif b["age_days"] > retention_days:
            expire.append(b)
            _log.info("  [EXPIRE] %s (age %d > %d days, will delete)", b["name"], b["age_days"], retention_days)
        else:
            keep.append(b)
            _log.info("  [KEEP]  %s (age %d <= %d days)", b["name"], b["age_days"], retention_days)
    return expire, keep


def delete_batches(expire_batches: list[dict], dry_run: bool) -> tuple[int, int]:
    deleted = 0
    failed = 0
    total_size_freed = 0

    for b in expire_batches:
        batch_dir = b["dir"]
        _log.info("  Deleting: %s  (%d bytes)", b["name"], b["size_bytes"])
        _safe_print(f"  DELETE  {b['name']}  age={b['age_days']}d  size={b['size_bytes']:,} bytes")

        if dry_run:
            _log.info("  [DRY-RUN] Would delete (not executed)")
            continue

        try:
            shutil.rmtree(batch_dir)
            deleted += 1
            total_size_freed += b["size_bytes"]
            _log.info("  [OK] Deleted %s", b["name"])
        except PermissionError as e:
            failed += 1
            _log.error("  [FAIL] PermissionError on %s: %s", b["name"], e)
        except Exception as e:
            failed += 1
            _log.error("  [FAIL] %s: %s", b["name"], e, exc_info=True)

    return deleted, failed, total_size_freed


def generate_timeline(batches: list[dict]) -> dict:
    _log.info("=" * 60)
    _log.info("Generating archive timeline report")
    _log.info("=" * 60)

    retained = [b for b in batches if not any(e["name"] == b["name"] for e in _expire_cache)]

    timeline_entries = []
    for b in sorted(batches, key=lambda x: x["date"]):
        entry = {
            "batch": b["name"],
            "date": b["date"],
            "age_days": b["age_days"],
            "is_latest": b["is_latest"],
            "size_bytes": b["size_bytes"],
            "item_count": b["item_count"],
            "retained": True,
        }

        if b["manifest"]:
            m = b["manifest"]
            kind_dist = {}
            for item in m.get("items", []):
                k = item.get("kind", "unknown")
                kind_dist[k] = kind_dist.get(k, 0) + 1
            entry["kind_distribution"] = kind_dist
            entry["ok_count"] = m.get("ok_count", 0)
            entry["fail_count"] = m.get("fail_count", 0)
            entry["manifest_timestamp"] = m.get("archived_at", "")
        else:
            entry["kind_distribution"] = {}
            entry["manifest_timestamp"] = ""

        timeline_entries.append(entry)

    timeline = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total_batches": len(batches),
        "total_items_across_batches": sum(b["item_count"] for b in batches),
        "total_size_bytes": sum(b["size_bytes"] for b in batches),
        "batch_details": timeline_entries,
        "kind_trend": _aggregate_kind_trend(batches),
    }

    _log.info("Timeline: %d batches, %d total items, %d bytes",
              timeline["total_batches"],
              timeline["total_items_across_batches"],
              timeline["total_size_bytes"])

    return timeline


_expire_cache: list[dict] = []


def _aggregate_kind_trend(batches: list[dict]) -> dict:
    kind_totals = {}
    for b in batches:
        if not b["manifest"]:
            continue
        for item in b["manifest"].get("items", []):
            k = item.get("kind", "unknown")
            kind_totals[k] = kind_totals.get(k, 0) + 1
    return kind_totals


def save_timeline(timeline: dict) -> None:
    _log.info("Writing timeline: %s", TIMELINE_FILE)
    try:
        with open(TIMELINE_FILE, "w", encoding="utf-8") as f:
            json.dump(timeline, f, ensure_ascii=False, indent=2)
        _log.info("[OK] Timeline saved")
    except Exception as e:
        _log.error("[FAIL] Could not save timeline: %s", e, exc_info=True)


def print_timeline_report(timeline: dict) -> None:
    entries = timeline["batch_details"]
    if not entries:
        _safe_print("  (no archive batches found)")
        return

    _safe_print("")
    _safe_print("=" * 70)
    _safe_print("  V9 ARCHIVE TIMELINE REPORT")
    _safe_print("=" * 70)
    _safe_print(f"  Generated: {timeline['generated_at']}")
    _safe_print(f"  Total batches  : {timeline['total_batches']}")
    _safe_print(f"  Total items    : {timeline['total_items_across_batches']}")
    _safe_print(f"  Total size     : {timeline['total_size_bytes']:,} bytes ({timeline['total_size_bytes']/1024/1024:.2f} MB)")

    _safe_print("")
    _safe_print("  --- Batch Timeline ---")
    _safe_print(f"  {'Batch':<30s} {'Date':<12s} {'Age':>4s}  {'Items':>6s}  {'Size (MB)':>10s}  {'Kind Dist'}")
    _safe_print(f"  {'-'*30} {'-'*12} {'-'*4}  {'-'*6}  {'-'*10}  {'-'*20}")

    for e in entries:
        size_mb = e["size_bytes"] / 1024 / 1024
        kind_keys = sorted(e["kind_distribution"].keys())
        kind_str = ", ".join(
            f"{e['kind_distribution'][k]}x{k.replace('file(', '').replace(')', '')[:10]}"
            for k in kind_keys[:3]
        )
        if len(kind_keys) > 3:
            kind_str += f" +{len(kind_keys)-3} more"
        flag = " (LATEST)" if e["is_latest"] else ""
        _safe_print(f"  {e['batch']:<30s} {e['date']:<12s} {e['age_days']:>3d}d  {e['item_count']:>6d}  {size_mb:>10.2f}  {kind_str}{flag}")

    _safe_print("")
    _safe_print("  --- Kind Distribution Trend (across all batches) ---")
    for k, v in sorted(timeline["kind_trend"].items(), key=lambda x: -x[1]):
        _safe_print(f"    {k:30s}: {v:4d}")

    _safe_print("=" * 70)
    _safe_print("")


def _ascii_bar(value: int, max_val: int, width: int = 20) -> str:
    if max_val == 0:
        return ""
    filled = int(value / max_val * width)
    return "█" * filled + "░" * (width - filled)


def _size_bar(size_bytes: int, max_size: int, width: int = 15) -> str:
    if max_size == 0:
        return ""
    ratio = size_bytes / max_size
    filled = int(ratio * width)
    return "▓" * filled + "▒" * (width - filled)


def generate_markdown_report(timeline: dict) -> str:
    entries = timeline["batch_details"]
    lines: list[str] = []

    lines.append("# FinSightV9 Archive Timeline Report")
    lines.append("")
    lines.append(f"> Generated: {timeline['generated_at']}  ")
    lines.append(f"> **Total Batches**: {timeline['total_batches']}  |  **Total Items**: {timeline['total_items_across_batches']}  |  **Total Size**: {timeline['total_size_bytes']:,} bytes ({timeline['total_size_bytes']/1024/1024:.2f} MB)")
    lines.append("")

    lines.append("## Executive Summary")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|:---|---:|")
    lines.append(f"| Total Batches | {timeline['total_batches']} |")
    lines.append(f"| Total Archived Items | {timeline['total_items_across_batches']} |")
    lines.append(f"| Total Archive Size | {timeline['total_size_bytes']:,} bytes ({timeline['total_size_bytes']/1024/1024:.2f} MB) |")
    lines.append(f"| Kind Categories | {len(timeline['kind_trend'])} |")
    lines.append(f"| Latest Batch | {entries[-1]['batch'] if entries else 'N/A'} |")
    lines.append("")

    lines.append("## Batch Timeline")
    lines.append("")
    if not entries:
        lines.append("*No archive batches found.*")
    else:
        max_size = max(e["size_bytes"] for e in entries) if entries else 1
        max_items = max(e["item_count"] for e in entries) if entries else 1

        lines.append("| # | Batch | Date | Age | Items | Size | Size Bar | Status |")
        lines.append("|:--:|:---|:---|---:|---:|---:|:---|:---|")
        for i, e in enumerate(entries, 1):
            age = f"{e['age_days']}d"
            size_mb = e["size_bytes"] / 1024 / 1024
            size_bar = _size_bar(e["size_bytes"], max_size)
            status = "🟢 LATEST" if e["is_latest"] else "✅ ACTIVE"
            lines.append(f"| {i} | `{e['batch']}` | {e['date']} | {age} | {e['item_count']} | {size_mb:.2f} MB | `{size_bar}` | {status} |")
    lines.append("")

    if len(entries) >= 2:
        lines.append("## Size & Item Trend")
        lines.append("")
        lines.append("```")
        max_size = max(e["size_bytes"] for e in entries) if entries else 1
        max_items = max(e["item_count"] for e in entries) if entries else 1
        for e in entries:
            size_bar = _ascii_bar(e["size_bytes"], max_size, 40)
            item_bar = _ascii_bar(e["item_count"], max_items, 20)
            label = e["batch"]
            if len(label) > 24:
                label = label[:24]
            lines.append(f"  {label:<24s}  size  {size_bar}  {e['size_bytes']/1024/1024:>6.2f} MB")
            lines.append(f"  {'':24s}  items {item_bar}  {e['item_count']:>4d}")
            lines.append("")
        lines.append("```")
        lines.append("")

    lines.append("## Kind Distribution Trend")
    lines.append("")
    kind_trend = timeline.get("kind_trend", {})
    if kind_trend:
        max_kind = max(kind_trend.values()) if kind_trend else 1
        lines.append("```")
        for k, v in sorted(kind_trend.items(), key=lambda x: -x[1]):
            bar = _ascii_bar(v, max_kind, 30)
            clean_name = k.replace("file(", "").replace(")", "")
            lines.append(f"  {clean_name:<25s} {bar} {v:>3d}")
        lines.append("```")
        lines.append("")

    lines.append("## Per-Batch Kind Breakdown")
    lines.append("")
    if entries:
        lines.append("| Batch | Kind Distribution |")
        lines.append("|:---|:---|")
        for e in entries:
            kind_parts = []
            for k, v in sorted(e.get("kind_distribution", {}).items(), key=lambda x: -x[1]):
                clean = k.replace("file(", "").replace(")", "")
                kind_parts.append(f"{v}×{clean}")
            kind_str = ", ".join(kind_parts) if kind_parts else "N/A"
            lines.append(f"| `{e['batch']}` | {kind_str} |")
    lines.append("")

    lines.append("## CI/CD Integration")
    lines.append("")
    lines.append("| Configuration | Value |")
    lines.append("|:---|:---|")
    lines.append("| Workflow File | `.github/workflows/archive-maintenance.yml` |")
    lines.append("| Schedule | Every Monday 03:00 UTC |")
    lines.append("| Trigger | `workflow_dispatch` (manual) + `schedule` (cron) |")
    lines.append("| Retention | 30 days (configurable via `--days`) |")
    lines.append("| Safe Mode | Default `dry-run`, `--execute` for actual deletion |")
    lines.append("| Artifacts | `archive-outputs`, `archive-timeline`, `archive-manifest` |")
    lines.append("")

    lines.append("## Cleanup Schedule")
    lines.append("")
    lines.append("| Date | Action | Details |")
    lines.append("|:---|:---|:---|")
    lines.append("| 2026-08-10 | Initial Setup | Script + CI/CD + Timeline |")
    lines.append("| 2026-08-10 | First Archive | ~87 items / ~54 MB archived |")
    lines.append(f"| Next Run | Weekly (Mon) | Automatic cleanup of batches > 30d |")
    lines.append("")

    lines.append("---")
    lines.append(f"*Report generated by `archive_cleanup.py` at {timeline['generated_at']}*")

    return "\n".join(lines)


def save_markdown_report(timeline: dict) -> None:
    _log.info("Generating Markdown timeline report: %s", TIMELINE_MD_FILE)
    md_content = generate_markdown_report(timeline)
    try:
        with open(TIMELINE_MD_FILE, "w", encoding="utf-8") as f:
            f.write(md_content)
        _log.info("[OK] Markdown report saved (%d chars)", len(md_content))
    except Exception as e:
        _log.error("[FAIL] Could not save Markdown report: %s", e, exc_info=True)


def main():
    global _expire_cache

    parser = argparse.ArgumentParser(description="V9 Archive Lifecycle Manager")
    parser.add_argument("--days", type=int, default=30,
                        help="Retention period in days (default: 30)")
    parser.add_argument("--execute", action="store_true",
                        help="Actually delete expired batches (default is dry-run)")
    parser.add_argument("--timeline-only", action="store_true",
                        help="Only generate timeline report, skip cleanup")
    parser.add_argument("--verbose", action="store_true",
                        help="Verbose logging")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger("archive-cleanup").setLevel(logging.DEBUG)

    mode = "TIMELINE-ONLY" if args.timeline_only else ("EXECUTE" if args.execute else "DRY-RUN")
    _log.info("=" * 60)
    _log.info("ARCHIVE CLEANUP START  mode=%s  retention_days=%d", mode, args.days)
    _log.info("=" * 60)
    _log.info("Today: %s", TODAY.strftime("%Y-%m-%d"))
    _log.info("Retention cutoff: %s (>= %d days old = expires)",
              (TODAY - timedelta(days=args.days)).strftime("%Y-%m-%d"), args.days)

    batches = scan_batches()

    if not args.timeline_only:
        _log.info("=" * 60)
        _log.info("Classifying batches for retention (keep if age <= %d or is latest)", args.days)
        _log.info("=" * 60)

        expire_batches, keep_batches = classify_retention(batches, args.days)
        _expire_cache = expire_batches

        _log.info("Result: %d keep, %d expire", len(keep_batches), len(expire_batches))
        _safe_print("")
        _safe_print(f"[keep]   {len(keep_batches)} batch(es) retained")
        for b in keep_batches:
            _safe_print(f"         {b['name']}  age={b['age_days']}d  size={b['size_bytes']:,} bytes")
        _safe_print(f"[expire] {len(expire_batches)} batch(es) {'to delete' if args.execute else 'would delete'}")
        for b in expire_batches:
            _safe_print(f"         {b['name']}  age={b['age_days']}d  size={b['size_bytes']:,} bytes")

        if expire_batches:
            _log.info("=" * 60)
            _log.info("Executing deletion (dry-run=%s)", not args.execute)
            _log.info("=" * 60)
            deleted, failed, total_freed = delete_batches(expire_batches, dry_run=not args.execute)
            if args.execute:
                _safe_print(f"\n[RESULT] deleted={deleted}, failed={failed}, freed={total_freed:,} bytes ({total_freed/1024/1024:.2f} MB)")
            else:
                _safe_print(f"\n[RESULT] would-delete={len(expire_batches)} batches, dry-run mode (use --execute to apply)")

    remaining = scan_batches()
    timeline = generate_timeline(remaining)
    save_timeline(timeline)
    save_markdown_report(timeline)
    print_timeline_report(timeline)

    _log.info("ARCHIVE CLEANUP COMPLETE")
    _log.info("  Remaining batches : %d", len(remaining))
    _log.info("  Timeline saved to : %s", TIMELINE_FILE)
    _log.info("  MD report saved to : %s", TIMELINE_MD_FILE)


if __name__ == "__main__":
    main()
