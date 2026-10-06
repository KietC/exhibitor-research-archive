# Pitfalls and Recovery

## English

### Regression-tested failure patterns

| Symptom | Cause | Fix / proof |
| --- | --- | --- |
| API list is larger than the visible exhibitor list | Hidden/non-company/group objects share the initial response | Verify visibility in UI; count guard and stable-ID extraction |
| A refreshed list silently expands research scope | New rows were merged into a frozen baseline | Diff only; approve scope changes separately |
| Same-name brands collapse into one entity | Name/country treated as a unique company key | Preserve stable group IDs; flag duplicates and investigate |
| Rerun erases research statuses | Initializer mistaken for resume | Default refusal; `--overwrite` means deliberate reset |
| Empty official seed aborts a batch | Output directory existed only inside fetch loop | Persist `no_official_seed_url` per row |
| Auxiliary search URL becomes “official” | First arbitrary source used to infer the domain | Require caller-selected official identity |
| Cross-domain `/contact` becomes contact source | Redirect target accepted despite blocked fetch | Validate each redirect and source's success/domain |
| Legitimate hostname rejected as a social site | Substring match such as letters resembling `x.com` | Hostname boundary tests, not full-URL substring matching |
| FTP is converted into an HTTPS seed | Blindly prefixing `https://` | Parse existing schemes and reject unsupported ones |
| Two rows overwrite one evidence directory | Repeated row identifier | Reject duplicate positive row numbers before any write |
| Encoded mailto loses or creates an address | Repeated/unsafe decoding or multiple recipients | Decode once, reject malformed/multi-recipient strings |
| Wrong response skipped by API resume | Name/hash not bound to configured request | Bind method, request URL, filename, byte count and hash |
| API resume retains unknown secret metadata | Unvalidated manifest objects reused | Strict allowed metadata and historical URL checks |
| Linked folder leaks external source | Windows junction not treated like a symlink | Reparse detection, traversal pruning and realpath boundary |
| Manifest writes through predictable temporary link | Fixed `.tmp` name followed an existing link | Unique exclusive temporary file; reject linked output |
| Demo overwrites an unrelated directory | Only marker existence checked | Exact marker content, known top-level files, no links |
| Style comparison passes after color/protection change | Workbook-local `style_id` compared | Compare full font/fill/border/alignment/protection/format |
| Hidden rows or sheet protection change unnoticed | Layout comparison too narrow | Selected-sheet visibility, protection and dimension checks |
| Invalid URL crashes verifier | URL parsing outside error handling | Structured `invalid_source` report for malformed URLs |
| “Pending verification” hides a bad hyperlink | Marker bypassed hyperlink validation | Inspect the actual hyperlink when present |

Run `npm test` and Python unittests for executable synthetic reproductions. None of these tests use operational company data.

### Environment and format traps

- Windows may decode UTF-8 as GBK. Use explicit UTF-8 file reads and `python -X utf8`; keep `PYTHONUTF8` changes local to the process/terminal. Garbled console output is not proof that the saved JSON is damaged: inspect the file as UTF-8.
- Invoking a Windows path as an ESM `--import` module fails with an unsupported drive-letter protocol. Use a `file:` URL from `pathToFileURL()`/`Path.as_uri()`, as the included tests do.
- A different Python on PATH may lack `openpyxl` even when another interpreter has it. Run `.venv`'s interpreter and its own `-m pip`. Avoid execution-policy changes by not activating the environment.
- `networkidle` and devtools internals are not universal browser APIs. Use documented browser entry points and targeted response capture; unsupported methods require a different supported approach, not repeated retries.
- Large console/CDP dumps truncate evidence. Persist response bodies directly and keep compact request/status indexes. Never log Cookie/Authorization values.
- Markdown needs blank lines around headings/lists and balanced code fences. Check local file links with `check_docs.py`; GitHub heading anchors and external links still need manual rendering review.
- An API base URL without a trailing slash can change relative-path resolution. Exact allowed hosts include nondefault ports; default HTTPS `443` is normalized away.
- API output path guards intentionally reject symlink/junction aliases, including some OS directory aliases. Choose a physical directory rather than weakening checks.

### Evidence and accuracy traps

No search result is proof that the company is the exhibitor. Confirm name, legal identity, country/address, domain and product context. A parent company, branch, distributor or similarly named company can publish perfectly valid contact information for the wrong entity. Field confidence is independent: an identity match does not prove every phone/email is current.

