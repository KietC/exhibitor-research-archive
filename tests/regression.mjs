import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Tests own this exact temporary directory; source and production files stay intact.
// 测试只操作这里创建的临时目录；源码和生产文件保持不变。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "exhibitor-skill-test-"));
const run = (script, args, options = {}) => execFileSync(process.execPath, [path.join(root, "scripts", script), ...args], { encoding: "utf8", ...options });

try {
  const input = path.join(temp, "initial.json");
  const baseline = path.join(temp, "baseline.json");
  await writeFile(input, JSON.stringify({ ReturnObj: { ExhibitorList: [
    { Id: 11, Name: "Demo Alpha", ShowOnDrawingSeq: [1], BoothNames: ["1.01"], CatCountryDesc: "Exampleland" },
    { Id: 12, Name: "Demo Alpha", ShowOnDrawingSeq: [1], BoothNames: ["1.02"], CatCountryDesc: "Exampleland" },
    { Id: 13, Name: "Demo Beta", ShowOnDrawingSeq: null },
    { Id: 14, Name: "Demo Gamma", ShowOnDrawingSeq: [] },
  ] } }));
  run("extract_ungerboeck_exhibitors.mjs", [input, baseline, "2"]);
  const extracted = JSON.parse(await readFile(baseline, "utf8"));
  assert.equal(extracted.visibleExhibitorCount, 2);
  assert.equal(extracted.input.rawExhibitorCount, 4);
  assert.throws(() => run("extract_ungerboeck_exhibitors.mjs", [input, path.join(temp, "wrong.json"), "3"], { stdio: "pipe" }));

  // Reinitialization must be explicit; an ordinary repeat cannot erase progress.
  // 重置必须显式指定；普通重复执行不能清空已有研究进度。
  const indexDir = path.join(temp, "index");
  run("init_research_index.mjs", [baseline, indexDir, "2"]);
  const indexFile = path.join(indexDir, "master_index.json");
  const originalIndex = await readFile(indexFile, "utf8");
  const index = JSON.parse(originalIndex);
  assert.equal(index.records.length, 2);
  assert.equal(index.records[0].confidence.excel_write_eligible, false);
  assert.equal(index.records[0].flags[0].type, "duplicate_normalized_identity");
  const repeated = spawnSync(process.execPath, [path.join(root, "scripts", "init_research_index.mjs"), baseline, indexDir, "2"], { encoding: "utf8" });
  assert.notEqual(repeated.status, 0);
  assert.equal(await readFile(indexFile, "utf8"), originalIndex);
  run("init_research_index.mjs", [baseline, indexDir, "--overwrite"]);
  assert.equal(JSON.parse(await readFile(indexFile, "utf8")).records.length, 2);

  const queue = path.join(temp, "queue.json");
  const reportFile = path.join(temp, "crawl.json");
  const callsFile = path.join(temp, "calls.json");
  await writeFile(queue, JSON.stringify({ rows: [
    { row_number: 1, company_name: "Demo Alpha", identity: { official_domain: "https://www.official.example", official_website_url: "https://official.example/" }, source_urls: ["https://unrelated.example/contact"] },
    { row_number: 2, company_name: "Demo Beta" },
    { row_number: 3, company_name: "Demo Gamma", identity: { official_website_url: "https://redirect.example/" } },
    { row_number: 4, company_name: "Demo Delta", identity: { official_website_url: "https://myplex.example/" } },
    { row_number: 5, company_name: "Demo Epsilon", identity: { official_website_url: "ftp://official.example/" } },
    { row_number: 6, company_name: "Demo Zeta", source_urls: ["https://official.example/"] },
    { row_number: 7, company_name: "Demo Eta", identity: { official_website_url: "https://encoded.example/" } },
    { row_number: 8, company_name: "Demo Theta", identity: { official_website_url: "https://malformed.example/" } },
    { row_number: 9, company_name: "Demo Iota", identity: { official_website_url: "https://x.com/" } },
    { row_number: 10, company_name: "Demo Kappa", identity: { official_domain: "ftp://official.example", official_website_url: "https://official.example/" } },
    { row_number: 11, company_name: "Demo Lambda", identity: { official_website_url: "https://myplex.company.example/" } },
  ] }));
  // file:// import URLs work on Windows as well as Unix; all fetches are stubbed.
  // file:// 导入地址兼容 Windows 和 Unix；全部 fetch 都由测试替身接管。
  execFileSync(process.execPath, ["--import", pathToFileURL(path.join(root, "tests", "fixtures", "fetch_stub.mjs")).href, path.join(root, "scripts", "public_contact_crawl.mjs"), queue, path.join(temp, "crawl"), reportFile], { encoding: "utf8", env: { ...process.env, STUB_REQUEST_LOG: callsFile } });
  const report = JSON.parse(await readFile(reportFile, "utf8"));
  assert.equal(report.result_count, 11);
  assert.equal(report.results[0].candidates.email, "info@official.example");
  assert(report.results[1].anomalies.includes("no_official_seed_url"));
  assert.equal(report.results[2].candidates.phone, null);
  assert.equal(report.results[2].candidates.email, null);
  assert.equal(report.results[2].candidates.contact_source, null);
  assert.equal(report.results[2].confidence.contact_source, "not_found");
  assert.equal(report.results[2].pages[0].error, "outside_official_domain");
  assert(report.results[3].candidates.phone);
  assert.equal(report.results[3].official_host, "myplex.example");
  for (const row of [4, 5, 8, 9]) {
    assert(report.results[row].anomalies.includes("no_official_seed_url"));
    assert.equal(report.results[row].pages.length, 0);
  }
  assert.equal(report.results[6].candidates.email, "info@encoded.example");
  assert.equal(report.results[7].candidates.email, null);
  assert(report.results[10].candidates.phone);
  const calls = JSON.parse(await readFile(callsFile, "utf8"));
  assert(!calls.some((url) => url.includes("unrelated.example")));
  assert(!calls.some((url) => new URL(url).hostname === "x.com"));
  assert(!calls.some((url) => !/^https?:$/u.test(new URL(url).protocol)));

  // Duplicate row identities fail before a single evidence directory is created.
  // 重复行标识必须在创建任何证据目录前失败。
  const duplicateQueue = path.join(temp, "duplicate-queue.json");
  const duplicateOutput = path.join(temp, "duplicate-output");
  await writeFile(duplicateQueue, JSON.stringify([{ row_number: 1, company_name: "Demo Alpha" }, { row_number: 1, company_name: "Demo Beta" }]));
  assert.throws(() => run("public_contact_crawl.mjs", [duplicateQueue, duplicateOutput, path.join(temp, "duplicate-report.json")], { stdio: "pipe" }));
  await assert.rejects(stat(duplicateOutput), { code: "ENOENT" });

  console.log(JSON.stringify({ status: "pass", checks: ["visible_scope", "expected_count_guard", "duplicate_identity_flags", "no_index_reset", "explicit_index_reset_flag", "full_url_domain", "no_seed_persistence", "cross_domain_redirect_block", "hostname_boundary", "blocked_social_host", "unsupported_protocol", "auxiliary_url_is_not_official", "encoded_mailto", "malformed_mailto_rejected", "duplicate_output_identity"] }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
