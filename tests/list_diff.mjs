import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// These list snapshots are entirely synthetic and owned by this temporary test.
// 此名单快照完全合成，只在本测试拥有的临时目录中使用。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "diff_exhibitor_lists.mjs");
const temp = await mkdtemp(path.join(os.tmpdir(), "exhibitor-diff-test-"));
const row = (groupId, name, extra = {}) => ({ groupId, name, countryCode: "EX", countryDescription: "Exampleland", boothNames: ["A.01"], ...extra });
const run = (baseline, current, report) => execFileSync(process.execPath, [script, baseline, current, report], { encoding: "utf8", stdio: "pipe" });

try {
  const baselinePath = path.join(temp, "baseline.json");
  const currentPath = path.join(temp, "current.json");
  const reportPath = path.join(temp, "report.json");
  const baseline = [
    row(11, "Demo Alpha", { boothNames: ["B.02", "B.01"] }),
    row(12, "Demo Beta"),
    row(13, "Demo Gamma"),
    row(14, "Demo Delta "),
    row(15, "Demo Epsilon"),
    row(16, "Demo Zeta"),
    row(18, "Demo Theta"),
  ];
  const current = [
    row(18, "Demo Theta Labs", { countryCode: "SP", countryDescription: "Sampleland", boothNames: ["Z.99"] }),
    row(16, "Demo Zeta", { boothNames: ["A.02"] }),
    row(15, "Demo Epsilon", { countryCode: "SP", countryDescription: "Sampleland" }),
    row(14, " Demo   Delta"),
    row(12, "Demo Beta Labs"),
    row(11, "Demo Alpha", { boothNames: ["B.01", "B.02", " B.01 "], countryCode: "ex", countryDescription: "EXAMPLELAND" }),
    row(17, "Demo Eta"),
  ];
  await writeFile(baselinePath, JSON.stringify(baseline));
  await writeFile(currentPath, JSON.stringify({ schema: "exhibitor-visible-baseline-v1", exhibitors: current }));
  const baselineBefore = await readFile(baselinePath);
  const currentBefore = await readFile(currentPath);
  run(baselinePath, currentPath, reportPath);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.deepEqual(report.counts, {
    added: 1, deleted: 1, renamed: 2, country_changed: 2, booth_changed: 2,
    name_whitespace_only: 1, matched: 6, unchanged: 1,
    matched_with_any_reported_change: 5, matched_with_substantive_change: 4,
  });
  assert.equal(report.changes.added[0].groupId, 17);
  assert.equal(report.changes.deleted[0].groupId, 13);
  assert.equal(report.changes.name_whitespace_only[0].baseline.name_raw, "Demo Delta ");
  assert.equal(report.changes.name_whitespace_only[0].current.name_raw, " Demo   Delta");
  assert.equal(report.policy.baseline_modified, false);
  assert.deepEqual(await readFile(baselinePath), baselineBefore);
  assert.deepEqual(await readFile(currentPath), currentBefore);

  // Both supported container forms and both common ID/name aliases are exercised.
  // 同时测试两种容器格式，以及常见的 ID/名称字段别名。
  await writeFile(baselinePath, JSON.stringify({ exhibitors: [{ Id: "21", Name: "Demo Alpha" }] }));
  await writeFile(currentPath, JSON.stringify([{ ID: 21, Name: "Demo Alpha" }]));
  run(baselinePath, currentPath, reportPath);
  assert.equal(JSON.parse(await readFile(reportPath, "utf8")).counts.unchanged, 1);

  // A failed validation must preserve an existing report instead of partly replacing it.
  // 校验失败必须保留已有报告，不能写入只完成一半的新报告。
  const previousReport = await readFile(reportPath, "utf8");
  const invalidLists = [
    [row(1, "Demo Alpha"), row(1, "Demo Beta")],
    [{ name: "Demo Alpha" }],
    [row(0, "Demo Alpha")],
    [row(1.5, "Demo Alpha")],
    [row(Number.MAX_SAFE_INTEGER + 1, "Demo Alpha")],
    [row("1e2", "Demo Alpha")],
    [row(1, "   ")],
    [row(1, "Demo Alpha", { boothNames: "A.01" })],
  ];
  for (const invalid of invalidLists) {
    await writeFile(baselinePath, JSON.stringify(invalid));
    assert.throws(() => run(baselinePath, currentPath, reportPath), undefined);
    assert.equal(await readFile(reportPath, "utf8"), previousReport);
  }
  await writeFile(baselinePath, JSON.stringify([row(1, "Demo Alpha")]));
  await writeFile(currentPath, JSON.stringify([row(2, "Demo Beta"), row(2, "Demo Gamma")]));
  assert.throws(() => run(baselinePath, currentPath, reportPath), undefined);

  // Never allow the report target to replace either source list, even on success.
  // 即使比较可成功，也不能让报告目标覆盖任何源名单。
  const beforeOverwriteAttempt = await readFile(baselinePath, "utf8");
  assert.throws(() => run(baselinePath, baselinePath, baselinePath), undefined);
  assert.equal(await readFile(baselinePath, "utf8"), beforeOverwriteAttempt);
  if (process.platform === "win32") assert.throws(() => run(baselinePath, baselinePath, baselinePath.toUpperCase()), undefined);
  const badUsage = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.notEqual(badUsage.status, 0);

  await writeFile(baselinePath, JSON.stringify([]));
  await writeFile(currentPath, JSON.stringify([]));
  run(baselinePath, currentPath, reportPath);
  assert.equal(JSON.parse(await readFile(reportPath, "utf8")).counts.matched, 0);
  assert(!(await readdir(temp)).some((name) => name.endsWith(".tmp")));
  console.log(JSON.stringify({ status: "pass", checks: ["all_diff_categories", "stable_id_not_position", "booth_set_semantics", "whitespace_raw_preserved", "inputs_unchanged", "array_and_extractor_formats", "numeric_id_aliases", "duplicate_baseline_id_rejected", "missing_or_invalid_id_rejected", "invalid_name_booths_rejected", "duplicate_current_id_rejected", "failed_report_preserved", "input_overwrite_blocked", "usage_guard", "empty_lists"] }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
