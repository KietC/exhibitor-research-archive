# Exhibitor Research Archive

Evidence-First Portal Toolkit · 证据优先的网站归档与展商研究工具包

[English](#english) · [中文](#中文) · [Setup](docs/SETUP.md) · [Pitfalls](docs/PITFALLS.md) · [Tests](https://github.com/KietC/exhibitor-research-archive/actions/workflows/tests.yml) · [MIT](LICENSE)

## English

### What this project does

An open-source CLI toolkit and reusable Codex skill for archiving known portal/API responses, freezing the exact visible exhibitor population, collecting official-contact candidates, and verifying evidence-backed workbooks.

The repository contains **source code and invented examples only**. It has no production login, exhibitor/customer list, real company profile, contact data, private path, workbook, browser profile or copied vendor JavaScript.

### Capabilities and limits

| Tool | Purpose |
| --- | --- |
| `archive_api.mjs` | Explicit HTTPS JSON/binary acquisition; secret-safe metadata; verified GET-only resume |
| `extract_ungerboeck_exhibitors.mjs` | Extract a visible list from archived VFP-style JSON with count/ID guards |
| `diff_exhibitor_lists.mjs` | Report additions, removals, renames, country/booth changes; never rewrite the baseline |
| `init_research_index.mjs` | Initialize a fixed-population JSON/CSV index; refuse accidental status resets |
| `public_contact_crawl.mjs` | Collect candidates from a caller-verified official domain; block unrelated redirects |
| `verify_workbook.py` | Read-only count, source, immutable-field, style and selected-sheet layout validation |
| `demo_pipeline.py` | Offline synthetic extraction → index → contact candidates → CSV preview |
| `release_audit.py` | Source allowlist, credential checks, reserved examples and optional private denylist |
| `build_manifest.py` / `package_source.py` | Source SHA-256 manifest and verified source-only ZIP |
| `check_docs.py` | English-before-Chinese sections, code fences and local-file links |

This is **not** a one-click adapter for every website. You must verify each portal's request/schema/visibility rules and company identity. It does not bypass login, automatically research every company, infer missing contacts, write a production workbook, or translate one automatically. Contact candidates require identity cross-checking before use.

### Quick start

Requirements: Git, Node.js 20+ (a supported LTS is recommended), Python 3.10+, and `openpyxl` for workbook checks. There are no third-party Node dependencies. Tests and the demo do not need a website account or network requests.

Windows PowerShell:

```powershell
git clone https://github.com/KietC/exhibitor-research-archive.git
Set-Location exhibitor-research-archive
python -X utf8 -m venv .venv
& ./.venv/Scripts/python.exe -m pip install -r requirements.txt
npm test
& ./.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v
& ./.venv/Scripts/python.exe scripts/demo_pipeline.py --output work/demo
& ./.venv/Scripts/python.exe scripts/check_docs.py .
```

Linux/macOS:

```sh
git clone https://github.com/KietC/exhibitor-research-archive.git
cd exhibitor-research-archive
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.venv/bin/python scripts/demo_pipeline.py --output work/demo
.venv/bin/python scripts/check_docs.py .
```

The demo creates two invented companies and reports `synthetic_only: true`, `network_requests: 0`, and `workbook_written: false`. Open `work/demo/demo_report.json` and `work/demo/preview.csv`. Candidate phone/email fields are **not approved findings**. The detailed [setup guide](docs/SETUP.md) explains every stage and how to replace examples safely.

### Documentation map

- [Ordered installation and configuration](docs/SETUP.md)
- [Pitfalls, recovery and limits](docs/PITFALLS.md)
- [Explicit API acquisition](docs/API_ARCHIVE.md)
- [Exhibitor-list differences](docs/LIST_DIFF.md)
- [Evidence workflow](references/workflow.md), [schema](references/evidence-schema.md), [source/confidence policy](references/source-policy.md)
- [Portal adapter assumptions](references/ungerboeck-vfp.md)
- [Public release procedure](docs/RELEASE.md), [security](SECURITY.md), [source boundary](references/provenance.md)
- [README design references](docs/README_DESIGN.md), [contributing](CONTRIBUTING.md), [changelog](CHANGELOG.md)

### Use as a Codex skill

The repository root is a skill folder with `SKILL.md` and `agents/openai.yaml`. If you use Codex, place a clean copy in your configured skills directory under the name `exhibitor-research-archive`; do not overwrite an existing customized skill without comparing it. Invoke `$exhibitor-research-archive` and give the actual task scope. The CLI tools also work independently of Codex. No private runtime bundle is required.

### Public-data boundary

Keep real responses, evidence and workbooks in ignored working directories or a separate private store. Never force-add them. `release_audit.py` and `package_source.py` are publication gates, not guarantees that every sensitive prose detail is absent. Review the exact source and Git history manually. See [SECURITY](SECURITY.md).

### License and contributions

All redistributed code is MIT licensed; see [LICENSE](LICENSE). Website data and third-party services keep their own rights and access rules. Submit reproducible defects with synthetic examples through [CONTRIBUTING](CONTRIBUTING.md). Do not put private records in public issues.

## 中文

### 项目用途

这是开源 CLI 工具包和可复用 Codex skill，用于归档已知网站/API 响应、固定实际可见展商名单、收集官网联系方式候选，并验证有证据支撑的工作簿。

仓库**仅包含源码和重新构造的示例**，没有生产登录、展商或客户名单、真实企业档案、联系方式、私有路径、工作簿、浏览器资料或复制的网站厂商 JavaScript。

### 功能和边界

| 工具 | 用途 |
| --- | --- |
| `archive_api.mjs` | 显式 HTTPS JSON/文件采集，不保存认证值，校验后仅 GET 可续跑 |
| `extract_ungerboeck_exhibitors.mjs` | 从已归档 VFP 风格 JSON 提取可见名单，校验数量和 ID |
| `diff_exhibitor_lists.mjs` | 报告新增、删除、改名、国家和展位差异，不改基线 |
| `init_research_index.mjs` | 初始化固定范围 JSON/CSV 索引，防止误重置进度 |
| `public_contact_crawl.mjs` | 从调用方已核实的官网域采集候选，阻断无关跨域跳转 |
| `verify_workbook.py` | 只读验证数量、来源、不变字段、样式和指定表的布局 |
| `demo_pipeline.py` | 离线合成演示：提取 → 索引 → 联系候选 → CSV 预览 |
| `release_audit.py` | 源码白名单、凭据、示例域名与可选私有拒绝名单检查 |
| `build_manifest.py` / `package_source.py` | 源码 SHA-256 清单与逐文件校验的纯源码 ZIP |
| `check_docs.py` | 检查英文在前中文在后、代码块与本地文件链接 |

它**不是任意网站的一键适配器**。必须自行核实当前网站的请求、Schema、可见性规则和企业身份。它不绕过登录、不自动完成全部企业研究、不猜缺失联系人、不写正式工作簿，也不自动翻译。候选联系方式仍需主体交叉核验。

### 快速开始

需要 Git、Node.js 20+（建议使用仍获支持的 LTS）、Python 3.10+；工作簿验证需要 `openpyxl`。没有额外 Node 依赖。测试和演示无需网站账号，也不发送网络请求。

Windows PowerShell：

```powershell
git clone https://github.com/KietC/exhibitor-research-archive.git
Set-Location exhibitor-research-archive
python -X utf8 -m venv .venv
& ./.venv/Scripts/python.exe -m pip install -r requirements.txt
npm test
& ./.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v
& ./.venv/Scripts/python.exe scripts/demo_pipeline.py --output work/demo
& ./.venv/Scripts/python.exe scripts/check_docs.py .
```

Linux/macOS：

```sh
git clone https://github.com/KietC/exhibitor-research-archive.git
cd exhibitor-research-archive
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.venv/bin/python scripts/demo_pipeline.py --output work/demo
.venv/bin/python scripts/check_docs.py .
```

演示生成两家虚构企业，并报告 `synthetic_only: true`、`network_requests: 0`、`workbook_written: false`。查看 `work/demo/demo_report.json` 与 `work/demo/preview.csv`。电话邮箱只是候选，**不是已审核的研究结论**。[详细配置文档](docs/SETUP.md)逐步说明如何安全替换示例。

### 文档导航

- [安装与配置顺序](docs/SETUP.md)
- [踩坑、恢复与限制](docs/PITFALLS.md)
- [显式 API 采集](docs/API_ARCHIVE.md)
- [展商名单差异](docs/LIST_DIFF.md)
- [证据流程](references/workflow.md)、[结构](references/evidence-schema.md)、[来源与置信度](references/source-policy.md)
- [门户适配假设](references/ungerboeck-vfp.md)
- [公开发布流程](docs/RELEASE.md)、[安全说明](SECURITY.md)、[源码边界](references/provenance.md)
- [README 格式参考](docs/README_DESIGN.md)、[参与贡献](CONTRIBUTING.md)、[版本记录](CHANGELOG.md)

### 作为 Codex skill 使用

仓库根目录就是 skill 文件夹，含 `SKILL.md` 与 `agents/openai.yaml`。使用 Codex 时，将干净副本放进配置的 skills 目录，文件夹名为 `exhibitor-research-archive`；已有定制版本先比较，不要覆盖。通过 `$exhibitor-research-archive` 调用并给出实际处理范围。CLI 可独立于 Codex 运行，不依赖私有运行时。

### 公开数据边界

真实响应、证据和工作簿留在被忽略的工作目录或独立私有存储，不强制加入 Git。`release_audit.py` 和 `package_source.py` 是发布门禁，不能证明普通文字没有任何敏感细节，仍须人工审阅精确源码和 Git 历史。见 [SECURITY](SECURITY.md)。

### 许可与贡献

发布代码按 MIT 开源，见 [LICENSE](LICENSE)。网站数据和第三方服务保留各自权利及访问规则。请按 [CONTRIBUTING](CONTRIBUTING.md)提交可复现的合成案例，不把私人业务资料写进公开 issue。
