#!/usr/bin/env python3
"""Build a source manifest. / 为源码建立校验清单。"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import uuid
from datetime import datetime, timezone
from pathlib import Path


EXCLUDED_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__", "profile", "browser-data", "data", "artifacts", "evidence", "output", "work", "dist"}
EXCLUDED_SUFFIXES = {".pyc", ".xlsx", ".xls", ".xlsm", ".zip", ".7z", ".har", ".jsonl", ".ndjson"}
BLOCKED_NAMES = {"auth.json", "cookies", "login data", ".env"}
SECRET_PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github_token": re.compile(r"\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b"),
    "bearer_token": re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._-]{24,}"),
    "assigned_secret": re.compile(r"(?i)\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*['\"][^'\"]{12,}['\"]"),
}


def digest(path: Path) -> str:
    # Stream files instead of loading large artifacts into memory.
    # 分块读取，避免把大文件一次放进内存。
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def linklike(path: Path) -> bool:
    # Python 3.10 has no Path.is_junction(); Windows reparse attributes cover it.
    # Python 3.10 没有 Path.is_junction()；Windows 重解析属性也能识别 junction。
    try:
        return path.is_symlink() or bool(getattr(path.lstat(), "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
    except FileNotFoundError:
        return False


def public_files(root: Path):
    # Prune private/generated directories before traversing them.
    # 遍历前排除私有数据和生成目录，不枚举其中的文件。
    for current, directories, names in os.walk(root, followlinks=False):
        kept = []
        for name in sorted(directories):
            if name.lower() in EXCLUDED_DIRS:
                continue
            directory = Path(current) / name
            if linklike(directory):
                yield directory
            else:
                kept.append(name)
        directories[:] = kept
        for name in sorted(names):
            yield Path(current) / name


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--output", type=Path, default=Path("MANIFEST.sha256.json"))
    args = parser.parse_args()
    if linklike(args.root):
        parser.error("root must not be a symlink or junction")
    root = args.root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output

    entries = []
    rejected = []
    suspicious = []
    if not root.is_dir():
        parser.error("root must be an existing directory")
    for path in sorted(public_files(root)):
        if linklike(path):
            if not set(part.lower() for part in path.relative_to(root).parts) & EXCLUDED_DIRS:
                rejected.append(str(path.relative_to(root)).replace("\\", "/"))
            continue
        if not path.is_file() or path.resolve() == output.resolve():
            continue
        relative = path.relative_to(root)
        if not path.resolve().is_relative_to(root):
            rejected.append(relative.as_posix())
            continue
        lowered_parts = {part.lower() for part in relative.parts}
        if lowered_parts & EXCLUDED_DIRS or path.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        if path.name.lower() in BLOCKED_NAMES or path.name.lower().startswith(".env."):
            rejected.append(str(relative).replace("\\", "/"))
            continue
        # Never bypass secret scanning by placing text in an oversized source file.
        # 不能用超大源码文件绕过凭据扫描。
        if path.stat().st_size > 2 * 1024 * 1024:
            suspicious.append({"path": str(relative).replace("\\", "/"), "pattern": "oversized_source"})
        else:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                suspicious.append({"path": str(relative).replace("\\", "/"), "pattern": "non_utf8_source"})
                text = ""
            for label, pattern in SECRET_PATTERNS.items():
                if pattern.search(text):
                    suspicious.append({"path": str(relative).replace("\\", "/"), "pattern": label})
        entries.append({
            "path": str(relative).replace("\\", "/"),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
        })

    manifest = {
        "schema": "portable-source-manifest-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "root_name": root.name,
        "file_count": len(entries),
        "rejected_credential_files": rejected,
        "suspicious_secret_patterns": suspicious,
        "status": "pass" if not rejected and not suspicious else "fail",
        "files": entries,
    }
    # Replace a complete sibling temporary file, never a partially written manifest.
    # 同目录临时文件完成后再替换，防止残缺清单被误认为完整结果。
    if any(linklike(item) for item in (output, *output.parents)):
        parser.error("output path must not traverse a symlink or junction")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps({key: manifest[key] for key in ("file_count", "rejected_credential_files", "suspicious_secret_patterns", "status")}, ensure_ascii=False, indent=2))
    return 0 if manifest["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
