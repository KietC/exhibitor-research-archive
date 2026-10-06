# Explicit API Archival / 显式 API 归档

## English

### Purpose and boundaries

`scripts/archive_api.mjs` is an original, dependency-free Node.js helper. It saves only requests explicitly listed in your configuration. It does not discover endpoints, enumerate object IDs, copy vendor JavaScript, bypass authentication, or automatically find API schemas. Use it only for data you are authorized to request and archive.

The included `example.test` URLs are synthetic reserved examples and will not work against a real service. Replace them with documented or otherwise verified request URLs. Browser cookies and session stores are not automatically loaded.

### Configuration order

1. Install Node.js 20 or later. Check `node --version`.
2. Copy `examples/api-config.example.json` to a private directory **outside this repository**.
3. Set `base_url` to the HTTPS API base URL. A trailing slash avoids surprising relative-path resolution.
4. Set `allowed_hosts` to exact `host` or `host:port` values. No schemes, paths, wildcards, or suffix matching are supported. Only HTTPS is accepted. Standard port `443` is normalized away by URLs; list the host without `:443`.
5. Add only verified requests. Each request needs a unique lowercase slug `name`, exactly one of `path` or `url`, and optional `method` (`GET` by default, or `POST`). `body` is JSON-serialized for POST. GET bodies are rejected.
6. If authentication is needed, add `headers_env`, such as `{"Authorization":"EXHIBITOR_API_AUTHORIZATION"}`. Set that environment variable locally to the complete required header value. Do not put the actual token in JSON, source files, command history, screenshots, or Git. Prefer an OS secret manager for production secrets.
7. Select an empty output directory outside the repository. Run the command below. Start with one request and inspect the saved response before expanding the explicit list.

```powershell
# PowerShell: config and archive directories are local, not repository files.
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive
```

```sh
# POSIX shell: use paths outside the source checkout.
node scripts/archive_api.mjs "$HOME/private-work/api-config.json" "$HOME/private-work/api-archive"
```

### Config fields

| Field | Requirement or default |
| --- | --- |
| `base_url` | Required HTTPS URL, no query, fragment, or user credentials |
| `allowed_hosts` | Required nonempty exact host list; includes the base host |
| `headers_env` | Optional header-name to environment-variable-name map; values are never persisted |
| `requests` | Required nonempty explicit request list |
| `requests[].name` | Unique lowercase slug, up to 80 characters; letters, digits, `_`, `-` |
| `requests[].path` or `url` | Exactly one; must resolve to HTTPS on an allowed host |
| `requests[].method` | `GET` or `POST`, default `GET` |
| `requests[].body` | Optional JSON body, POST only |
| `max_response_bytes` | Default `10485760` (10 MiB), maximum 200 MiB |
| `timeout_ms` | Default `20000`, 1,000–300,000 ms |
| `interval_ms` | Default `500`, minimum `250`, maximum `60000` |

URL user credentials and recognizable secret query keys (for example `token`, `access_token`, `api_key`, `cookie`, `password`, `session`, `signature`) are rejected. Secret detection is conservative, not a guarantee that arbitrary application-specific names are safe: keep all private values out of URLs. Request bodies are not copied into the manifest, but response bytes may contain private information.

### Saved output and integrity

```text
api-archive/
├── manifest.json
└── responses/
    ├── sample-list.json
    ├── sample-detail.json
    └── sample-document.pdf
```

Responses are saved as raw bytes. JSON is not reformatted, and binary documents are not transformed. Each manifest entry contains request identity, safe request/final URL, HTTP status, content type, redirect statuses, byte length, SHA-256, relative file path, and UTC save time. Resolved header values and request bodies are never written to the manifest. A successful file and its manifest update are atomically saved before proceeding to the next request. Response files without a completed manifest entry, caused by interruption between these two atomic operations, are not considered verified; an explicit GET resume fetches that request again.

