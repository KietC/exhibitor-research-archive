# Public release procedure

## English

### Required order

1. Create a **new source-only copy**. Do not publish a working checkout containing real responses or reuse its Git history.
2. Replace operational records with invented examples. Remove real event names, populations, object IDs, company/customer names, addresses, domains, emails, phones, private paths and operational checksums. Code field names and generic software names are not business evidence.
3. Keep any private denylist outside the source tree. The optional JSON shape is `{"terms":[],"hashes":[]}`. Supply identity terms and original file hashes locally, without putting that list in source control.
4. Run `npm test`, Python unittests and the offline demo following [SETUP](SETUP.md).
5. Run the audit and make a source ZIP:

   ```sh
   python scripts/release_audit.py . --report work/release_audit.json
   python scripts/package_source.py . ../exhibitor-research-archive-source.zip
   ```

   If you have a private denylist, add `--deny-file ../private-denylist.json` to both commands. Packaging reruns audit and manifest checks, uses only manifest entries, and reads back every ZIP entry to verify its hash. Choose a new ZIP filename for each build; an existing ZIP is not overwritten.

6. Inspect `git diff --cached`, `git ls-files`, the manifest and every packaged file. `.gitignore` does not remove already tracked files. Never rely on pattern scanning alone; ordinary prose can still reveal business context.
7. Ensure `LICENSE` is included and that you own the code being published. Do not include third-party website bundles unless their license explicitly permits it.
8. Create/push a **public** GitHub repository only after the audit passes and publication is authorized. Keep credentials in the credential manager, not the command line. Verify the remote URL and public visibility after push.
9. Inspect the remote source tree and README rendering. Wait for all configured CI jobs, fix failures in new commits, then tag a version and publish the already verified ZIP as a release asset.

### Recovery

If a production identifier or credential is discovered before upload, stop publication and rebuild the clean copy. If it is discovered after publication, promptly contain exposure, rotate affected secrets, and plan history cleanup separately; simply adding `.gitignore` or deleting the latest file does not remove public history. This toolkit does not automatically perform destructive history rewriting.

Generated audit reports contain filenames and hashes, not the private values that caused rejection. Runtime API archives and evidence remain private and are **not** release assets.

## 中文

### 必须遵循的顺序

1. 创建**全新的纯源码副本**，不要发布含真实响应的工作目录，也不要复用它的 Git 历史。
2. 用重新构造的示例替换业务记录。去掉真实展会名称、数量、对象 ID、公司客户名称、地址、域名、邮箱、电话、私有路径和业务文件哈希。代码字段名与通用软件名称不属于企业证据。
3. 私有拒绝名单留在源码树之外。JSON 格式为 `{"terms":[],"hashes":[]}`；本地填写身份关键词与原文件哈希，不提交名单。
4. 按 [SETUP](SETUP.md) 运行 `npm test`、Python 单元测试与离线演示。
5. 审计并生成源码 ZIP：

   ```sh
   python scripts/release_audit.py . --report work/release_audit.json
   python scripts/package_source.py . ../exhibitor-research-archive-source.zip
   ```

   有私有拒绝名单时，两条命令都加 `--deny-file ../private-denylist.json`。打包会重新审计和生成清单，只打包清单文件，并回读每个 ZIP 条目校验哈希。每次选新的 ZIP 文件名，已有文件不会覆盖。

6. 查看 `git diff --cached`、`git ls-files`、清单与每个打包文件。`.gitignore` 不会移除已追踪文件；特征扫描不能替代人工复核，普通文字也可能透露业务背景。
7. 确认包含 `LICENSE`，且有权公开这些代码。未经许可不加入第三方网站 bundle。
8. 审计通过且获明确发布授权后，才创建或推送**公开** GitHub 仓库。认证留在凭据管理器，不放进命令行。推送后验证远程地址和公开可见性。
9. 检查远程源码树与 README 渲染。等待所有 CI，失败时新增修复提交；全部通过再打版本标签，将已校验的 ZIP 作为 release 附件。

### 恢复

上传前发现生产特征或凭据，停止发布并重新构建干净副本。上传后发现问题，应及时控制暴露、轮换相关密钥，另行安排历史清理；只加 `.gitignore` 或删除最新文件不能消除公开历史。工具不会自动执行破坏性的历史重写。

审计报告只含文件名与哈希，不回显触发拒绝的私有值。运行产生的 API 归档和企业证据保持私有，**不作为 release 附件**。