The contact helper extracts limited HTML `mailto:`/`tel:` candidates, not every JavaScript-rendered or obfuscated contact. Missing output is not proof that a company has no contact. Review a normally accessible official page manually; preserve unresolved status instead of guessing. An official-domain redirect to a new domain is withheld until verified.

Country filters can refer to shipment roles or source-country coverage, not entity domicile. Header variable values are not part of API resume fingerprints; a changed account needs a new archive. API credentials may be absent from metadata while private content is still present in responses.

Use direct authoritative field sources. A home page can support identity while a contact page supports an email; record both privately and put only the strongest direct links in the workbook. Do not convert a trade record, search snippet or social name match into a telephone/email inference.

### Atomicity and recovery limits

“Atomic” applies to **one file replacement**, not multiple files or a database transaction. API bytes and manifest updates, index JSON/CSV, and company evidence/index each have an interruption window between them. On resume, reconcile metadata and saved bytes before calling a row complete.

API resume verifies saved GET responses; it does not verify that the server still has the same current content. To refresh deliberately, use a new archive and compare snapshots. Do not change a failed response or delete its evidence just to make verification pass. POST is not retried/resumed because it can have side effects.

The contact collector is not a resume engine. A rerun can replace same-row artifacts and leave old extra page files if a later capture contains fewer pages. Keep dated/private snapshots or use a new output root for historical comparisons; use the current `crawl_result.json` as the current page index.

### Workbook limits

Only the chosen sheet receives detailed style/layout comparisons. Other sheets' names/order are checked, not every hidden cell, chart, drawing, macro, calculation setting or custom Excel extension. Validate those separately when relevant. The verifier reads formula caches but does not recalculate formulas.

Unknown markers do not mean research was performed. Keep a reason, timestamp and processing status. “All cells nonblank” can merely mean unknown markers were inserted. Translate only descriptions and required labels into a separate workbook; do not alter legal names or contact identifiers.

### Publication limits

A Git ignore rule is not a public-data scrubber. Already tracked files and previous commits remain publishable. Release only a fresh clean source copy and audit the exact staged files/history. Automated patterns and a private origin denylist reduce risk but cannot recognize every sentence containing a business clue. Review prose and fixtures manually.

Do not upload runtime manifests, HAR, screenshots with contacts, enriched workbooks, private denylist files, or legacy scripts containing embedded customer values. See [RELEASE](RELEASE.md) for containment if an exposure is discovered. No destructive history rewrite is performed automatically.

## 中文

### 有回归测试的失败模式

| 表现 | 原因 | 修复或验证 |
| --- | --- | --- |
| API 返回比界面更多的对象 | 含隐藏、非企业或分组对象 | 界面验证可见规则，数量保护与稳定 ID 提取 |
| 刷新后范围悄悄扩张 | 新记录并进固定基线 | 只出差异，范围变化单独批准 |
| 同名品牌合成一家 | 用名称国家当唯一身份 | 保留组 ID，标记重复再调查 |
| 重跑清空研究状态 | 初始化器误当续跑 | 默认拒绝，`--overwrite` 明确表示重建 |
| 缺官网导致整批崩溃 | 只在请求循环里建目录 | 每行记录 `no_official_seed_url` |
| 辅助搜索链接变官网 | 任意首个来源用于推断 | 要求调用方声明已核实的官方身份 |
| 被阻止的跨域联系页成来源 | 忽略请求失败仍接受目标 URL | 跳转逐次验证，来源须成功且在官网域内 |
| 正常域名误判为社交网站 | 对整条 URL 做子串匹配 | 按 hostname 边界测试 |
| FTP 被补成 HTTPS | 无条件加前缀 | 解析原协议，拒绝不支持协议 |
| 两行覆盖同一证据目录 | 行号重复 | 落盘前拒绝重复正整数行号 |
| mailto 解码丢失或伪造地址 | 重复解码或多个收件人 | 只解码一次，拒绝畸形和多收件人 |
| 续跑跳过错响应 | 名称哈希未绑定配置 | 同时绑定方法、URL、文件名、字节和哈希 |
| 续跑保留未知凭据元数据 | 重用未验证清单对象 | 严格字段白名单，重查历史 URL |
| 外部目录进入源码包 | Windows junction 未视作链接 | 重解析属性识别、剪枝与 realpath 边界 |
| 清单写穿固定临时链接 | 固定 `.tmp` 跟随旧链接 | 唯一独占临时文件，拒绝链接输出 |
| 演示覆盖无关目录 | 只看标记存在 | 核对准确标记、根文件白名单和链接 |
| 颜色保护被改仍样式通过 | 比较工作簿内部 `style_id` | 比较完整字体、填充、边框、对齐、保护和格式 |
| 隐藏行或表保护变化漏检 | 布局比较不足 | 核对指定表可见性、保护与行列维度 |
| 非法 URL 令验证器中断 | 解析异常未捕获 | 输出结构化 `invalid_source` |
| 未知标记掩盖坏超链接 | 标记直接跳过验证 | 存在链接时验证真实链接 |

