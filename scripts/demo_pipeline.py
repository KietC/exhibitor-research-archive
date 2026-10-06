#!/usr/bin/env python3
"""Run an offline synthetic pipeline. / 运行不联网的合成数据演示。"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from build_manifest import linklike

ROOT = Path(__file__).resolve().parents[1]

def save_json(path: Path, value):
    # All generated artifacts remain in the caller's demo workspace.
    # 所有生成结果只放在调用者指定的演示工作目录。
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("work/demo"))
    args = parser.parse_args()
    if any(linklike(item) for item in (args.output, *args.output.parents)):
        parser.error("demo output must not traverse a symlink or junction")
    output = args.output.resolve()
    marker = output / ".synthetic-demo"
    if output.exists() and any(output.iterdir()):
        # Only an exact ownership marker allows this fixed synthetic demo to rerun.
        # 只有精确的演示归属标记才能让这个固定合成示例重跑。
        if linklike(marker) or not marker.is_file() or marker.read_text(encoding="utf-8") != "synthetic-exhibitor-demo-v1\n":
            parser.error("refusing to write into a non-demo directory; use a new output directory")
        allowed = {".synthetic-demo", "initial.json", "baseline.json", "queue.json", "contacts.json", "index", "pages", "preview.csv", "demo_report.json"}
        if any(item.name not in allowed for item in output.iterdir()):
            parser.error("unknown file in demo output; preserve it and use a new directory")
        for current, directories, names in os.walk(output, followlinks=False):
            for name in directories + names:
                if linklike(Path(current) / name):
                    parser.error("demo output contains a symlink or junction")
    node = shutil.which("node")
    if not node:
        parser.error("Node.js 20+ must be available as node on PATH")
    output.mkdir(parents=True, exist_ok=True)
    marker.write_text("synthetic-exhibitor-demo-v1\n", encoding="utf-8")
    initial, baseline, queue, crawl = [output / name for name in ("initial.json", "baseline.json", "queue.json", "contacts.json")]
    # Invented records are not anonymized operational records.
    # 示例完全重新构造，不是匿名化后的生产记录。
    save_json(initial, {"ReturnObj": {"ExhibitorList": [
        {"Id": 101, "Name": "Demo Company Alpha", "CatCountryDesc": "Exampleland", "BoothNames": ["DEMO-A"], "ShowOnDrawingSeq": [1]},
        {"Id": 102, "Name": "Demo Company Beta", "CatCountryDesc": "Exampleland", "BoothNames": ["DEMO-B"], "ShowOnDrawingSeq": [1]},
        {"Id": 103, "Name": "Demo Hidden Object", "ShowOnDrawingSeq": None},
    ]}})
    subprocess.run([node, str(ROOT / "scripts/extract_ungerboeck_exhibitors.mjs"), str(initial), str(baseline), "2"], check=True)
    subprocess.run([node, str(ROOT / "scripts/init_research_index.mjs"), str(baseline), str(output / "index"), "2", "--overwrite"], check=True)
    save_json(queue, {"rows": [
        {"row_number": 1, "company_name": "Demo Company Alpha", "identity": {"official_domain": "alpha.example.test", "official_website_url": "https://alpha.example.test/"}},
        {"row_number": 2, "company_name": "Demo Company Beta", "identity": {"official_domain": "beta.example.test", "official_website_url": "https://beta.example.test/"}},
    ]})
    # A local fetch fixture guarantees that the demo needs no network or login.
    # 本地 fetch 测试替身保证演示不需要网络和登录。
    fixture = (ROOT / "tests/fixtures/fetch_stub.mjs").as_uri()
    subprocess.run([node, "--import", fixture, str(ROOT / "scripts/public_contact_crawl.mjs"), str(queue), str(output / "pages"), str(crawl)], check=True)
    contacts = json.loads(crawl.read_text(encoding="utf-8"))
    with (output / "preview.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["Company", "Booth", "Country", "Phone candidate", "Email candidate", "Business field", "Profile", "Information source", "Contact source"])
        for index, result in enumerate(contacts["results"]):
            writer.writerow([result["company_name"], "DEMO-A" if index == 0 else "DEMO-B", "Exampleland", result["candidates"]["phone"], result["candidates"]["email"], "Pending verification", "Pending verification", "Pending verification", result["candidates"]["contact_source"]])
    if contacts["result_count"] != 2:
        raise RuntimeError("demo row count changed")
    report = {"schema": "synthetic-demo-report-v1", "generated_at_utc": datetime.now(timezone.utc).isoformat(), "status": "pass", "synthetic_only": True, "network_requests": 0, "baseline_rows": 2, "contact_result_rows": contacts["result_count"], "workbook_written": False, "note": "Contact candidates are not approved research findings."}
    save_json(output / "demo_report.json", report)
    print(json.dumps(report, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