**Do not publish these runtime archives.** They can contain business records, contact information, or confidential documents. `.gitignore` is only a defense in depth, not a substitute for a publication audit.

### Failure and resume behavior

The helper prints one JSON summary containing status, counters, internal reason code, and exit code. It does not print response bodies, headers, or request URLs. Success exits `0`; invalid CLI usage exits `2`; request/configuration/integrity failures exit `1`.

All request failures stop the run; `401`, `403`, and `429` stop immediately. There are **no automatic retries**, including POST. Resolve authorization or rate-limit issues normally; do not bypass limits. Redirects are manual, limited to five, HTTPS-only, and host-checked before any next fetch. All custom headers are removed when fetching a host different from the base host. POST redirects are not followed because repeating a POST can have side effects.

Existing archives are never silently reset. `--resume` requires a saved manifest, the exact same normalized configuration fingerprint, unique manifest records bound to their configured method/URL/file name, and matching SHA-256/byte length for every previously saved response. Resume supports **GET-only configurations** and skips verified completed responses. It does not merge archives from different configurations. Linked output paths (including Windows directory junctions) are rejected, and response paths must remain inside the archive's resolved root. Keep the archive private and do not modify it concurrently while a run is active.

```powershell
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive --resume
```

If you intentionally change configuration, use a new empty output directory. If an integrity check fails, preserve the original archive and investigate; do not delete evidence to make a check pass.

### Offline verification

```sh
node --check scripts/archive_api.mjs
node tests/api_archive.mjs
```

The regression test uses an injected synthetic `fetch` fixture. It tests JSON/binary save, resume hashes, configuration mismatch, secret handling, exact host/port boundaries, HTTPS redirects, 403/429 stops, response-size caps, and POST behavior without network access.

## 中文

### 用途和边界

`scripts/archive_api.mjs` 是原创、无额外依赖的 Node.js 工具。它仅保存配置中明确列出的请求，不自动发现接口、枚举对象 ID、复制厂商 JavaScript、绕过登录或寻找 API Schema。仅用于你有权请求和归档的数据。

附带的 `example.test` 地址为保留的合成示例，不是真实服务。必须替换为文档或其他方式核实过的地址。工具不会自动读取浏览器 Cookie 或会话存储。

### 配置顺序

1. 安装 Node.js 20 或以上版本，用 `node --version` 检查。
2. 将 `examples/api-config.example.json` 复制到**仓库外**的私有目录。
3. `base_url` 使用 HTTPS API 基础地址。保留末尾 `/`，避免相对路径解析出现意外。
4. `allowed_hosts` 填写精确的 `host` 或 `host:port`。不支持协议、路径、通配符或域名后缀匹配。仅支持 HTTPS；URL 会归一化默认 `443` 端口，因此不要在列表中写 `:443`。
5. 只增加已经核实的请求。每条请求需要唯一的小写 `name`，且 `path`、`url` 二选一；`method` 默认为 `GET`，也可为 `POST`。POST 的 `body` 会序列化为 JSON；GET 不允许正文。
6. 如需认证，添加 `headers_env`，例如 `{"Authorization":"EXHIBITOR_API_AUTHORIZATION"}`，并在本机将相应环境变量设置为完整请求头值。实际令牌不得写入 JSON、源码、命令历史、截图或 Git。生产密钥优先使用操作系统密钥管理器。
7. 选择仓库外的空目录保存归档。先用一条请求试运行，检查字节和内容正确后，再增加明确的请求清单。

```powershell
# PowerShell：配置文件和归档目录是本地资料，不是仓库文件。
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive
```

```sh
# POSIX shell：路径放在源码检出目录之外。
node scripts/archive_api.mjs "$HOME/private-work/api-config.json" "$HOME/private-work/api-archive"
```

### 配置字段

