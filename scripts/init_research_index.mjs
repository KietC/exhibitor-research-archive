#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const cliArgs = process.argv.slice(2);
const [baselinePath, outputDir, expectedArg] = cliArgs.filter((value) => value !== "--overwrite");
if (!baselinePath || !outputDir) {
  throw new Error("usage: node init_research_index.mjs <visible-exhibitors.json> <output-dir> [expected-count] [--overwrite]");
}

// This creates a NEW index; it is not a resume/update command. Existing work is safe
// unless the caller explicitly requests a destructive status reinitialization.
// 此命令只创建初始索引，不负责续跑/更新；只有显式指定重置时才可覆盖已有进度。
const overwrite = cliArgs.includes("--overwrite");
for (const name of ["master_index.json", "master_index.csv"]) {
  const target = path.join(outputDir, name);
  let exists = false;
  try { await access(target); exists = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists && !overwrite) throw new Error(`refusing to reset existing research status: ${target}; use --overwrite only for an intentional reinitialization`);
}

const compact = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
const slug = (value) => compact(value).normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 64) || "unnamed";
const normalize = (value) => compact(value).normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/&/gu, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
const csvCell = (value) => /[",\r\n]/u.test(String(value ?? "")) ? `"${String(value ?? "").replace(/"/gu, '""')}"` : String(value ?? "");

// Each file is atomically replaced; JSON and CSV together are not a transaction.
// 单个文件采用原子替换；JSON 和 CSV 两个文件并不是跨文件事务。
async function atomicWrite(target, text) {
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try { await writeFile(temp, text, "utf8"); await rename(temp, target); }
  finally { await rm(temp, { force: true }); }
}

const buffer = await readFile(baselinePath);
const parsed = JSON.parse(buffer.toString("utf8"));
const exhibitors = Array.isArray(parsed) ? parsed : parsed.exhibitors;
if (!Array.isArray(exhibitors)) throw new Error("baseline must be an array or contain an exhibitors array");

const expected = expectedArg === undefined ? exhibitors.length : Number(expectedArg);
if (!Number.isInteger(expected) || exhibitors.length !== expected) throw new Error(`expected ${expected} rows, found ${exhibitors.length}`);

const generatedAtUtc = new Date().toISOString();
// Fixed row/group IDs bind evidence to the original population, not a search hit.
// 固定行号和展商组 ID 把证据绑定到原始名单，而不是绑定到搜索结果。
const records = exhibitors.map((row, index) => {
  const rowNumber = index + 1;
  const name = compact(row.name ?? row.Name);
  const country = compact(row.countryDescription ?? row.country ?? row.CatCountryDesc);
  const groupId = Number(row.groupId ?? row.Id ?? row.ID);
  if (!name || !Number.isSafeInteger(groupId) || groupId <= 0) throw new Error(`row ${rowNumber} lacks a valid name or group ID`);
  const folder = `${String(rowNumber).padStart(4, "0")}_${groupId}_${slug(name)}`;
  return {
    row_number: rowNumber,
    excel_row_number: rowNumber + 1,
    company_name: name,
    country,
    booth: (row.boothNames ?? row.BoothNames ?? []).map(compact).filter(Boolean).join("; "),
    group_id: groupId,
    exhibitor_ids: row.allExhibitorIds ?? row.AllExhibitorIds ?? [groupId],
    normalized_identity_key: `${normalize(name)}|${normalize(country)}`,
    status: "not_started",
    workflow: { research_status: "not_started", workbook_status: "not_written", initialized_at_utc: generatedAtUtc, updated_at_utc: generatedAtUtc },
    confidence: { identity: "unrated", phone: "unrated", email: "unrated", business_field: "unrated", company_profile: "unrated", excel_write_eligible: false },
    queries: [`"${name}" ${country}`, `"${name}" official`, `"${name}" contact`],
    evidence_paths: {
      json: `companies/${folder}/company_evidence.json`,
      markdown: `companies/${folder}/company_evidence.md`,
      raw: `companies/${folder}/raw`,
    },
    flags: [],
  };
});

if (new Set(records.map((row) => row.group_id)).size !== records.length) {
  throw new Error("baseline group IDs must be unique; do not merge same-name companies automatically");
}

// Duplicate names are review flags, never permission to merge legal entities.
// 名称重复只产生待复核标记，不能据此合并不同法定主体。
const duplicateGroups = new Map();
for (const row of records) duplicateGroups.set(row.normalized_identity_key, [...(duplicateGroups.get(row.normalized_identity_key) ?? []), row.row_number]);
for (const row of records) {
  const related = duplicateGroups.get(row.normalized_identity_key).filter((item) => item !== row.row_number);
  if (related.length) row.flags.push({ type: "duplicate_normalized_identity", related_rows: related });
}

const index = {
  schema: "exhibitor-research-index-v1",
  generated_at_utc: generatedAtUtc,
  baseline: { path: path.resolve(baselinePath), bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"), row_count: exhibitors.length },
  scope: { fixed_population: true, expected_count: expected, additions_allowed: false },
  records,
};

const headers = ["row_number", "excel_row_number", "company_name", "country", "booth", "group_id", "status", "identity_confidence", "excel_write_eligible", "evidence_json", "evidence_markdown", "flags_json"];
const rows = records.map((row) => [row.row_number, row.excel_row_number, row.company_name, row.country, row.booth, row.group_id, row.status, row.confidence.identity, row.confidence.excel_write_eligible, row.evidence_paths.json, row.evidence_paths.markdown, JSON.stringify(row.flags)]);
// Persist the authoritative JSON plus a convenient CSV view with the same rows.
// 落盘权威 JSON 和便于查看的 CSV 副本，两者使用相同的行集合。
await atomicWrite(path.join(outputDir, "master_index.json"), `${JSON.stringify(index, null, 2)}\n`);
await atomicWrite(path.join(outputDir, "master_index.csv"), `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`);
console.log(JSON.stringify({ ok: true, records: records.length, duplicate_identity_groups: [...duplicateGroups.values()].filter((rows) => rows.length > 1).length, output: path.resolve(outputDir) }, null, 2));
