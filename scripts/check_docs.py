#!/usr/bin/env python3
"""Validate bilingual Markdown links and fences. / 验证双语 Markdown 链接和代码块。"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import unquote
from build_manifest import linklike, public_files

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    args = parser.parse_args()
    if linklike(args.root):
        parser.error("root must not be a symlink or junction")
    root = args.root.resolve()
    errors, count = [], 0
    for file in public_files(root):
        if file.suffix != ".md" or linklike(file):
            continue
        count += 1
        text = file.read_text(encoding="utf-8")
        english = re.search(r"^## English\s*$", text, re.M)
        chinese = re.search(r"^## 中文\s*$", text, re.M)
        if not english or not chinese or english.start() > chinese.start():
            errors.append({"path": file.relative_to(root).as_posix(), "type": "english_before_chinese_required"})
        fence = None
        prose = []
        for line in text.splitlines():
            match = re.match(r"^\s*(`{3,}|~{3,})", line)
            if match:
                if fence is None:
                    fence = match.group(1)[0]
                elif match.group(1)[0] == fence:
                    fence = None
                continue
            if fence is None:
                prose.append(line)
        if fence:
            errors.append({"path": file.relative_to(root).as_posix(), "type": "unclosed_code_fence"})
        # Verify local file targets; external links and heading fragments are not fetched.
        # 检查本地文件目标，不联网获取外链，也不验证标题锚点。
        for match in re.finditer(r"\[[^\]]+\]\(([^)]+)\)", "\n".join(prose)):
            value = match.group(1).strip().strip("<>").split("#", 1)[0]
            if not value or re.match(r"^[a-z][a-z0-9+.-]*:", value, re.I):
                continue
            target = (file.parent / unquote(value)).resolve()
            if not target.is_relative_to(root) or not target.exists():
                errors.append({"path": file.relative_to(root).as_posix(), "type": "broken_local_link", "target": value})
    print(json.dumps({"status": "pass" if not errors else "fail", "markdown_files": count, "errors": errors}, ensure_ascii=False, indent=2))
    return 0 if not errors else 1

if __name__ == "__main__":
    raise SystemExit(main())
