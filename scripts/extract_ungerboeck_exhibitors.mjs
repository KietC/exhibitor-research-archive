#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const [inputPath, outputPath, expectedArg] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("usage: node extract_ungerboeck_exhibitors.mjs <GetInitialData.json> <visible-exhibitors.json> [expected-count]");
}

// Some portal exports wrap JSON in JSON strings; parse a bounded number of layers.
// 部分门户导出会把 JSON 再包装成 JSON 字符串；限制解析层数，避免无界展开。
function parseJsonLayers(text) {
  let value = JSON.parse(text);
  for (let i = 0; i < 3 && typeof value === "string"; i += 1) value = JSON.parse(value);
  return value;
}

// Find the known field rather than treating every object as an exhibitor.
// 只查找已知的展商字段，不把任意页面对象当成参展商。
function findExhibitorList(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value.ExhibitorList)) return value.ExhibitorList;
  for (const child of Object.values(value)) {
    const found = findExhibitorList(child, seen);
    if (found) return found;
  }
  return null;
}

// This adapter's visibility rule is portal-specific. Verify it before another event.
// 此适配器的可见性规则针对特定门户；换展会前必须先核实该字段含义。
function visible(record) {
  const value = record?.ShowOnDrawingSeq;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== false && value !== "";
}

function compact(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function unique(values) {
  return [...new Set((values ?? []).map(compact).filter(Boolean))];
}

// Write beside the destination, then rename: readers never see a partial JSON file.
// 先在目标旁写临时文件，再重命名；读取方不会看到只写了一半的 JSON。
async function atomicJson(target, value) {
  await mkdir(path.dirname(path.resolve(target)), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}

const input = await readFile(inputPath);
const payload = parseJsonLayers(input.toString("utf8"));
const raw = findExhibitorList(payload);
if (!raw) throw new Error("ExhibitorList was not found in the supplied JSON");

// Preserve the visible list order and original record for later grouping audits.
// 保留可见名单顺序和原始对象，供后续展商分组审计使用。
const selected = raw.filter(visible).map((record, index) => ({
  listIndex: index + 1,
  groupId: Number(record.Id ?? record.ID ?? record.ExhibitorId),
  name: compact(record.Name ?? record.ExhibitorName),
  allExhibitorIds: [...new Set([record.Id, ...(record.AllExhibitorIds ?? [])].map(Number).filter(Number.isFinite))],
  boothNames: unique(record.BoothNames ?? record.Booths?.map((item) => item?.Name ?? item)),
  countryCode: compact(record.CatCountry ?? record.CountryCode),
  countryDescription: compact(record.CatCountryDesc ?? record.CountryDescription),
  showOnDrawingSeq: record.ShowOnDrawingSeq,
  isMainExhibitor: Boolean(record.IsMainExhibitor),
  categories: record.Categories ?? [],
  productCodes: record.ProductCodes ?? [],
  sourceRecord: record,
}));

// Freeze scope before downstream research; names alone are not stable identifiers.
// 在研究前锁定范围；企业名称本身不能充当稳定、唯一的标识。
if (selected.some((row) => !Number.isSafeInteger(row.groupId) || row.groupId <= 0 || !row.name)) {
  throw new Error("one or more visible exhibitors lacks an ID or name");
}
if (new Set(selected.map((row) => row.groupId)).size !== selected.length) {
  throw new Error("visible exhibitor IDs are not unique; inspect grouping semantics before continuing");
}

const expected = expectedArg === undefined ? null : Number(expectedArg);
if (expected !== null && (!Number.isInteger(expected) || selected.length !== expected)) {
  throw new Error(`expected ${expectedArg} visible exhibitors, found ${selected.length}`);
}

const result = {
  schema: "exhibitor-visible-baseline-v1",
  generatedAtUtc: new Date().toISOString(),
  selectionRule: "ShowOnDrawingSeq is non-null/non-empty",
  input: {
    path: path.resolve(inputPath),
    bytes: input.length,
    sha256: createHash("sha256").update(input).digest("hex"),
    rawExhibitorCount: raw.length,
  },
  visibleExhibitorCount: selected.length,
  exhibitors: selected,
};

await atomicJson(outputPath, result);
console.log(JSON.stringify({ ok: true, raw: raw.length, visible: selected.length, output: path.resolve(outputPath) }, null, 2));
