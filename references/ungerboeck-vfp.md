# VFP-style list adapter

## English

The adapter searches archived JSON for an `ExhibitorList` array, including nested `ReturnObj` and JSON-encoded strings. It selects records with a non-empty `ShowOnDrawingSeq` relation and preserves their order, IDs, booth labels and original records.

Verify this selection against the current portal UI. Hidden booths, pavilions and grouped brands may use other semantics. Record the UI count and pass it as the expected-count guard. Never copy another event's population or configuration IDs.

Names such as `GetInitialData`, `GetDrawingData`, `GetExhibitorDetails`, `GetExhibitorCatalogImages`, `GetExhibitorShareLink` and `GetDocumentData` can help interpret an accessible portal. Methods, payloads and authorization are not universal. Observe actual requests in supported browser tools, then configure [API acquisition](../docs/API_ARCHIVE.md).

## 中文

适配器在归档 JSON 中查找 `ExhibitorList`，支持嵌套 `ReturnObj` 和字符串形式 JSON。选择 `ShowOnDrawingSeq` 非空记录，保留原顺序、ID、展位与原始记录。

必须先在当前界面验证规则。隐藏展位、展团和品牌分组可能采用不同语义。记录界面数量并作为预期数量传入；不能照搬其他展会的数量或配置 ID。

`GetInitialData`、`GetDrawingData`、`GetExhibitorDetails`、`GetExhibitorCatalogImages`、`GetExhibitorShareLink`、`GetDocumentData` 等名称可辅助理解可访问的网站。请求方式、载荷和认证不通用。先用浏览器支持的工具观察真实请求，再配置 [API 采集](../docs/API_ARCHIVE.md)。
