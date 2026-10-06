#!/usr/bin/env python3
"""Check the exact public source boundary. / 检查公开源码的精确边界。"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from build_manifest import BLOCKED_NAMES, SECRET_PATTERNS, digest, linklike, public_files

# The source allowlist is independent of Git's ignore configuration.
# 源码白名单独立于 Git 忽略规则，防止误配时发布业务数据。
ROOT_FILES = {"README.md", "SKILL.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md", ".gitignore", ".gitattributes", ".editorconfig", "package.json", "requirements.txt", "MANIFEST.sha256.json"}
SOURCE_DIRS = {"scripts", "tests", "docs", "references", "agents", "examples", ".github"}
SOURCE_SUFFIXES = {".py", ".mjs", ".md", ".yml", ".yaml", ".json"}
RESERVED_HOSTS = {"example.com", "example.org", "example.net", "localhost"}
PUBLIC_INFRASTRUCTURE = {"github.com", "api.github.com", "raw.githubusercontent.com", "docs.github.com", "nodejs.org", "python.org", "www.python.org", "docs.python.org", "pypi.org", "packaging.python.org", "git-scm.com", "choosealicense.com", "opensource.org", "shields.io", "img.shields.io", "openpyxl.readthedocs.io", "x.com"}
LOCAL_PATH = re.compile(r"(?i)(?<![\w])[a-z]:[\\/][^\s`\"<>]+")
EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
URL = re.compile(r"https?://[^\s`\"'<>\])}]+")

def reserved(host: str) -> bool:
    # Reserved domains make examples safe without anonymizing real customers.
    # 保留域名用于全新合成示例，不是把真实客户改名后发布。
    host = host.lower().rstrip(".")
    return host in RESERVED_HOSTS or host.endswith((".test", ".invalid", ".example")) or any(host.endswith("." + value) for value in RESERVED_HOSTS)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--deny-file", type=Path, help="Private JSON terms/hashes file outside the repository")
    args = parser.parse_args()
    if linklike(args.root):
        parser.error("root must not be a symlink or junction")
    root = args.root.resolve()
    if not root.is_dir():
        parser.error("root must be an existing directory")
    terms, hashes = [], set()
    if args.deny_file:
        deny_path = args.deny_file.resolve()
        if deny_path == root or root in deny_path.parents:
            parser.error("deny-file must be outside the public repository")
        deny = json.loads(deny_path.read_text(encoding="utf-8-sig"))
        terms = [str(value).casefold() for value in deny.get("terms", []) if str(value)]
        hashes = {str(value).lower() for value in deny.get("hashes", [])}
    errors, files = [], []
    for file in sorted(public_files(root)):
        relative = file.relative_to(root)
        name = relative.as_posix()
        if linklike(file) or not file.resolve().is_relative_to(root):
            errors.append({"path": name, "type": "symlink_not_publishable"})
            continue
        if not file.is_file():
            continue
        permitted = name in ROOT_FILES or (relative.parts[0] in SOURCE_DIRS and file.suffix in SOURCE_SUFFIXES)
        if file.suffix == ".json" and name not in ROOT_FILES:
            permitted = relative.parts[0] == "examples" and file.name.endswith(".example.json")
        if not permitted or file.name.lower() in BLOCKED_NAMES or file.name.lower().startswith(".env."):
            errors.append({"path": name, "type": "not_in_source_allowlist"})
            continue
        if file.stat().st_size > 2 * 1024 * 1024:
            errors.append({"path": name, "type": "oversized_source"})
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append({"path": name, "type": "non_utf8_source"})
            continue
        value = digest(file)
        files.append({"path": name, "sha256": value})
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                errors.append({"path": name, "type": label})
        if LOCAL_PATH.search(content):
            errors.append({"path": name, "type": "local_machine_path"})
        if value in hashes or any(term in content.casefold() or term in name.casefold() for term in terms):
            # Never echo the private identity that triggered a failure.
            # 不回显触发失败的私有公司、客户或原始哈希。
            errors.append({"path": name, "type": "private_origin_identifier"})
        for match in EMAIL.finditer(content):
            if not reserved(match.group(1)):
                errors.append({"path": name, "type": "non_synthetic_email"})
                break
        for match in URL.finditer(content):
            try:
                host = urlparse(match.group(0).rstrip(".,;")).hostname or ""
            except ValueError:
                continue  # Intentional malformed URL fixtures. / 有意构造的非法 URL 测试。
            if host and not reserved(host) and host not in PUBLIC_INFRASTRUCTURE and not host.startswith("${"):
                errors.append({"path": name, "type": "non_synthetic_external_url"})
                break
    report = {"schema": "public-source-release-audit-v1", "generated_at_utc": datetime.now(timezone.utc).isoformat(), "file_count": len(files), "status": "pass" if not errors else "fail", "errors": errors, "files": files, "limitations": "Automated checks complement manual source review; they cannot prove the absence of every business identifier."}
    if args.report:
        if any(linklike(item) for item in (args.report, *args.report.parents)):
            parser.error("report path must not traverse a symlink or junction")
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "file_count": len(files), "errors": errors}, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "pass" else 1

if __name__ == "__main__":
    raise SystemExit(main())
