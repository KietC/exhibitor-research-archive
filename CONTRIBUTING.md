# Contributing

## English

### Before opening an issue

Read [SETUP](docs/SETUP.md) and [PITFALLS](docs/PITFALLS.md), reproduce with the smallest invented fixture, and record runtime versions, command, exit code, expected and actual behavior. Do not attach real company records, contacts, workbook data, browser sessions, private paths or headers. Use [SECURITY](SECURITY.md) for vulnerabilities.

### Development order

1. Fork/clone the public repository and create a focused branch.
2. Install Python dependencies in a virtual environment; no Node package installation is required.
3. Modify the relevant helper and add a behavioral regression using reserved domains and invented records.
4. Run:

   ```sh
   npm test
   python -m unittest discover -s tests -p 'test_*.py' -v
   python scripts/demo_pipeline.py --output work/contribution-demo
   python scripts/check_docs.py .
   python scripts/release_audit.py . --report work/release_audit.json
   ```

   Use your virtual environment's Python path. Preserve original test input files and verify that failed operations do not overwrite them.

5. Update the affected English section first and the corresponding Chinese section after it. Keep command names/flags/JSON keys identical. Write meaningful code comments in English followed by Chinese.
6. Rebuild `MANIFEST.sha256.json` with `python scripts/build_manifest.py .` after all source changes. Inspect the exact diff and staged files, then submit a pull request with commands/results.

### Review expectations

Keep changes narrowly scoped and avoid unrelated formatting churn. Add tests for actual behavior rather than matching prose or implementation details. State limitations, single-file atomicity boundaries and unsupported portal/workbook features. Never expand a frozen list, weaken identity checks, automatically accept contacts or bypass service limits as an incidental “fix.”

All contributed code must be redistributable under MIT. Do not copy proprietary vendor scripts or third-party data into tests. Synthetic fixtures are newly invented, not anonymized real records. Preserve privacy gates and exact output-path checks.

## 中文

### 提交 issue 之前

先读 [SETUP](docs/SETUP.md) 与 [PITFALLS](docs/PITFALLS.md)，用最小虚构样例复现，记录运行时、命令、退出码、预期和实际结果。不要附真实企业、联系人、工作簿数据、浏览器会话、私有路径或请求头。漏洞按 [SECURITY](SECURITY.md) 处理。

### 开发顺序

1. Fork/克隆公开仓库，建立针对性分支。
2. 在虚拟环境安装 Python 依赖，Node 不需要安装额外包。
3. 修改相关工具，并用保留域名与虚构记录加行为回归。
4. 运行：

   ```sh
   npm test
   python -m unittest discover -s tests -p 'test_*.py' -v
   python scripts/demo_pipeline.py --output work/contribution-demo
   python scripts/check_docs.py .
   python scripts/release_audit.py . --report work/release_audit.json
   ```

   使用虚拟环境解释器，保留测试原件，确认失败操作不覆盖输入。

5. 英文段在前、对应中文在后，命令、参数与 JSON 键一致；关键注释英文后紧接中文。
6. 全部改完再用 `python scripts/build_manifest.py .` 重建清单，检查精确差异和暂存文件，然后提交 PR，附命令结果。

### 审核要求

修改聚焦，不混无关格式变化。测试实际行为，不只匹配文案或实现细节。写清限制、单文件原子边界、未支持的网站和表格特性。不要顺手扩大固定名单、弱化身份核对、自动接受联系人或绕过限流。

贡献代码须可按 MIT 发布，不复制专有网站脚本或第三方数据进测试。合成示例必须重新构造，不是匿名化真实记录。保留隐私门禁和精确输出路径检查。
