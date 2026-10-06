# Company evidence schema

## English

Each baseline row should have:

- stable row number and source object/group IDs;
- original exhibitor name, country, booth, and source-list metadata;
- query strings and timestamps;
- candidate identities plus rejection reasons;
- selected legal/brand name, official domain, address/country, and product match;
- overall and field-level confidence;
- phone, email, business field, and profile values with direct source URLs;
- contradictions, exceptions, review reason, and update time;
- workbook write status and last validation result.

Suggested field object:

```json
{
  "value": "info@example.com",
  "source_url": "https://example.com/contact",
  "confidence": "high",
  "observed_at_utc": "2026-01-01T00:00:00Z",
  "notes": "Role-neutral address on official contact page"
}
```

The master index should reference the company JSON/Markdown paths rather than duplicating every page body.

## 中文

每条基线记录应包含稳定行号、来源对象 ID、原名、国家、展位与名单来源；查询条件与时间；候选主体及拒绝理由；选定法定名称或品牌、官网、地址、国家与产品匹配；整体和字段级置信度；电话、邮箱、业务领域、简介及直接来源；矛盾、异常、待核原因、更新时间；工作簿写入状态与验证结果。

字段建议使用 `value`、`source_url`、`confidence`、`observed_at_utc`、`notes`。公开示例只能用保留域名；真实值留在私有证据目录。

主索引引用公司 JSON/Markdown 路径，不重复存储所有网页正文。证据落盘完成后再更新索引；跨文件更新并非数据库事务，需检查索引与证据是否一致。
