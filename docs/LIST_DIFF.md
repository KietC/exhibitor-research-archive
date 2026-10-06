# Exhibitor List Diff / 参展商名单差异

## English

### Purpose

Compare a frozen exhibitor baseline with a newly archived visible list before researching or editing a workbook. Additions and deletions are reported only: this command never modifies either input, expands the baseline, or writes Excel values. It does not fetch a live website.

### Prerequisites and order

1. Install Node.js 20 or later. No extra Node packages are required.
2. Archive and extract each list with the same verified visibility/grouping rules. Keep the old baseline; do not overwrite it with the newest list.
3. Ensure both snapshots use the same stable, positive numeric exhibitor **group IDs**. Do not use company names, array positions, or booth numbers as IDs. If the portal changed its ID scheme, reconcile it manually before using this comparison.
4. Run the command, writing to a separate report path:

   ```sh
   node scripts/diff_exhibitor_lists.mjs work/baseline.json work/current.json work/list-diff.json
   ```

5. Review every substantive difference against the original portal evidence. Keep additions outside the research population until the scope owner explicitly approves a baseline change.

### Accepted input

Each file may be a JSON array or an extractor result with an `exhibitors` array. A minimal synthetic row is:

```json
{
  "groupId": 11,
  "name": "Demo Alpha",
  "countryCode": "EX",
  "countryDescription": "Exampleland",
  "boothNames": ["A.01", "A.02"]
}
```

`groupId` also accepts `Id` or `ID`; `name` also accepts `Name`. Integer strings such as `"11"` are accepted, but scientific-notation strings, zero, negatives, unsafe integers, missing IDs, and duplicate IDs fail. Names must be nonempty strings. `boothNames`/`BoothNames`, when supplied, must be arrays of strings.

Use equivalent country fields in both snapshots. The comparator understands the extractor's country fields and common aliases, but does not translate country names or convert a country code into its full name.

### Report categories

| Category | Meaning |
| --- | --- |
| `added` | An ID exists only in the current list. |
| `deleted` | An ID exists only in the baseline. |
| `renamed` | A matched ID has a different name after whitespace normalization. |
| `country_changed` | A matched ID has a different country code or description. |
| `booth_changed` | A matched ID has a different set of booth labels. |
| `name_whitespace_only` | Raw names differ, but names are equal after collapsing whitespace and trimming. |

Names are case-sensitive; spelling and punctuation differences remain rename candidates. Raw names are preserved for audit. Country codes are uppercased, country descriptions are compared case-insensitively, and whitespace is normalized. Booth labels are case-sensitive sets: ordering, duplicate labels, and surrounding whitespace do not create a booth change.

One matched ID may appear in several categories. Therefore, summing category counts does **not** give the number of distinct changed companies. `matched_with_any_reported_change` counts distinct matched IDs across all categories; `matched_with_substantive_change` excludes whitespace-only name differences unless another substantive category also changes. Added/deleted IDs are counted separately.

The report records each input's SHA-256, row count, local path, and UTC generation time. It is saved atomically using a temporary file beside the destination. Validation errors leave a previous report intact, and a report path equal to an input path is rejected. These are local working artifacts; do not publish reports containing real company data or machine-specific paths.

### Pitfalls and validation

- A company that receives a new portal ID appears as deleted plus added; this script cannot prove it is the same legal entity.
- Country-label translation or an inconsistent code/name representation can create country differences. Normalize the input schema first, not the result after the fact.
- Booth sets do not describe co-exhibitor ownership, hall moves embedded in separate fields, or legal-entity changes. Inspect source records when grouping semantics change.
- A clean diff proves only equality of the compared fields, not completeness of the website archive or correctness of company identity/contact research.
- Treat the report as evidence for a human scope decision, not an instruction to automatically edit a workbook.

Run the synthetic regression suite:

```sh
node tests/list_diff.mjs
```

It exercises all categories, stable-ID matching despite reordering, both input forms, raw whitespace preservation, duplicate/missing/invalid IDs, output safety, and unchanged source files. Tests do not access the network or production data.

## 中文

