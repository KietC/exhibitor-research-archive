---
name: exhibitor-research-archive
description: Archive exhibitor portals and APIs, extract the exact visible exhibitor population, research company identities and official contacts with field-level evidence, and build verified Excel deliverables. Use for trade-show exhibitor crawling, exhibitor-list enrichment, portal/API preservation, and resumable evidence-backed workbook work. Do not use for sending outreach or inventing missing company data.
---

# Exhibitor Research Archive

## English

Build a reproducible archive and an auditable exhibitor workbook without silently expanding the event's visible exhibitor scope.

## Core workflow

1. Preserve the original workbook and the portal's raw HTML, JSON responses, relevant scripts, images, documents, and request metadata before transformation.
2. Discover the portal's actual list semantics. Do not assume every object returned by an initial API is a visible exhibitor. Record the exact field or relation that defines the displayed list and freeze that population as the immutable baseline.
3. Generate a master research index with stable row IDs, original names, countries, booths, source object IDs, status, field-level confidence, evidence paths, and review flags.
4. Research identity before contact data. Cross-check company name, country/address, official domain, and products. A name match alone is insufficient.
5. Prefer official company and contact pages. Use directories and social profiles only as discovery or secondary evidence. Never infer a phone or email from trade records.
6. Save independent JSON and Markdown evidence immediately after each company. Update the master index only after the company evidence is durable.
7. Write only high-confidence fields to the workbook. Preserve worksheet names, row/column order, immutable cells, styles, formulas, and hyperlink targets. Use explicit uncertainty markers rather than guesses.
8. Verify population, workbook structure, source policy, formula errors, evidence/index consistency, and SHA-256 before delivery.

Read [references/workflow.md](references/workflow.md) for the full acquisition-to-delivery procedure. Read [references/evidence-schema.md](references/evidence-schema.md) when creating or validating company evidence. Read [references/source-policy.md](references/source-policy.md) before enriching contacts. For Ungerboeck/VFP portals, read [references/ungerboeck-vfp.md](references/ungerboeck-vfp.md).

## Included deterministic tools

- `scripts/archive_api.mjs`: archive explicitly configured HTTPS JSON and binary responses with secret-safe metadata and verified GET-only resume.
- `scripts/diff_exhibitor_lists.mjs`: report stable-ID list additions, removals, renames, country and booth changes without changing the baseline.
- `scripts/extract_ungerboeck_exhibitors.mjs`: extract the visible exhibitor subset from an archived `GetInitialData` response.
- `scripts/init_research_index.mjs`: create a resumable JSON/CSV master index from the frozen baseline.
- `scripts/public_contact_crawl.mjs`: crawl official-domain pages and collect contact candidates without auto-accepting unrelated domains.
- `scripts/verify_workbook.py`: verify row/column counts, required fields, formula errors, immutable-cell equality, styles, and source URLs.
- `scripts/build_manifest.py`: create a portable SHA-256 manifest while excluding credentials and transient browser data.
- `scripts/release_audit.py`: check a public source allowlist, synthetic examples and optional private origin denylist.
- `scripts/package_source.py`: package only audited source files and verify every ZIP payload hash.
- `scripts/demo_pipeline.py`: run an offline synthetic extraction/index/contact/CSV demonstration.

Run tools against copies or candidate outputs. Never place cookies, access tokens, browser profiles, password stores, or authenticated request headers in portable archives or Git repositories.

## Completion gate

Call the task complete only when:

- the frozen visible population matches the workbook population;
- every baseline row has a durable status and evidence path;
- disputed fields are withheld or explicitly marked for review;
- the workbook passes structural and source-policy checks;
- the final artifacts and reports are covered by a checksum manifest.

## 中文

用于归档展商网站、固定实际可见的展商范围、核对企业身份和官方联系方式、建立证据链并验证 Excel。不得静默扩大处理名单，也不得为缺失信息编造数据。

先阅读 [详细安装](docs/SETUP.md) 和 [踩坑](docs/PITFALLS.md)，按需阅读 [API 归档](docs/API_ARCHIVE.md)、[证据结构](references/evidence-schema.md)、[来源规则](references/source-policy.md) 和 [名单适配器](references/ungerboeck-vfp.md)。

流程：保留原文件与原始响应；在界面核实名单语义后冻结基线；初始化索引；先核对名称、地址/国家、官网和产品，再研究联系方式；每家公司立即保存独立证据；仅写经过核实的高可信字段；保留原表结构、样式、公式和链接；最后核对覆盖率、来源、冲突与哈希。

内置程序支持明确接口归档、归档 JSON 提取、索引初始化、官网候选采集、工作簿验证、公开源码审计和离线演示。它们不提供任意网站自动适配，不自动证明公司身份，不自动填写真正的业务工作簿。现有索引续跑不使用初始化器覆盖重建。

完成标准：所有固定基线记录都有持久化状态与证据引用；争议字段留空或明确标记；工作簿结构和来源验证通过；报告与最终文件有校验值。运行结束不等于研究结束。Cookie、令牌、浏览器资料、真实企业记录和工作簿不进入源码仓库。
