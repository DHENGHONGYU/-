"""Archive historical reports from outputs/ to archive/outputs/ with index generation.

Windows-safe: all stdout uses ASCII only. No emoji. Encoding-safe output wrapper.
Logging: structured INFO/WARNING/ERROR logs at every key node.
Idempotent: safe to run multiple times. Overwrites existing archive entries.
"""
import os
import sys
import shutil
import json
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stderr,
)
_log = logging.getLogger("archive-outputs")

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"
ARCHIVE_ROOT = ROOT / "archive" / "outputs"
TODAY = datetime.now().strftime("%Y%m%d")
ARCHIVE_DIR = ARCHIVE_ROOT / f"{TODAY}-archive"

KEEP_DIRS = {
    "_daemon_run",
    "agent-verification-report",
    "audit-reports",
    "broker-level-data-analysis",
    "chip-analysis-research",
    "output-module-audit",
    "scoring-strategy-audit",
    "tdx-integration-report",
    "v6-calibration-tencent-montage",
    "walkthrough-test-report",
}

def _is_keep_file(name: str) -> bool:
    if name.startswith("."):
        return True
    active_patterns = (
        "weekly-review.md",
        "weekly-run.log",
        "weekly-md-run.log",
        "sector_fund_flow.db",
        f"sector_weekly_monthly_review_{TODAY}.txt",
    )
    for p in active_patterns:
        if p == name:
            return True
    return False

ARCHIVE_DIRS_EXPLICIT = {
    "chaos-reports",
    "qa",
    "strategy-backtest",
    "llm-financial-demo",
}


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
                _log.warning("Permission denied reading size: %s", f)
    return total


def _classify_file(name: str) -> str:
    lower = name.lower()
    ext = lower.rsplit(".", 1)[-1] if "." in lower else ""
    kind_map = {
        "md": "file(MD-REPORT)",
        "html": "file(HTML-REPORT)",
        "pdf": "file(PDF)",
        "docx": "file(DOCX)",
        "xlsx": "file(XLSX)",
        "json": "file(JSON)",
        "csv": "file(CSV)",
        "prom": "file(PROM-CONFIG)",
        "txt": "file(LOG-TEMP)",
        "log": "file(LOG-TEMP)",
        "err": "file(LOG-TEMP)",
        "ps1": "file(SCRIPT-TEMP)",
        "sh": "file(SCRIPT-TEMP)",
        "png": "file(IMAGE)",
        "jpg": "file(IMAGE)",
        "jpeg": "file(IMAGE)",
        "bundle": "file(BUNDLE-TEMP)",
        "sha256": "file(BUNDLE-TEMP)",
    }
    return kind_map.get(ext, "file(MISC)")


def scan_outputs():
    _log.info("=" * 60)
    _log.info("STEP 1: Scan outputs/ directory")
    _log.info("=" * 60)
    _log.info("Source: %s", OUTPUTS)
    _log.info("Keep dirs (%d): %s", len(KEEP_DIRS), sorted(KEEP_DIRS))
    _log.info("Explicit archive dirs (%d): %s", len(ARCHIVE_DIRS_EXPLICIT), sorted(ARCHIVE_DIRS_EXPLICIT))

    if not OUTPUTS.exists():
        _log.error("outputs/ does not exist: %s", OUTPUTS)
        sys.exit(1)

    entries = sorted(OUTPUTS.iterdir(), key=lambda p: p.name)
    _log.info("Found %d top-level entries in outputs/", len(entries))

    to_archive = []
    to_keep = []

    for entry in entries:
        name = entry.name
        if entry.is_dir():
            if name in KEEP_DIRS:
                _log.info("  [KEEP-DIR]  %s  (has shared assets, cannot move)", name)
                to_keep.append((entry, name, "dir(KEEP-ASSET)", 0))
            elif name in ARCHIVE_DIRS_EXPLICIT:
                size = _dir_size(entry)
                _log.info("  [ARCHIVE]   %s  (dir, explicit target, %d bytes)", name, size)
                to_archive.append((entry, name, "dir(EXPLICIT)", size))
            else:
                size = _dir_size(entry)
                _log.info("  [ARCHIVE]   %s  (dir, uncategorized, %d bytes)", name, size)
                to_archive.append((entry, name, "dir(UNCATEGORIZED)", size))
        else:
            if _is_keep_file(name):
                try:
                    size = entry.stat().st_size
                except OSError:
                    size = 0
                _log.info("  [KEEP-FILE] %s  (%d bytes, runtime / active)", name, size)
                to_keep.append((entry, name, "file(ACTIVE)", size))
            else:
                try:
                    size = entry.stat().st_size
                except OSError:
                    size = 0
                kind = _classify_file(name)
                _log.info("  [ARCHIVE]   %s  (%s, %d bytes)", name, kind, size)
                to_archive.append((entry, name, kind, size))

    _log.info("Scan result: %d to archive, %d to keep", len(to_archive), len(to_keep))
    return to_archive, to_keep