### 用途

在继续研究或编辑工作簿之前，把已锁定的展商基线与新归档的可见名单进行比较。新增和删除只写入报告：本命令不修改输入、不扩充基线、不填写 Excel，也不抓取实时网站。

### 前置条件与执行顺序

1. 安装 Node.js 20 或以上版本，无需额外 Node 依赖包。
2. 使用相同且已核验的可见性、分组规则，分别归档并提取两份名单。保留旧基线，不要直接用最新名单覆盖它。
3. 两份快照必须使用相同体系的稳定、正整数**展商组 ID**。不能把公司名称、数组位置或展位号当 ID。如果门户改变了 ID 体系，先人工核对，再使用本工具。
4. 执行命令，把报告写到独立路径：

   ```sh
   node scripts/diff_exhibitor_lists.mjs work/baseline.json work/current.json work/list-diff.json
   ```

5. 逐项结合门户原始证据复核实质差异。范围负责人未明确批准改变基线前，新增对象不得自动进入研究名单。

### 输入格式

每个文件均可为 JSON 数组，或带有 `exhibitors` 数组的提取器输出。最小合成示例：

```json
{
  "groupId": 11,
  "name": "Demo Alpha",
  "countryCode": "EX",
  "countryDescription": "Exampleland",
  "boothNames": ["A.01", "A.02"]
}
```

`groupId` 也接受 `Id`、`ID`；`name` 也接受 `Name`。允许 `"11"` 这样的整数字符串，但拒绝科学计数字符串、零、负数、不安全整数、缺失 ID 和重复 ID。名称必须是非空字符串；若提供 `boothNames`/`BoothNames`，必须是字符串数组。

两份快照的国家字段应使用一致表达方式。工具识别提取器国家字段及常见别名，但不翻译国家名，也不把国家代码自动转成全称。

### 报告分类

| 分类 | 含义 |
| --- | --- |
| `added` | ID 只存在于新名单。 |
| `deleted` | ID 只存在于基线。 |
| `renamed` | 相同 ID 的名称在规范空白后仍不同。 |
| `country_changed` | 相同 ID 的国家代码或名称发生变化。 |
| `booth_changed` | 相同 ID 的展位标签集合发生变化。 |
| `name_whitespace_only` | 原始名称不同，但合并空白并去除首尾空白后相同。 |

名称区分大小写；拼写、标点变化仍作为改名候选。报告保留原始名称。国家代码转为大写、国家名称比较忽略大小写，并规范空白。展位按区分大小写的集合比较：顺序变化、重复标签和首尾空白不产生展位变化。

同一个 ID 可以同时出现在多个分类中，因此**不能把分类条数直接相加当成变化企业数**。`matched_with_any_reported_change` 统计全部分类涉及的不同匹配 ID；`matched_with_substantive_change` 不计仅名称空白变化，但同一 ID 还有其他实质变化时仍计入。新增、删除独立统计。

报告包含输入文件 SHA-256、行数、本地路径和 UTC 生成时间。先在目标旁写临时文件，再原子替换。校验失败会保留已有报告；报告路径与输入路径相同时会拒绝执行。这些都是本地工作证据，不得把真实企业数据或机器专属路径公开上传。

### 常见坑与验证

- 同一企业获得新门户 ID 时，会表现为“删除 + 新增”；脚本无法证明它们属于相同法定主体。
- 国家名称翻译，或国家代码/名称表达不一致，会产生国家差异。应先统一输入模式，而不是事后抹掉差异。
- 展位集合不能证明共同展商归属、独立字段中的展馆变化或主体变化。分组规则变化时必须查看原始对象。
- 无差异只证明所比较字段一致，不证明网站归档完整，也不证明企业身份和联系方式正确。
- 把报告作为人工判断范围的证据，不能自动据此改 Excel。

运行合成回归：

```sh
node tests/list_diff.mjs
```

测试覆盖全部差异分类、重排后的稳定 ID 匹配、两种输入格式、原始空白保留、重复/缺失/非法 ID、输出安全与源文件不变。测试不联网，不使用生产数据。
