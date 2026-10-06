# Reproducible workflow

## English

## Acquisition

Capture the landing page, loaded JavaScript modules, API request/response bodies, images, downloads, and the relationship between visible UI objects and API objects. Prefer targeted response-body capture over dumping an unbounded browser event stream.

For authenticated portals, reuse the user's authorized browser session only for acquisition. Persist response bodies without persisting Cookie or Authorization headers.

## Population freeze

Record total raw objects, visible exhibitor count, unique IDs, duplicate brand/group relationships, and the exact selection rule. Export the frozen baseline before company research starts. Later list refreshes produce a diff report; they do not silently rewrite the baseline.

## Research and identity

Search with company name, country, city, product terms, and legal-name variants. Confirm the official domain. Require multiple identity dimensions for common names. Save rejected candidates and contradictions so a later run does not repeat bad matches.

## Evidence and status

Use one folder per baseline row. Write JSON for automation and Markdown for human review. Recommended states are `not_started`, `in_progress`, `complete`, and `needs_review`. Keep research status separate from workbook-write status.

## Workbook

Back up the workbook before editing. Produce a candidate file, run structural and policy checks, then atomically promote it. Generate translated workbooks only after the source-language workbook passes validation.

## Final report

Report missing contacts, identity conflicts, low-confidence records, list differences, source statistics, completeness checks, and final hashes. A script finishing without these checks is not completion.

## 中文

### 采集

保存入口页面、相关脚本、响应、图片、下载文件及界面对象与接口对象的关系。优先定向保存响应正文，不倾倒无限增长的浏览器事件流。登录只用于获授权的采集；不持久化 Cookie 或认证请求头。API 工具仅执行明确配置的已知请求。

### 冻结范围

记录原始对象数、可见展商数、唯一 ID、品牌分组及选择规则。研究前导出固定基线；之后刷新名单只生成差异，不静默改变基线。

### 身份核对

结合名称、国家、城市、产品与法定名称变体，确认官网域名。常见同名公司必须用多项身份维度核对，保留被拒绝候选与矛盾证据。

### 证据与状态

每行一个目录，JSON 供程序读取，Markdown 供人工复核。状态建议 `not_started`、`in_progress`、`complete`、`needs_review`。研究状态与 Excel 写入状态分开。索引初始化器不负责续跑合并；已有索引应继续读取并谨慎更新。

### 工作簿

编辑前备份，生成候选文件，结构与来源校验通过后原子替换。源语言版本通过后才生成翻译版。只核验指定工作表的详细样式和布局；其他工作表的名称与顺序保持不变，并按实际编辑范围额外核查。

### 最终报告

交付未找到联系方式、身份冲突、低置信度、名单差异、来源统计、完整性与哈希。脚本退出成功不等于研究已经完成。