def execute_archive(to_archive):
    _log.info("=" * 60)
    _log.info("STEP 2: Execute archive move")
    _log.info("=" * 60)
    _log.info("Destination: %s", ARCHIVE_DIR)
    _log.info("Items to move: %d", len(to_archive))

    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    total_size = 0
    ok_count = 0
    skip_count = 0
    fail_count = 0

    for idx, (src, rel, kind, size) in enumerate(to_archive, 1):
        dst = ARCHIVE_DIR / rel

        if not src.exists():
            _log.warning("  [SKIP] [%d/%d] %s  (source no longer exists)", idx, len(to_archive), rel)
            manifest.append({
                "idx": idx, "name": rel, "kind": kind,
                "size_bytes": size, "status": "SKIP: source missing",
            })
            skip_count += 1
            continue

        _log.info("  Moving [%d/%d]: %s -> %s", idx, len(to_archive), rel, dst)
        _log.info("           kind=%s, size=%d bytes", kind, size)

        try:
            if src.is_dir():
                if dst.exists():
                    _log.warning("           destination exists, removing: %s", dst)
                    shutil.rmtree(dst)
                shutil.move(str(src), str(dst))
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                if dst.exists():
                    _log.warning("           destination exists, overwriting: %s", dst)
                    dst.unlink()
                shutil.move(str(src), str(dst))
            status = "OK"
            ok_count += 1
            _log.info("  [OK]      %s  moved successfully", rel)
        except PermissionError as e:
            status = f"FAIL: PermissionError: {e}"
            fail_count += 1
            _log.error("  [FAIL]    %s  Permission denied: %s", rel, e)
        except Exception as e:
            status = f"FAIL: {type(e).__name__}: {e}"
            fail_count += 1
            _log.error("  [FAIL]    %s  Error: %s", rel, e, exc_info=True)

        manifest.append({
            "idx": idx, "name": rel, "kind": kind,
            "size_bytes": size, "status": status,
        })
        total_size += size

    manifest_path = ARCHIVE_DIR / "_archive-manifest.json"
    _log.info("=" * 60)
    _log.info("STEP 3: Write manifest")
    _log.info("=" * 60)
    _log.info("Manifest path: %s", manifest_path)
    _log.info("Total items: %d, OK: %d, SKIP: %d, FAIL: %d",
              len(manifest), ok_count, skip_count, fail_count)
    _log.info("Total size archived: %d bytes (%.2f MB)", total_size, total_size / 1024 / 1024)

    try:
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump({
                "archived_at": datetime.now().isoformat(timespec="seconds"),
                "archive_dir": str(ARCHIVE_DIR.relative_to(ROOT)),
                "total_items": len(manifest),
                "total_size_bytes": total_size,
                "ok_count": ok_count,
                "skip_count": skip_count,
                "fail_count": fail_count,
                "items": manifest,
            }, f, ensure_ascii=False, indent=2)
        _log.info("[OK] Manifest written successfully")
    except Exception as e:
        _log.error("[FAIL] Could not write manifest: %s", e, exc_info=True)
        raise

    _log.info("=" * 60)
    _log.info("Archive batch complete: %d OK, %d SKIP, %d FAIL", ok_count, skip_count, fail_count)
    _log.info("=" * 60)
    return manifest, total_size, ok_count, skip_count, fail_count


def print_summary(manifest, total_size, ok_count, skip_count, fail_count, to_keep):
    by_kind = {}
    for e in manifest:
        k = e["kind"]
        by_kind[k] = by_kind.get(k, 0) + 1

    _safe_print("")
    _safe_print("=" * 60)
    _safe_print("  V9 OUTPUTS ARCHIVE SUMMARY")
    _safe_print("=" * 60)
    _safe_print(f"  Date        : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    _safe_print(f"  Archive dir : {ARCHIVE_DIR.relative_to(ROOT)}")
    _safe_print(f"  Items moved : {ok_count}")
    _safe_print(f"  Items skip  : {skip_count}")
    _safe_print(f"  Items fail  : {fail_count}")
    _safe_print(f"  Total size  : {total_size:,} bytes ({total_size / 1024 / 1024:.2f} MB)")
    _safe_print("  By kind:")
    for k, v in sorted(by_kind.items(), key=lambda x: -x[1]):
        _safe_print(f"    {k:25s}: {v:4d}")
    _safe_print("  Kept in outputs/ (not moved):")
    for entry, rel, kind, size in to_keep:
        _safe_print(f"    {kind:20s} {rel} ({size:,} bytes)")
    _safe_print("=" * 60)
    _safe_print("")


def main():
    _log.info("=" * 60)
    _log.info("ARCHIVE SCRIPT START")
    _log.info("=" * 60)
    _log.info("CWD    : %s", os.getcwd())
    _log.info("ROOT   : %s", ROOT)
    _log.info("OUTPUTS: %s", OUTPUTS)
    _log.info("ARCHIVE: %s", ARCHIVE_DIR)

    to_archive, to_keep = scan_outputs()

    _safe_print(f"[scan]   keep entries   : {len(to_keep)}")
    for entry, rel, kind, size in to_keep:
        _safe_print(f"         (keep) {kind:20s} {rel}")
    _safe_print(f"[scan]   archive entries: {len(to_archive)}")
    for entry, rel, kind, size in to_archive:
        _safe_print(f"         (move) {kind:20s} {rel} ({size:,} bytes)")

    if not to_archive:
        _log.info("Nothing to archive. All items are either kept or already moved.")
        _safe_print("[archive] nothing to do. exit.")
        return

    manifest, total_size, ok_count, skip_count, fail_count = execute_archive(to_archive)
    print_summary(manifest, total_size, ok_count, skip_count, fail_count, to_keep)

    _log.info("SCRIPT COMPLETE")
    _log.info("  Archived (OK)  : %d", ok_count)
    _log.info("  Skipped        : %d", skip_count)
    _log.info("  Failed         : %d", fail_count)
    _log.info("  Kept in outputs: %d", len(to_keep))


if __name__ == "__main__":
    main()