运行 `npm test` 与 Python 单元测试可复现，全部是合成数据，不用真实企业资料。

### 环境与格式

- Windows 可能用 GBK 解 UTF-8。显式 UTF-8 读写，使用 `python -X utf8`；`PYTHONUTF8` 仅当前进程/终端设置。控制台乱码不等于文件损坏，应按 UTF-8 检查原文件。
- Windows 路径直接给 ESM `--import` 会把盘符误当协议。使用 `pathToFileURL()` 或 `Path.as_uri()` 生成 `file:` URL，测试已采用此方式。
- PATH 上另一个 Python 可能缺 `openpyxl`。使用 `.venv` 的解释器及其 `-m pip`，不激活环境就无需改执行策略。
- `networkidle` 和 devtools 内部能力不是所有浏览器都支持。用文档化入口与定向响应保存，不反复重试不支持的 API。
- 大控制台/CDP 转储会截断。正文直接保存，索引用精简请求状态，不记录 Cookie/Authorization 值。
- Markdown 标题列表留空行，代码块闭合。`check_docs.py` 检查本地文件链接，GitHub 锚点和外链仍人工检查渲染。
- 基础 URL 末尾缺 `/` 会改变相对路径解析。白名单精确包含非默认端口；HTTPS 默认 `443` 会被归一化掉。
- 输出路径检查有意拒绝符号链接/junction，包括部分系统目录别名。选择物理目录，不放宽检查。

### 证据与准确性

搜索结果不证明该公司就是展商。必须核名称、法律主体、国家地址、官网和产品背景。母公司、分支、经销商或同名公司也可能发布正确但属于另一主体的联系方式。身份高可信不代表每个字段都当前有效。

采集器仅提有限 HTML 的 `mailto:`/`tel:`，不覆盖所有 JS 渲染或混淆联系方式。没有结果不能证明没有联系人；正常人工浏览官网，保留未解决状态，不猜。跳转到新官网域也须核实后再使用。

国家筛选可能指运输角色或来源覆盖，不是主体注册地。认证环境变量值不进配置指纹，切账号要新建归档。元数据没有凭据，不代表响应没有私人内容。

用直接权威字段来源。首页可能证明身份，联系页证明邮箱；辅助证据私下完整存，表格只放最直接链接。贸易记录、摘要或社交同名不能推断电话邮箱。

### 原子保存和恢复边界

“原子”只指**单文件替换**，不是多文件数据库事务。响应与清单、索引 JSON/CSV、企业证据与索引之间都有中断窗口。续跑前核对元数据和字节，不能仅凭文件存在宣布完成。

API 续跑验证已保存 GET 文件，不保证服务器现时内容未变。主动刷新使用新归档并比较，不改失败响应或删证据来让检查通过。POST 因可能有副作用不重试、不续跑。

官网采集器不是续跑引擎；重跑会替换同一行证据，若后续页数减少，目录可能留下旧的多余页。需要历史就另存快照或换输出根目录，当前页面以 `crawl_result.json` 索引为准。

### 工作簿边界

只有指定表详细比较样式布局，其他表只查名称顺序，不覆盖每个隐藏单元格、图表、绘图、宏、计算配置或自定义扩展。相关特性要另核。检查公式缓存，不重算。

未知标记不表示已研究，仍须理由、时间和状态。“全部非空”可能只是插入了标记。翻译版独立生成，只翻描述与所需标签，不动法定名称和联系标识。

### 发布边界

Git 忽略不是清洗工具，已追踪文件和旧提交仍可能被发布。只发布全新干净源码副本，核对暂存和历史。自动特征及私有拒绝名单降低风险，不能识别每句业务线索，仍人工审阅文字与示例。

不上传运行清单、HAR、带联系人的截图、填好的工作簿、私有拒绝名单或嵌入客户值的旧脚本。发现暴露按 [RELEASE](RELEASE.md) 处理，不自动执行破坏性历史重写。
