# Source and confidence policy

## English

## Contact-source priority

1. Company website contact, imprint, legal, office, or distributor page.
2. Parent/group official page or official company registry.
3. Official exhibitor document or verified company social profile.
4. High-quality business directory as secondary evidence only.

Do not use exhibition-detail pages, search snippets, customs/trade databases, lead brokers, or scraped aggregators as the direct source of phone/email fields.

## Confidence

- `high`: official domain and entity identity agree; the exact field is present on a direct authoritative page.
- `medium`: identity is plausible but needs a second source or the field is indirect.
- `low`: same-name risk, location/domain/product conflict, stale source, or unsupported inference.

Write high-confidence values. Continue researching medium confidence. Withhold low/conflicting values and preserve a review record.

Explicit markers are acceptable when the workbook requires nonblank cells: `Not publicly disclosed`, `Pending verification`, and `Not applicable`. They must not be used to hide unprocessed rows.

## 中文

### 联系方式来源顺序

1. 公司官网的联系、法律、办公室或经销商页。
2. 母公司或集团官网、官方企业登记。
3. 官方展商资料或已核实企业社交主页。
4. 高质量商业目录仅作为辅助证据。

不能把展会详情、搜索摘要、海关贸易数据库、线索中介或聚合页当作电话邮箱的直接来源。

### 置信度

- `high`：主体与官网一致，准确字段出现在直接权威页面。
- `medium`：身份合理，但仍需第二来源或字段只被间接证明。
- `low`：同名、地址/产品/域名冲突、过时来源或未支持推断。

只写经核实的高可信字段；中可信继续找证据；低可信与冲突项不写。采集器的 `high_pending_identity_crosscheck` 仍是候选，不等于人工确认的 high。

是否使用空值或 `Not publicly disclosed`、`Pending verification`、`Not applicable` 应服从使用者的表格要求；未知标记不能掩盖未处理行。
