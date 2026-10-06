#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const [queuePath, outputRoot, reportPath] = process.argv.slice(2);
if (![queuePath, outputRoot, reportPath].every(Boolean)) {
  throw new Error("usage: node public_contact_crawl.mjs <queue.json> <artifact-root> <report.json>");
}

const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
const rows = Array.isArray(queue) ? queue : queue.rows ?? queue.records;
if (!Array.isArray(rows)) throw new Error("queue must be an array or contain rows/records");

const compact = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const decode = (value) => String(value ?? "").replace(/&amp;/giu, "&").replace(/&#64;|\[at\]|\(at\)/giu, "@").replace(/&#46;|\[dot\]|\(dot\)/giu, ".");
const hostOf = (value) => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./u, ""); } catch { return null; } };
const sameHost = (candidate, official) => { const x = hostOf(candidate), y = hostOf(official); return Boolean(x && y && (x === y || x.endsWith(`.${y}`))); };
const slug = (value) => compact(value).normalize("NFKD").replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-|-$/gu, "").toLowerCase().slice(0, 80) || "company";
// Match hostname boundaries: a host containing the letters "x.com" is not x.com.
// 匹配完整域名边界：含有“x.com”字母片段的域名，不等于 x.com 本身。
const blockedHost = /(?:^|\.)(?:linkedin\.com|facebook\.com|instagram\.com|youtube\.com|twitter\.com|x\.com)$/iu;
const contactHint = /contact|kontakt|contatti|contato|contacto|contactez|reach-us|about-us|impressum|lianxi|联系我们|聯絡|お問い合わせ/iu;
const roleMailbox = /^(info|sales|contact|office|hello|support|service|export|international|marketing|inquiry|enquiry|commercial|orders?)$/iu;

// Only prepend HTTPS when there is no explicit URI scheme; never convert FTP,
// file:, javascript:, credential-bearing URLs, or malformed inputs into seeds.
// 仅无协议输入可补 HTTPS；不能把 FTP、file:、javascript:、含凭据或畸形地址变成种子。
function normalizeHttpUrl(value) {
  try {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const url = new URL(/^[a-z][a-z0-9+.-]*:/iu.test(text) ? text : `https://${text}`);
    if (!/^https?:$/u.test(url.protocol) || !url.hostname || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

// Decode URI mailbox data once and reject malformed or multi-recipient strings.
// 邮箱 URI 只解码一次；畸形编码和多个收件人的字符串不作为邮箱候选。
function normalizedEmail(value, uriEncoded = false) {
  let text = String(value ?? "");
  if (uriEncoded) {
    try { text = decodeURIComponent(text); } catch { return null; }
  }
  text = text.trim().toLowerCase();
  const parts = text.split("@");
  if (parts.length !== 2 || text.length > 254 || parts[0].length > 64) return null;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/iu.test(parts[0])) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu.test(parts[1])) return null;
  return text;
}

// Validate every redirect BEFORE requesting it; cross-domain contact data must
// never be silently attributed to the caller's selected company.
// 每次跳转都在请求前核验；不能把跨域页面的联系方式静默归到选定公司名下。
async function fetchPage(url, officialHost) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let current = url;
    let response;
    const redirects = [];
    for (let hop = 0; hop <= 5; hop += 1) {
      const target = new URL(current);
      if (!/^https?:$/u.test(target.protocol) || target.username || target.password || !sameHost(current, `https://${officialHost}`) || blockedHost.test(target.hostname)) {
        return { requested_url: url, final_url: current, error: "outside_official_domain", redirects };
      }
      response = await fetch(current, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 exhibitor-research-archive/1.0", accept: "text/html,application/xhtml+xml" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) return { requested_url: url, final_url: current, status: response.status, error: "redirect_without_location", redirects };
      current = new URL(location, current).href;
      redirects.push(current);
      if (hop === 5) return { requested_url: url, final_url: current, error: "redirect_limit", redirects };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !/html|text/iu.test(contentType)) return { requested_url: url, final_url: current, status: response.status, content_type: contentType, error: response.ok ? "non_html" : `http_${response.status}` };
    return { requested_url: url, final_url: current, status: response.status, content_type: contentType, redirects, html: await response.text() };
  } catch (error) {
    return { requested_url: url, final_url: null, status: null, error: error?.name === "AbortError" ? "timeout" : String(error?.message ?? error) };
  } finally { clearTimeout(timer); }
}

