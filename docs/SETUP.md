# Installation and Configuration

## English

### 0. Choose the correct workflow

Run the offline demo before configuring a live site. This proves your toolchain works without credentials. For real work, use this order:

```text
install → tests → offline demo → inspect authorized portal requests
→ archive → verify visible-list semantics → freeze baseline → compare refresh
→ research identity → collect candidates → persist evidence → edit a copy
→ verify workbook → translate separately → audit publication copy
```

The toolkit automates selected deterministic steps, not the whole research chain. A successful process exit is not proof of company identity or field accuracy. All commands below run from the cloned repository root unless stated otherwise.

### 1. Install prerequisites

Install Git, a supported Node.js LTS, and Python 3.10+ from their official sources: [Git](https://git-scm.com/), [Node.js](https://nodejs.org/), [Python](https://www.python.org/). The scripts require Node.js 20+ APIs; prefer a currently supported LTS for live use.

Check tools before proceeding:

```text
git --version
node --version
npm --version
python --version
```

On Linux/macOS the interpreter is commonly `python3`. On Windows, if `python` opens a store prompt or selects the wrong interpreter, use `py -3` or the full path to your installed interpreter. After installation, reopen the terminal if PATH is stale. Do not change your system clock or global settings for this project.

### 2. Clone and create an isolated environment

Windows PowerShell:

```powershell
git clone https://github.com/KietC/exhibitor-research-archive.git
Set-Location exhibitor-research-archive
python -X utf8 -m venv .venv
$pythonExe = Join-Path (Get-Location) '.venv/Scripts/python.exe'
& $pythonExe -m pip install -r requirements.txt
& $pythonExe -c 'import openpyxl; print(openpyxl.__version__)'
```

Linux/macOS:

```sh
git clone https://github.com/KietC/exhibitor-research-archive.git
cd exhibitor-research-archive
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -c 'import openpyxl; print(openpyxl.__version__)'
```

Use the environment's interpreter directly; activation is unnecessary. PowerShell execution-policy changes are therefore unnecessary too. Do not run a global `pip install` unless you intentionally want a global installation. Node helpers use standard libraries, so `npm install` is not required. `npm test` is only a command runner.

Files are UTF-8. For old Windows Python defaults, use `-X utf8` or set `$env:PYTHONUTF8 = '1'` in the current terminal only. Quote paths containing spaces. The code explicitly decodes its input files as UTF-8; if your source export uses another encoding, preserve the original and make a separately converted copy.

### 3. Run all offline checks

Windows:

```powershell
npm test
& $pythonExe -m unittest discover -s tests -p 'test_*.py' -v
& $pythonExe scripts/check_docs.py .
& $pythonExe scripts/release_audit.py . --report work/release_audit.json
```

Linux/macOS:

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.venv/bin/python scripts/check_docs.py .
.venv/bin/python scripts/release_audit.py . --report work/release_audit.json
```

Expected: exit code `0`; regression groups and unittests pass; docs/audit show `status: pass`. Tests inject synthetic fetch responses and do not query real companies. Stop and fix a failed check before interpreting live-site results. CI additionally runs on Windows and Linux with multiple runtime versions; do not infer its result without reading the actual run.

### 4. Run and inspect the demo

```powershell
& $pythonExe scripts/demo_pipeline.py --output work/demo
```

On Linux/macOS replace `& $pythonExe` with `.venv/bin/python`.

Expected files:

```text
work/demo/
  .synthetic-demo
  initial.json
  baseline.json
  index/master_index.json
  index/master_index.csv
  queue.json
  contacts.json
  pages/<synthetic-row>/page_*.html
  pages/<synthetic-row>/crawl_result.json
  preview.csv
  demo_report.json
```

The report shows two baseline rows, two contact-result rows, zero network requests, and no workbook write. CSV business/profile fields remain `Pending verification`. The example country is invented. Do not copy these values into real research.

The demo can rerun only in a directory carrying its exact ownership marker. Unknown files, links/junctions or an invalid marker cause refusal. Choose a new directory instead of deleting unrelated data to make it pass. On systems with symlinked directory aliases, choose a physical path.

### 5. Separate source from operational data

Use ignored `work/`, `data/`, `artifacts/`, `evidence/`, `output/` or a separate private workspace for real work. API configuration with real URLs/body values is private even if the token itself is in an environment variable. Keep browser profiles, cookies, HAR and authenticating query strings out of the source tree.

Back up the input workbook and portal snapshots before changes. Record timestamps, original hashes, fixed scope and selection rules privately. Do not commit these operational fingerprints. `.gitignore` is not a removal tool for already tracked data.

### 6. Learn the actual portal/API before configuring requests

Use a supported browser/devtools surface while logged in normally. Inspect the real list request and one detail request: method, payload, IDs, pagination, body format and downloadable file links. Do not enumerate undocumented endpoints or assume another event's configuration works.

Resolve ambiguous filters first. A country field can mean entity address, shipping origin, importer or exporter rather than exhibitor country. Use a few known examples and corroborate the semantics before any batch query. An API response may contain hidden booths or non-company objects that the UI excludes.

Read [API_ARCHIVE](API_ARCHIVE.md). Copy the synthetic config outside the checkout:

```powershell
New-Item -ItemType Directory -Path ../private-work -Force
Copy-Item examples/api-config.example.json ../private-work/api-config.json
```

Edit the private copy with actual verified values. Set `base_url`, exact `allowed_hosts`, unique request names and known `path`/`url`; add `headers_env` only when needed. Do not put tokens in the config. Environment values should be supplied through your normal local secret-management flow rather than typed into shared shell history.

Start with one explicitly configured request:

```sh
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive
```

The example URLs are reserved and will not work live without replacement. Expected live output: raw response bytes and a `manifest.json` containing hashes/statuses, not request-header values or request bodies. Check one response's meaning before expanding the explicit request list. JSON, documents and images can be archived as bytes; the helper does not automatically discover every download link.

### 7. Resume acquisition without mixing archives

```sh
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive --resume
```

Resume requires an existing manifest, unchanged normalized config, GET-only requests and hash-verified saved bytes bound to the right request. It rejects duplicates, unexpected metadata, mismatched file names, symlinks/junctions and altered responses. Config changes require a new output directory. Header environment **values** are not the configuration fingerprint: if you switch account/entity scope, start a new archive even when the variable name remains the same.

There are no automatic retries. `401`, `403`, `429` or another request failure stop the run. Resolve access or wait according to the service's normal rules. POST is sent only as explicitly requested and cannot be resumed or followed through a redirect. A response may contain confidential data even though request credentials are not saved.

### 8. Freeze the visible list

For a VFP-style `ExhibitorList`, first validate `ShowOnDrawingSeq` against the current UI. Pass the observed count, not a historic number. A synthetic run is:

```sh
node scripts/extract_ungerboeck_exhibitors.mjs examples/initial-data.example.json work/baseline.json 2
```

Expected: three synthetic raw objects, two visible rows. For live work substitute your private archived list and current verified count. Preserve the original snapshot separately: rerunning extraction can replace the output file. The count guard does not prove grouping semantics or company identity.

Compare a refresh using [LIST_DIFF](LIST_DIFF.md):

```sh
node scripts/diff_exhibitor_lists.mjs work/baseline.json work/current.json work/list-diff.json
```

Both inputs must share stable group IDs. Review additions/deletions/renames/countries/booths and whitespace-only names. The command does not update the baseline or Excel. New IDs can mean a renamed entity, so reconciliation still requires source evidence.

### 9. Initialize once, then preserve research state

```sh
node scripts/init_research_index.mjs work/baseline.json work/research-index 2
```

For real work replace the synthetic `2` with the frozen count, or omit the optional count only if the input itself is already independently verified. Expected JSON/CSV: row IDs, names, country, booths, object IDs, status, confidence, evidence paths and duplicate-identity flags. Initial fields are unrated and ineligible for workbook writes.

This tool is an **initializer**, not a resume updater. Repeating the command refuses an existing index. `--overwrite` intentionally resets status; use it only for a deliberate reinitialization after preserving the existing research. JSON and CSV are separately atomic, not a cross-file transaction.

### 10. Research identity before contacts

Cross-check name/legal name, country/address, official domain and product description. For common names, require independent corroboration. Use official contact/legal pages, registries and verified company social profiles. Search-result snippets and matching names alone are leads, not proof. Save rejected matches and contradictions.

Use [evidence-schema](../references/evidence-schema.md) and [source-policy](../references/source-policy.md). Write each company's JSON/Markdown privately as soon as it is processed; include queries, direct source URL, observation time, confidence, selected identity, exceptions and status. Update the master index only after evidence exists. Reconcile interrupted cross-file updates.

### 11. Collect official-domain candidates

Copy `examples/contact-queue.example.json` into your private workspace, then replace it with caller-verified official identities. `source_urls` alone cannot establish a website. Positive `row_number` values must be unique. Do not pass a social profile or an unverified namesake as the official website.

```sh
node scripts/public_contact_crawl.mjs work/official-queue.json work/contact-pages work/contact-report.json
```

This is a live command; unlike the demo it makes HTTP requests. Each row saves HTML and `crawl_result.json`. Missing seeds and fetch failures remain explicit. The collector limits traversal and follows only same-domain/subdomain contact links; a legitimate domain migration is withheld for manual review.

Outputs are candidates. `high_pending_identity_crosscheck` is not an approved high-confidence field. Phone formatting, office scope, obsolete contacts and legal entity still need review. Capture direct authoritative field sources, not a general exhibition link. Reusing an output path intentionally replaces same-row artifacts; preserve snapshots when history matters.

### 12. Edit a workbook copy and validate it

The toolkit has **no automatic production-workbook writer**. Use your chosen spreadsheet editor/automation after approving fields. Preserve sheet names, headers, row order, immutable columns, styles, links, formulas and structure. Blank or explicit unknown markers must follow the actual task policy; never invent a plausible value to satisfy a nonblank check.

Example validation for an intentionally nine-column template:

```powershell
$frozen = Get-Content -Raw -Encoding UTF8 work/baseline.json | ConvertFrom-Json
& $pythonExe scripts/verify_workbook.py work/candidate.xlsx --sheet Exhibitors --expected-rows $frozen.visibleExhibitorCount --expected-columns 9 --baseline work/original.xlsx --immutable-columns A,B --source-columns H,I --compare-all-styles --compare-layout --report work/workbook-validation.json
```

Change the sheet, counts and column letters to the actual preserved template. `--required-columns` is optional; do not require phones/emails to be nonblank when the task permits unknowns. Source columns accept direct HTTP(S) URLs or explicit supported markers. Multiple sources should remain the most direct authoritative links.

Expected: `status: pass`, zero structural/source errors. A pass proves only the selected checks, not source truth or every workbook feature. Detailed styles/layout are compared for the selected sheet; other sheets' names/order are checked but need separate content verification. Charts, macros, embedded objects and unsupported formatting require your own preservation/visual review. Cached formula results are inspected but not recalculated.

### 13. Translate only after source validation

Create a separate translated workbook. Translate descriptive fields and country labels as required, not company legal names, brands, domains, email addresses, phones, IDs or booths. Keep the source workbook unchanged. Revalidate immutable fields, layout, row count and every translated field; the toolkit does not provide an automatic translation service.

### 14. Finish research and publish code separately

A finished research task has durable evidence/status for every baseline row, unresolved/conflict lists, source statistics, coverage checks, list differences and final artifact hashes. Unknowns must remain honest; a fully nonblank workbook is not necessarily fully verified.

Code publication is a separate workflow: use a clean source-only copy, run [RELEASE](RELEASE.md), inspect the exact staged files and use `package_source.py`. Do not include research evidence or workbooks. Optional private denylist terms/hashes must stay outside the source repository.

## 中文

### 0. 先选择正确流程

先跑离线演示，再配置真实网站，确认工具链不依赖凭据也能运行。真实任务顺序：

```text
安装 → 测试 → 离线演示 → 观察已授权的网站请求
→ 归档 → 核实名单可见性 → 冻结基线 → 对比刷新名单
→ 核对主体 → 采集候选 → 保存证据 → 编辑副本
→ 验证工作簿 → 独立翻译 → 审计发布副本
```

工具只自动化确定性步骤，不自动完成全部研究。程序成功退出不能证明企业身份或字段真实。以下命令默认都在克隆的仓库根目录执行。

### 1. 安装前置条件

从官方来源安装 [Git](https://git-scm.com/)、仍获支持的 [Node.js LTS](https://nodejs.org/) 和 [Python 3.10+](https://www.python.org/)。代码需要 Node.js 20+ API，真实工作建议使用当前仍受支持的 LTS。

先运行 `git --version`、`node --version`、`npm --version`、`python --version`。Linux/macOS 通常用 `python3`。Windows 的 `python` 若打开商店或选错解释器，改用 `py -3` 或已安装解释器的完整路径。安装后 PATH 未刷新就重开终端，不改系统时钟或全局设置。

### 2. 克隆并创建隔离环境

Windows PowerShell：

```powershell
git clone https://github.com/KietC/exhibitor-research-archive.git
Set-Location exhibitor-research-archive
python -X utf8 -m venv .venv
$pythonExe = Join-Path (Get-Location) '.venv/Scripts/python.exe'
& $pythonExe -m pip install -r requirements.txt
& $pythonExe -c 'import openpyxl; print(openpyxl.__version__)'
```

Linux/macOS：

```sh
git clone https://github.com/KietC/exhibitor-research-archive.git
cd exhibitor-research-archive
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -c 'import openpyxl; print(openpyxl.__version__)'
```

直接使用虚拟环境解释器，无需激活，也无需修改 PowerShell 执行策略。不要不小心用全局 `pip`。Node 工具都是标准库，不需要 `npm install`；`npm test` 只是命令入口。

文件均为 UTF-8。Windows 旧编码默认值可用 `-X utf8`，或仅在当前终端设置 `$env:PYTHONUTF8 = '1'`。含空格的路径加引号。原始导出若是其他编码，保留原件并另做转换副本。

### 3. 跑全部离线检查

Windows：

```powershell
npm test
& $pythonExe -m unittest discover -s tests -p 'test_*.py' -v
& $pythonExe scripts/check_docs.py .
& $pythonExe scripts/release_audit.py . --report work/release_audit.json
```

Linux/macOS 将 `& $pythonExe` 替换为 `.venv/bin/python`。预期退出码为 `0`，回归与单元测试通过，文档和审计显示 `status: pass`。测试使用合成 fetch，不查询真实企业。失败时先修复，再解释真实网站的结果。CI 会在 Windows/Linux 和多个运行时测试，必须查看实际运行，不能假定全绿。

### 4. 运行并检查演示

```powershell
& $pythonExe scripts/demo_pipeline.py --output work/demo
```

Linux/macOS 同样替换解释器。输出包括 `initial.json`、`baseline.json`、索引 JSON/CSV、`queue.json`、`contacts.json`、每行 HTML 和 `crawl_result.json`、`preview.csv`、`demo_report.json` 及 `.synthetic-demo` 归属标记。

报告应为两条基线、两条联系结果、零网络请求、未写工作簿；业务和简介仍为 `Pending verification`，国家也是虚构。不要把演示值填进真实研究。

只有准确归属标记允许重跑。未知文件、链接/junction 或错误标记会拒绝；应换新目录，不删除无关资料来让检查通过。系统目录存在符号链接别名时，选择物理路径。

### 5. 源码与业务数据分开

真实工作使用被忽略的 `work/`、`data/`、`artifacts/`、`evidence/`、`output/` 或独立私有目录。含真实 URL/正文的配置即使令牌在环境变量中，也属于私有资料。浏览器资料、Cookie、HAR、认证查询参数不进入源码树。

编辑前备份工作簿和网站快照，私下记录时间、原哈希、范围和选择规则，不提交这些业务特征。`.gitignore` 不能清除已追踪数据。

### 6. 先学当前接口，再写配置

正常登录后，用受支持的浏览器/devtools 观察名单和一个详情请求：方法、载荷、ID、分页、正文格式、下载链接。不要枚举未记录接口，也不要假设另一个展会的配置能用。

先核清模糊筛选条件。国家可能指主体地址、发货地、进口国或出口国，不一定是展商所在国。少量已知对象试验并交叉核实，再批量查询。接口可能含界面未显示的空展位、展团或非企业对象。

读 [API_ARCHIVE](API_ARCHIVE.md)，复制合成配置到仓库外：

```powershell
New-Item -ItemType Directory -Path ../private-work -Force
Copy-Item examples/api-config.example.json ../private-work/api-config.json
```

在私有副本填核实后的 `base_url`、精确 `allowed_hosts`、唯一请求名和已知 `path`/`url`；必要时加入 `headers_env`，认证值不要写 JSON。通过正常的本地密钥管理流程提供环境变量，避免令牌留在共享命令历史。

先只配置一条真实请求：

```sh
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive
```

保留示例域名不是真实服务，必须替换才能联网。预期得到原始响应和 `manifest.json`，包含哈希状态，不包含请求头值或正文。检查响应语义后再扩充明确清单。可归档 JSON、文档和图片字节，但不会自动找到全部下载链接。

### 7. 不混淆归档的续跑

```sh
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive --resume
```

要求已有清单、归一化配置不变、全部 GET、每份文件哈希正确且绑定对应请求。重复记录、未知元数据、错文件名、链接/junction、响应被改都会拒绝。改配置换新目录。环境变量**值**不参与配置指纹；若切换账号或主体范围，即使变量名相同也应新建归档。

没有自动重试。`401`、`403`、`429` 和其他错误都会停止，按网站正常规则处理权限和等待。POST 仅执行明确请求，不能续跑，也不跟重定向。响应仍可能含保密信息。

### 8. 冻结实际可见名单

VFP 风格名单先在当前界面核实 `ShowOnDrawingSeq`，传入当前观察数量，不使用历史数量。合成示例：

```sh
node scripts/extract_ungerboeck_exhibitors.mjs examples/initial-data.example.json work/baseline.json 2
```

预期三条原始对象、两条可见记录。真实任务换私有归档与核实数量。提取重跑会替换输出，原快照另存。数量校验不能证明分组或主体正确。

按 [LIST_DIFF](LIST_DIFF.md) 对比刷新：

```sh
node scripts/diff_exhibitor_lists.mjs work/baseline.json work/current.json work/list-diff.json
```

两份文件必须共用稳定组 ID。复核新增、删除、名称、国家、展位及纯空白变化。程序不改基线或 Excel；换 ID 也可能是同一主体，仍须原证据核对。

### 9. 初始化一次，之后保留进度

```sh
node scripts/init_research_index.mjs work/baseline.json work/research-index 2
```

真实任务替换示例数量，或仅在输入已独立核实后省略可选数量。JSON/CSV 有行号、名称、国家、展位、对象 ID、状态、置信度、证据路径与重复身份标记。初始字段未评级，不可写正式表。

它是**初始化器，不是续跑更新器**。已有索引会拒绝重跑。`--overwrite` 是有意清空重建状态，先保存旧研究再用。JSON/CSV 分别原子保存，不是跨文件事务。

### 10. 先核主体，再查联系人

同时核名称/法定名称、国家地址、官网域和产品；常见同名需要独立来源。优先官方联系/法律页、登记、已核实企业社交主页；摘要和同名只算线索。保留被排除候选与矛盾。

按 [证据结构](../references/evidence-schema.md) 和 [来源政策](../references/source-policy.md)立即保存每家公司私有 JSON/Markdown，含查询、直接 URL、时间、置信度、选定主体、异常与状态。证据完成后再更新主索引，中断后的跨文件更新需核对一致。

### 11. 采集官网候选

将 `examples/contact-queue.example.json` 复制到私有目录，换为已经核实的官方主体。`source_urls` 不能自行证明官网；正整数 `row_number` 必须唯一。不要把社交资料页或同名企业当官网。

```sh
node scripts/public_contact_crawl.mjs work/official-queue.json work/contact-pages work/contact-report.json
```

这是真实联网命令，与离线演示不同。每行落 HTML 与 `crawl_result.json`，缺种子和请求错误保留。限制遍历，仅跟同域/子域联系页；合法官网迁移也需人工核对。

输出只是候选，`high_pending_identity_crosscheck` 不是已批准的 high。电话格式、办公室范围、旧联系人和法律主体继续核实。填写直接权威字段来源，不用一般展会链接。重用输出路径会有意替换同一行证据，需要历史时保存快照。

### 12. 编辑副本，再验证

工具**没有正式工作簿自动写入器**。批准字段后使用自己的表格工具，保留表名、表头、顺序、不变列、样式、链接、公式和结构。空值/未知标记遵循任务要求，不编造值来满足非空检查。

九列模板的示例验证：

```powershell
$frozen = Get-Content -Raw -Encoding UTF8 work/baseline.json | ConvertFrom-Json
& $pythonExe scripts/verify_workbook.py work/candidate.xlsx --sheet Exhibitors --expected-rows $frozen.visibleExhibitorCount --expected-columns 9 --baseline work/original.xlsx --immutable-columns A,B --source-columns H,I --compare-all-styles --compare-layout --report work/workbook-validation.json
```

表名、列数、字母都替换为实际模板。`--required-columns` 可选，允许未知电话邮箱时不要强制非空。来源列接受直接 HTTP(S) URL 或明确支持的标记，多链接仅保留最直接权威的来源。

预期 `status: pass` 且无结构/来源错误。通过只证明指定检查，不证明来源真实性或全部 Excel 特性。只对指定表详细比较样式布局，其他表检查名称顺序，内容需另核。图表、宏、嵌入对象和不支持格式需另做保留及视觉检查。检查公式缓存但不重新计算。

### 13. 源语言通过后再翻译

另建翻译版，按需求只翻描述和国家，不擅自翻公司法定名称、品牌、域名、邮箱、电话、ID、展位。源表不动。再次校验不变字段、布局、行数和每个翻译字段；本工具没有自动翻译服务。

### 14. 研究交付与源码发布分开

研究完成应具备每行持久化证据/状态、未找到/冲突清单、来源统计、覆盖校验、名单差异和最终哈希。未知要诚实；没有空格不等于全部已核实。

公开代码另走 [RELEASE](RELEASE.md)：新建纯源码副本、审计、查看暂存内容、用 `package_source.py` 打包，不含企业证据或工作簿。私有拒绝名单一直留在仓库外。
