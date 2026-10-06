from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class ReleaseAuditTests(unittest.TestCase):
    def invoke(self, directory, *extra):
        # Use isolated synthetic files; real business sources are never read.
        # 只使用隔离的合成文件，测试不读取真实业务来源。
        return subprocess.run([sys.executable, str(ROOT / "scripts/release_audit.py"), str(directory), *extra], capture_output=True, text=True)

    def test_synthetic_source_passes_and_generated_directory_is_pruned(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "README.md").write_text("Synthetic source: info@example.com\n", encoding="utf-8")
            (root / "work").mkdir()
            (root / "work/private.json").write_text("{}", encoding="utf-8")
            result = self.invoke(root)
            self.assertEqual(result.returncode, 0, result.stdout)
            self.assertEqual(json.loads(result.stdout)["file_count"], 1)

    def test_unapproved_data_file_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "contacts.csv").write_text("synthetic", encoding="utf-8")
            result = self.invoke(root)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stdout)["errors"][0]["type"], "not_in_source_allowlist")

    def test_private_origin_is_not_echoed(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as private:
            root = Path(directory)
            token = "SYNTHETIC_" + "DENY_MARKER"
            (root / "README.md").write_text(token, encoding="utf-8")
            deny = Path(private) / "deny.json"
            deny.write_text(json.dumps({"terms": [token]}), encoding="utf-8")
            result = self.invoke(root, "--deny-file", str(deny))
            self.assertEqual(result.returncode, 1)
            self.assertNotIn(token, result.stdout)

    def test_deny_file_inside_public_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deny = root / "deny.json"
            deny.write_text("{}", encoding="utf-8")
            result = self.invoke(root, "--deny-file", str(deny))
            self.assertNotEqual(result.returncode, 0)

    def test_linked_source_directory_is_rejected_before_traversal(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root, external = Path(directory), Path(outside)
            (external / "fixture.py").write_text("print('synthetic')\n", encoding="utf-8")
            link = root / "scripts"
            try:
                if os.name == "nt":
                    created = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(external)], capture_output=True)
                    self.assertEqual(created.returncode, 0)
                else:
                    link.symlink_to(external, target_is_directory=True)
                result = self.invoke(root)
                self.assertEqual(result.returncode, 1)
                self.assertEqual(json.loads(result.stdout)["file_count"], 0)
                built = subprocess.run([sys.executable, str(ROOT / "scripts/build_manifest.py"), str(root)], capture_output=True, text=True)
                self.assertEqual(built.returncode, 1)
                manifest = json.loads((root / "MANIFEST.sha256.json").read_text(encoding="utf-8"))
                self.assertIn("scripts", manifest["rejected_credential_files"])
                self.assertFalse(any("fixture.py" in row["path"] for row in manifest["files"]))
            finally:
                # Remove only the created link, not the linked directory or its contents.
                # 仅移除本测试创建的链接，不递归删除指向的目录及文件。
                if os.name == "nt" and link.exists():
                    link.rmdir()
                elif link.is_symlink():
                    link.unlink()

    def test_demo_refuses_an_invalid_ownership_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / ".synthetic-demo"
            marker.write_text("not-the-demo", encoding="utf-8")
            sentinel = root / "initial.json"
            sentinel.write_text("preserve", encoding="utf-8")
            result = subprocess.run([sys.executable, str(ROOT / "scripts/demo_pipeline.py"), "--output", str(root)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "preserve")

if __name__ == "__main__":
    unittest.main()
