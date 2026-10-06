# Security and public-data boundary

## English

Never commit credentials, browser profiles, HAR files, portal responses, contact evidence or workbooks. Real authentication values belong in process environment variables, not API configuration files. Keep operational output in ignored `work/`, `data/` or an independent private directory.

Before publication, run `release_audit.py`, `build_manifest.py`, tests, and inspect the exact staged diff. The audit uses a source allowlist, credential patterns, reserved example domains and an optional private denylist. Automated checks cannot prove the absence of every business identifier; manual review remains necessary.

The API archiver limits request scope and does not persist request headers. Responses can still contain confidential data; review them separately before sharing. The contact crawler accepts an explicitly selected official domain but does not prove legal identity.

Report vulnerabilities through private vulnerability reporting if available. Never put secrets or customer evidence in public issues. Otherwise describe only the generic defect and request a private reporting route. No support SLA is promised.

## 中文

不要提交凭据、浏览器资料、HAR、网站响应、联系证据或工作簿。真实认证值只放在进程环境变量，不放进 API 配置文件。业务输出留在被忽略的 `work/`、`data/` 或独立私有目录。

发布前运行 `release_audit.py`、`build_manifest.py` 和测试，并人工检查精确暂存差异。审计使用源码白名单、凭据特征、保留示例域名和可选私有拒绝名单。自动检查不能证明不存在所有业务特征，仍需人工复核。

API 采集器限制请求范围，不保存请求头。响应仍可能包含保密数据，分享前单独审核。官网采集器接受明确选定的官方域名，但不证明法律主体。

优先使用可用的私密漏洞报告功能。不要把密钥或客户证据写进公开 issue。若无私密入口，仅描述通用缺陷并请求私密报告渠道。不承诺支持时效。
