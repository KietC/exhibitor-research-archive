# Exhibitor Research Archive

Turn an exhibitor directory into a research list you can check, compare, and resume.

[English](#english) · [中文](#中文) · [Setup](docs/SETUP.md) · [Pitfalls](docs/PITFALLS.md) · [Tests](https://github.com/KietC/exhibitor-research-archive/actions/workflows/tests.yml) · [MIT](LICENSE)

## English

### What you can do with it

Save a trade-show portal's responses, extract the exhibitors actually shown, track which companies still need research, collect contact candidates from checked official websites, and compare two versions of the directory. This is a CLI toolkit plus an optional Codex skill.

Use it for these jobs:

- **Before a trade show:** prepare the visible company/booth list and give each company a research status.
- **After a break:** resume from the saved index instead of losing progress or silently replacing the original list.
- **When the directory changes:** see additions, removals, renames, countries and booth changes; check a finished Excel workbook against its baseline.

### Input → work → result

| You provide | The tool produces | You still review |
| --- | --- | --- |
| Saved portal JSON and the count shown on the website | A fixed visible exhibitor list with IDs, names and booths | Whether the current portal uses the documented visibility rule |
| That list and verified official website domains | A JSON/CSV progress index, saved pages and phone/email candidates | Company identity and whether each contact belongs to it |
| Two directory snapshots, or an existing `.xlsx` workbook | A change report, or read-only workbook validation | Research findings and the final workbook edits |

**Example:** the offline demo starts with three invented portal objects, extracts the two visible exhibitors, creates a progress index and contact-candidate CSV, and saves a report. It makes **zero network requests** and does **not** write a final Excel workbook.

### Platforms and where this fits

The concrete portal adapter in this source is for **Ungerboeck / VFP-style exhibitor portals**. These names matter: the extractor reads saved `GetInitialData` JSON containing `ExhibitorList` and uses `ShowOnDrawingSeq` to select the visible population. They do not mean every event using that software has the same schema.

| Real platform or file target | Role in this project | What is implemented |
| --- | --- | --- |
| Ungerboeck / VFP | Exhibitor-list source | [Archived-response extractor](scripts/extract_ungerboeck_exhibitors.mjs); [field assumptions](references/ungerboeck-vfp.md). Observe the actual requests and configure acquisition for each portal. |
| Company official websites | Contact research | Bounded HTTP collection from caller-verified official domains; results remain candidates. |
| Microsoft Excel `.xlsx` files | Research deliverable | `openpyxl` reads and checks an existing workbook. No live Excel control or automatic final-workbook writer. |
| Codex | Optional research assistant | The supplied `SKILL.md` describes the operator/agent workflow; CLI tools run without it. |

This is **not** a one-click adapter for every website. Verify the portal's requests, schema, visibility rules and company identity. It does not bypass login, automatically finish all company research, infer missing contacts, write a production workbook, or translate one automatically. Real event responses, accounts and lists are not included.

### Try it first

After installing the requirements in [Quick start](#quick-start), run the offline demo from the repository root:

```powershell
& ./.venv/Scripts/python.exe scripts/demo_pipeline.py --output work/demo
```

On Linux/macOS, replace the interpreter with `.venv/bin/python`. Open `work/demo/preview.csv` for the two-row example and `work/demo/demo_report.json` for the completion checks. Then follow [SETUP](docs/SETUP.md) to configure a real portal safely.

### Tools behind the workflow

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

### Related projects

- Use [Local Evidence Collector](https://github.com/KietC/local-evidence-collector) when the task is capturing records from another adapted website, rather than preparing an exhibitor list.
- Use [FactoryTrace](https://github.com/KietC/factorytrace) when a discovered company needs product-specific manufacturer research. Pass reviewed candidates and original sources; a directory entry does not prove that a company manufactures a product. No automatic cross-project handoff is shipped here.

### Use as a Codex skill

The repository root is a skill folder with `SKILL.md` and `agents/openai.yaml`. If you use Codex, place a clean copy in your configured skills directory under the name `exhibitor-research-archive`; do not overwrite an existing customized skill without comparing it. Invoke `$exhibitor-research-archive` and give the actual task scope. The CLI tools also work independently of Codex. No private runtime bundle is required.

### Public-data boundary

Keep real responses, evidence and workbooks in ignored working directories or a separate private store. Never force-add them. `release_audit.py` and `package_source.py` are publication gates, not guarantees that every sensitive prose detail is absent. Review the exact source and Git history manually. See [SECURITY](SECURITY.md).

### License and contributions

All redistributed code is MIT licensed; see [LICENSE](LICENSE). Website data and third-party services keep their own rights and access rules. Submit reproducible defects with synthetic examples through [CONTRIBUTING](CONTRIBUTING.md). Do not put private records in public issues.

## 中文

### 拿它做什么

把展会网站上的名单整理成能核对、对比和继续研究的工作列表：保存网站响应，提取界面实际显示的展商，记录哪些公司还没查完，从已核实的官网找联系方式候选，再比较不同版本名单。这是 CLI 工具包，也附有可选的 Codex skill。

适合三个场景：

- **展会前准备：**整理可见企业和展位名单，为每家公司建立研究状态。
- **中断后继续：**沿用已保存索引，不丢进度，不悄悄替换原名单。
- **网站名单更新：**找新增、删除、改名、国家和展位变化；核对最终 Excel 与基线是否一致。

### 输入 → 处理 → 产出

| 你提供什么 | 工具产出什么 | 还需要你核实什么 |
| --- | --- | --- |
| 已保存的网站 JSON 和当前界面显示数量 | 固定的可见展商名单，保留 ID、企业名和展位 | 当前门户是否采用文档里的可见性规则 |
| 名单和已核实的企业官网域名 | JSON/CSV 研究进度索引、网页原件、电话邮箱候选 | 企业主体是否对应、联系人是否属于这家公司 |
| 两份名单快照，或现有 `.xlsx` 工作簿 | 名单变化报告，或只读工作簿校验 | 研究结论和正式表格填写 |

**小例子：**离线演示从三个虚构门户对象中提取两个可见展商，生成进度索引、联系方式候选 CSV 和检查报告。演示**不发送网络请求**，也**不写最终 Excel**。

### 实际平台与用途

本仓库有明确源码对应的名单适配器是 **Ungerboeck / VFP 风格展商门户**。写出这些名字，是为了说明用在哪里：提取器读取已保存的 `GetInitialData` JSON，找到 `ExhibitorList`，通过 `ShowOnDrawingSeq` 选择可见展商；不是说所有采用该软件的展会都能直接套用同一配置。

| 真实平台或文件对象 | 在流程中的作用 | 当前实现 |
| --- | --- | --- |
| Ungerboeck / VFP | 展商名单来源 | [归档响应提取器](scripts/extract_ungerboeck_exhibitors.mjs)与[字段假设](references/ungerboeck-vfp.md)。各门户仍要观察实际请求、配置采集。 |
| 企业官方网站 | 找联系方式 | 在调用方已核实的官网域名内做有界 HTTP 采集，结果仍是候选。 |
| Microsoft Excel `.xlsx` 文件 | 研究交付表 | 用 `openpyxl` 读取和检查现有工作簿；不控制正在运行的 Excel，也不自动填写正式表格。 |
| Codex | 可选研究助手 | `SKILL.md` 提供人员/代理工作流程，CLI 不依赖 Codex。 |

它**不是任意网站的一键适配器**。必须核实门户请求、Schema、可见性规则和企业身份。它不绕过登录、不自动完成所有企业调查、不猜缺失联系人、不写正式工作簿，也不自动翻译。公开版没有真实展会响应、账号或名单。

### 先看一个结果

按[快速开始](#快速开始)安装依赖后，从仓库根目录运行离线演示：

```powershell
& ./.venv/Scripts/python.exe scripts/demo_pipeline.py --output work/demo
```

Linux/macOS 将解释器换为 `.venv/bin/python`。先打开 `work/demo/preview.csv` 看两行示例，再看 `work/demo/demo_report.json` 核对完成状态；之后按 [SETUP](docs/SETUP.md)配置真实门户。

### 流程背后的工具

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

### 与其他项目怎么配合

- 保存其他已适配网站的记录，而不是准备展商名单时，看 [Local Evidence Collector](https://github.com/KietC/local-evidence-collector)。
- 找到公司后，要调查它是否为某款产品的实际制造方时，看 [FactoryTrace](https://github.com/KietC/factorytrace)。应交接已审核候选和原始来源；出现在展商名单里不等于制造产品。本仓库尚未实现自动跨项目交接。

### 作为 Codex skill 使用

仓库根目录就是 skill 文件夹，含 `SKILL.md` 与 `agents/openai.yaml`。使用 Codex 时，将干净副本放进配置的 skills 目录，文件夹名为 `exhibitor-research-archive`；已有定制版本先比较，不要覆盖。通过 `$exhibitor-research-archive` 调用并给出实际处理范围。CLI 可独立于 Codex 运行，不依赖私有运行时。

### 公开数据边界

真实响应、证据和工作簿留在被忽略的工作目录或独立私有存储，不强制加入 Git。`release_audit.py` 和 `package_source.py` 是发布门禁，不能证明普通文字没有任何敏感细节，仍须人工审阅精确源码和 Git 历史。见 [SECURITY](SECURITY.md)。

### 许可与贡献

发布代码按 MIT 开源，见 [LICENSE](LICENSE)。网站数据和第三方服务保留各自权利及访问规则。请按 [CONTRIBUTING](CONTRIBUTING.md)提交可复现的合成案例，不把私人业务资料写进公开 issue。
