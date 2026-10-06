#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const [baselinePath, currentPath, reportPath, ...extraArgs] = process.argv.slice(2);
if (!baselinePath || !currentPath || !reportPath || extraArgs.length) {
  throw new Error("usage: node diff_exhibitor_lists.mjs <baseline.json> <current.json> <report.json>");
}
// Account for Windows case-insensitivity and existing symlink aliases as well.
// 同时考虑 Windows 路径大小写不敏感，以及已存在的符号链接别名。
const pathKey = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
let reportResolved;
try { reportResolved = await realpath(reportPath); }
catch (error) { if (error.code !== "ENOENT") throw error; reportResolved = path.resolve(reportPath); }
const inputsResolved = await Promise.all([baselinePath, currentPath].map((input) => realpath(input)));
if (inputsResolved.some((input) => pathKey(input) === pathKey(reportResolved))) {
  throw new Error("report path must not overwrite either input list");
}

const compact = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const hash = (value) => createHash("sha256").update(value).digest("hex");

// Compare stable numeric group IDs, never names, booth numbers, or list positions.
// 以稳定数字展商组 ID 比较，不能用名称、展位或名单顺序代替主体标识。
function normalizeRows(payload, label) {
  const rows = Array.isArray(payload) ? payload : payload?.exhibitors;
  if (!Array.isArray(rows)) throw new Error(`${label} must be an array or contain an exhibitors array`);
  const byId = new Map();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${label} row ${index + 1} must be an object`);
    const rawId = row.groupId ?? row.Id ?? row.ID;
    const groupId = typeof rawId === "number" ? rawId : typeof rawId === "string" && /^[1-9]\d*$/u.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error(`${label} row ${index + 1} lacks a positive safe-integer group ID`);
    if (byId.has(groupId)) throw new Error(`${label} has duplicate group ID ${groupId}`);
    const nameRaw = row.name ?? row.Name;
    if (typeof nameRaw !== "string" || !compact(nameRaw)) throw new Error(`${label} group ID ${groupId} lacks a nonempty name`);
    const rawBooths = row.boothNames ?? row.BoothNames ?? [];
    if (!Array.isArray(rawBooths) || rawBooths.some((booth) => typeof booth !== "string")) throw new Error(`${label} group ID ${groupId} boothNames must be a string array`);
    byId.set(groupId, {
      groupId,
      name_raw: nameRaw,
      name_normalized: compact(nameRaw),
      country: {
        code: compact(row.countryCode ?? row.CatCountry ?? row.CountryCode).toUpperCase(),
        description: compact(row.countryDescription ?? row.country ?? row.CatCountryDesc ?? row.CountryDescription),
      },
      // Booth order/duplicates are presentation, not a meaningful assignment change.
      // 展位顺序和重复项只是展示差异，不作为实质展位变化。
      booths: [...new Set(rawBooths.map(compact).filter(Boolean))].sort(),
    });
  }
  return byId;
}

// Write only a report; discovering an addition does not expand the frozen scope.
// 只写差异报告；发现新增对象并不意味着可以扩充已锁定的处理范围。
async function atomicJson(target, value) {
  await mkdir(path.dirname(path.resolve(target)), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, target);
  } finally { await rm(temp, { force: true }); }
}

const [baselineBuffer, currentBuffer] = await Promise.all([readFile(baselinePath), readFile(currentPath)]);
const baseline = normalizeRows(JSON.parse(baselineBuffer.toString("utf8")), "baseline");
const current = normalizeRows(JSON.parse(currentBuffer.toString("utf8")), "current");
const changes = { added: [], deleted: [], renamed: [], country_changed: [], booth_changed: [], name_whitespace_only: [] };
const changedIds = new Set();
const substantiveIds = new Set();

for (const [groupId, before] of baseline) {
  const after = current.get(groupId);
  if (!after) { changes.deleted.push(before); continue; }
  const pair = { groupId, baseline: before, current: after };
  // Only whitespace is ignored for rename decisions; raw names remain in evidence.
  // 改名判断只忽略空白；证据仍保留两份原始名称，不隐藏大小写或拼写变化。
  if (before.name_normalized !== after.name_normalized) {
    changes.renamed.push(pair); changedIds.add(groupId); substantiveIds.add(groupId);
  } else if (before.name_raw !== after.name_raw) {
    changes.name_whitespace_only.push(pair); changedIds.add(groupId);
  }
  const countryKey = (row) => `${row.country.code}|${row.country.description.toLowerCase()}`;
  if (countryKey(before) !== countryKey(after)) {
    changes.country_changed.push(pair); changedIds.add(groupId); substantiveIds.add(groupId);
  }
  if (JSON.stringify(before.booths) !== JSON.stringify(after.booths)) {
    changes.booth_changed.push(pair); changedIds.add(groupId); substantiveIds.add(groupId);
  }
}
for (const [groupId, row] of current) if (!baseline.has(groupId)) changes.added.push(row);

const matchedCount = baseline.size - changes.deleted.length;
const report = {
  schema: "exhibitor-list-diff-v1",
  generated_at_utc: new Date().toISOString(),
  inputs: {
    baseline: { path: path.resolve(baselinePath), sha256: hash(baselineBuffer), row_count: baseline.size },
    current: { path: path.resolve(currentPath), sha256: hash(currentBuffer), row_count: current.size },
  },
  policy: { match_key: "stable_group_id", baseline_modified: false, additions_are_report_only: true, rename_ignores_whitespace_only: true },
  counts: {
    ...Object.fromEntries(Object.entries(changes).map(([category, rows]) => [category, rows.length])),
    matched: matchedCount,
    unchanged: matchedCount - changedIds.size,
    matched_with_any_reported_change: changedIds.size,
    matched_with_substantive_change: substantiveIds.size,
  },
  changes,
};

await atomicJson(reportPath, report);
console.log(JSON.stringify({ ok: true, report: path.resolve(reportPath), counts: report.counts }, null, 2));