| 字段 | 要求或默认值 |
| --- | --- |
| `base_url` | 必填 HTTPS 地址，不得含查询参数、锚点或用户密码 |
| `allowed_hosts` | 必填非空精确主机列表，包含基础主机 |
| `headers_env` | 可选，请求头名称到环境变量名称的映射；值不会落盘 |
| `requests` | 必填非空的显式请求列表 |
| `requests[].name` | 唯一小写标识，不超过 80 个字符，仅字母、数字、`_`、`-` |
| `requests[].path` 或 `url` | 二选一，解析结果必须为允许主机上的 HTTPS 地址 |
| `requests[].method` | `GET` 或 `POST`，默认为 `GET` |
| `requests[].body` | 可选 JSON 正文，仅支持 POST |
| `max_response_bytes` | 默认 `10485760`（10 MiB），最高 200 MiB |
| `timeout_ms` | 默认 `20000`，范围 1,000–300,000 毫秒 |
| `interval_ms` | 默认 `500`，最低 `250`，最高 `60000` 毫秒 |

URL 用户密码以及可识别的密钥查询参数（如 `token`、`access_token`、`api_key`、`cookie`、`password`、`session`、`signature`）会被拒绝。此检查较保守，但不能保证任意应用自定义参数都安全：所有私密值都应避开 URL。请求正文不会复制进清单，但响应字节可能含有私密资料。

### 保存结果与完整性

```text
api-archive/
├── manifest.json
└── responses/
    ├── sample-list.json
    ├── sample-detail.json
    └── sample-document.pdf
```

响应按原始字节保存，不重新格式化 JSON，也不转换二进制文档。清单记录请求身份、安全的初始与最终 URL、HTTP 状态、内容类型、重定向状态、字节数、SHA-256、相对文件路径与 UTC 保存时间。解析后的请求头值、请求正文都不会写入清单。每个响应文件及其清单更新都会原子保存，然后才继续下一个请求。若在两次原子操作之间中断，存在文件却没有完成的清单记录，该文件不会被视为已验证；明确的 GET 续跑会重新获取该请求。

**不要公开运行产生的归档。** 其中可能包含企业资料、联系方式或保密文档。`.gitignore` 仅是额外防线，不能替代发布前审核。

### 失败与续跑

工具只打印一条 JSON 摘要，包含状态、计数、内部原因代码及退出码，不打印响应正文、请求头或请求 URL。成功退出 `0`，CLI 参数错误退出 `2`，请求、配置、完整性错误退出 `1`。

所有请求错误都会停止；`401`、`403`、`429` 立即停止。**没有自动重试**，包括 POST。应正常处理授权或限流，不绕过限制。重定向由工具手动处理，最多五次，必须 HTTPS，且下一次请求之前检查主机。访问非基础主机时移除全部自定义请求头。POST 重定向不跟随，避免重复请求产生副作用。

已有归档不会被静默重置。`--resume` 要求已有清单、归一化配置指纹完全相同、清单记录唯一且绑定对应配置中的方法、URL、文件名，所有已保存响应的 SHA-256 与字节数匹配。续跑仅支持**全部为 GET 的配置**，并跳过已完成且验证通过的响应，不合并不同配置的归档。工具拒绝包含链接的输出路径（包括 Windows 目录联接），响应路径必须位于归档的实际根目录中。归档应保持私有，运行期间不要并发修改。

```powershell
node scripts/archive_api.mjs ../private-work/api-config.json ../private-work/api-archive --resume
```

主动修改配置时，改用新的空输出目录。如完整性校验失败，保留原归档并调查原因，不要为了通过检查而删除证据。

### 离线验证

```sh
node --check scripts/archive_api.mjs
node tests/api_archive.mjs
```

回归测试注入合成 `fetch`，覆盖 JSON 与二进制保存、续跑哈希、配置不一致、密钥处理、精确主机与端口边界、HTTPS 重定向、403/429 停止、响应大小限制和 POST 行为，不需要联网。