function cleanText(html) {
  return compact(decode(String(html ?? "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/gu, " ")));
}

// Extraction produces candidates, not identity proof or workbook-ready values.
// 提取结果只是候选值，不构成主体证明，也不能自动写入正式工作簿。
function extract(page, officialHost) {
  if (!page.html) return { emails: [], phones: [], links: [], title: null };
  const html = decode(page.html);
  const source = page.final_url || page.requested_url;
  const title = cleanText((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu) ?? [])[1]).slice(0, 300) || null;
  const mailtos = [...html.matchAll(/href\s*=\s*["']mailto:([^"'?\s#]+)/giu)].map((match) => normalizedEmail(match[1], true)).filter(Boolean);
  const visible = [...cleanText(html).matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu)].map((match) => normalizedEmail(match[0])).filter(Boolean);
  const emails = [...new Set([...mailtos, ...visible])].filter((email) => !/\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf)$/iu.test(email)).map((value) => {
    const [local, domain] = value.split("@");
    return { value, source_url: source, role_neutral: roleMailbox.test(local ?? ""), official_domain_match: Boolean(domain && officialHost && sameHost(`https://${domain}`, `https://${officialHost}`)) };
  });
  const phones = [...new Set([...html.matchAll(/href\s*=\s*["']tel:([^"'?#]+)/giu)].map((match) => compact(match[1])))]
    .filter((value) => value.replace(/\D/gu, "").length >= 6).map((value) => ({ value, source_url: source }));
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
    try {
      const url = new URL(decode(match[1]), source).href;
      if (normalizeHttpUrl(url) && contactHint.test(`${url} ${cleanText(match[2])}`) && sameHost(url, source) && !/\.pdf(?:$|\?)/iu.test(url)) links.push(url);
    } catch {}
  }
  return { emails, phones, links: [...new Set(links)].slice(0, 10), title };
}

// The caller must verify company identity before declaring an official website
// or domain. Auxiliary source_urls cannot establish an official host on their own.
// 调用方须先核实主体，再声明官网或域名；辅助 source_urls 不能独立证明官网身份。
function seedsFor(row) {
  const identity = row.selected_identity ?? row.identity ?? {};
  const primary = [identity.official_website_url, identity.website, row.official_website_url].map(normalizeHttpUrl).filter(Boolean);
  const domain = identity.official_domain ?? identity.domain;
  const domainUrl = domain ? normalizeHttpUrl(domain) : null;
  const officialHost = hostOf(domain ? domainUrl : primary[0]);
  if (!officialHost || blockedHost.test(officialHost)) return { officialHost: null, urls: [] };
  const auxiliary = Array.isArray(row.source_urls) ? row.source_urls.map(normalizeHttpUrl).filter(Boolean) : [];
  const urls = [...new Set([...primary, ...(domainUrl ? [domainUrl] : []), ...auxiliary])];
  return { officialHost, urls: urls.filter((url) => sameHost(url, `https://${officialHost}`)).slice(0, 3) };
}

// Fail before writing anything if two records would reuse the same row identity.
// 在任何落盘前检查重复行标识，避免两个企业写进同一证据目录。
const rowNumbers = rows.map((row, index) => row.row_number ?? index + 1);
if (rowNumbers.some((value) => !Number.isSafeInteger(value) || value <= 0) || new Set(rowNumbers).size !== rows.length) {
  throw new Error("row_number values must be unique positive integers; no artifacts were written");
}

// Save each artifact atomically. A later run may intentionally replace the same
// row; this collector is not a stateful resume engine or an evidence merger.
// 每份证据采用原子保存；重跑可有意替换相同行，本采集器不是续跑引擎或证据合并器。
async function atomicWrite(target, text) {
  await fs.mkdir(path.dirname(path.resolve(target)), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try { await fs.writeFile(temp, text, "utf8"); await fs.rename(temp, target); }
  finally { await fs.rm(temp, { force: true }); }
}

await fs.mkdir(outputRoot, { recursive: true });
const results = [];
for (const [index, row] of rows.entries()) {
  const seeds = seedsFor(row);
  const pages = [];
  const pending = [...seeds.urls];
  const seen = new Set();
  const companyDir = path.join(outputRoot, `${String(row.row_number ?? index + 1).padStart(4, "0")}_${slug(row.company_name ?? row.name)}`);
  await fs.mkdir(companyDir, { recursive: true });
  while (pending.length && pages.length < 5) {
    const url = pending.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await fetchPage(url, seeds.officialHost);
    const extracted = extract(page, seeds.officialHost);
    if (page.html) await atomicWrite(path.join(companyDir, `page_${pages.length + 1}.html`), page.html);
    pages.push({ ...page, html: undefined, ...extracted });
    pending.push(...extracted.links.filter((link) => !seen.has(link)).slice(0, 3));
  }
  const emails = pages.flatMap((page) => page.emails);
  const phones = pages.flatMap((page) => page.phones);
  const email = emails.find((item) => item.role_neutral && item.official_domain_match) ?? null;
  const phone = phones[0] ?? null;
  const contactPage = pages.find((page) => !page.error && page.status >= 200 && page.status < 300 && page.final_url && sameHost(page.final_url, `https://${seeds.officialHost}`) && (contactHint.test(page.final_url) || page.emails.length || page.phones.length)) ?? null;
  const result = {
    row_number: row.row_number ?? index + 1,
    company_name: row.company_name ?? row.name,
    official_host: seeds.officialHost,
    seed_policy: "caller_verified_official_identity_required",
    retrieved_at_utc: new Date().toISOString(),
    pages,
    candidates: { phone: phone?.value ?? null, email: email?.value ?? null, contact_source: contactPage?.final_url ?? null },
    confidence: { phone: phone ? "high_pending_identity_crosscheck" : "not_found", email: email ? "high_pending_identity_crosscheck" : "not_found", contact_source: contactPage ? "high_pending_identity_crosscheck" : "not_found" },
    anomalies: [...(seeds.urls.length ? [] : ["no_official_seed_url"]), ...(pages.some((page) => page.error) ? ["one_or_more_fetch_failures"] : [])],
  };
  results.push(result);
  await atomicWrite(path.join(companyDir, "crawl_result.json"), `${JSON.stringify(result, null, 2)}\n`);
}

const report = { schema: "official-contact-crawl-v1", generated_at_utc: new Date().toISOString(), target_count: rows.length, result_count: results.length, candidate_counts: { phone: results.filter((row) => row.candidates.phone).length, email: results.filter((row) => row.candidates.email).length, contact_source: results.filter((row) => row.candidates.contact_source).length }, results };
await atomicWrite(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, report: path.resolve(reportPath), targets: rows.length, candidates: report.candidate_counts }, null, 2));
