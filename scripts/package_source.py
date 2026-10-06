#!/usr/bin/env python3
"""Create a verified source-only ZIP. / 创建经过验证的纯源码 ZIP。"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path
from build_manifest import digest, linklike


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("zip", type=Path)
    parser.add_argument("--deny-file", type=Path)
    args = parser.parse_args()
    if linklike(args.root):
        parser.error("root must not be a symlink or junction")
    root, output = args.root.resolve(), args.zip.absolute()
    if output.resolve().is_relative_to(root):
        parser.error("ZIP must be outside the public repository")
    if output.exists() or any(linklike(item) for item in (output, *output.parents)):
        parser.error("choose a new ZIP path without symlinks or junctions")
    audit = [sys.executable, str(root / "scripts/release_audit.py"), str(root)]
    if args.deny_file:
        audit += ["--deny-file", str(args.deny_file)]
    # Never package before the public-source audit succeeds.
    # 公开源码审计成功之前绝不打包。
    subprocess.run(audit, check=True)
    subprocess.run([sys.executable, str(root / "scripts/build_manifest.py"), str(root)], check=True)
    manifest_file = root / "MANIFEST.sha256.json"
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    if manifest["status"] != "pass":
        raise RuntimeError("manifest failed")
    entries = list(manifest["files"]) + [{"path": "MANIFEST.sha256.json", "sha256": digest(manifest_file)}]
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + "." + uuid.uuid4().hex + ".tmp")
    prefix = root.name
    try:
        with zipfile.ZipFile(temporary, "x", compression=zipfile.ZIP_DEFLATED) as archive:
            for entry in entries:
                file = root / entry["path"]
                if linklike(file) or not file.resolve().is_relative_to(root) or digest(file) != entry["sha256"]:
                    raise RuntimeError("source changed or escaped the source boundary")
                archive.write(file, f"{prefix}/{entry['path']}")
        # Read back each ZIP payload, not merely its entry count.
        # 回读每个 ZIP 条目的实际字节，不只检查条目数。
        with zipfile.ZipFile(temporary) as archive:
            if len(archive.infolist()) != len(entries) or archive.testzip() is not None:
                raise RuntimeError("ZIP integrity failure")
            for entry in entries:
                actual = hashlib.sha256(archive.read(f"{prefix}/{entry['path']}")).hexdigest()
                if actual != entry["sha256"]:
                    raise RuntimeError("ZIP source hash mismatch")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps({"status": "pass", "files": len(entries), "zip_bytes": output.stat().st_size, "zip_sha256": digest(output)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
