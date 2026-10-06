#!/usr/bin/env node
/**
 * Archive explicitly configured, authorized API requests without discovery.
 * 归档明确配置且已获授权的 API 请求，不自动发现或枚举接口。
 * Usage / 用法: node scripts/archive_api.mjs <config.json> <output-dir> [--resume]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
// Reject common signed-URL and session fields, including cloud-storage signatures.
// 拒绝常见签名 URL 与会话字段，含云存储签名参数。
const SECRET_QUERY = /(?:token|password|passwd|secret|authorization|cookie|session|signature|credential)|^(?:api[_-]?key|apikey|key|auth|sig)$/i;
const FORBIDDEN_HEADERS = /^(?:host|content-length|connection|transfer-encoding)$/i;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function canonical(value) {
  // Stable object-key ordering makes resume fingerprints deterministic.
  // 稳定排序对象键，使断点续跑指纹可重复。
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function fail(code) { throw new Error(code); }
function integer(value, fallback, minimum, maximum) {
  const parsed = value ?? fallback;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) fail('invalid_numeric_setting');
  return parsed;
}

function validatedUrl(value, base, allowed) {
  let url;
  try { url = new URL(value, base); } catch { fail('invalid_request_url'); }
  // Credentials in URLs or secret-bearing query keys must never enter archives.
  // URL 用户密码和含密钥语义的查询参数不得进入归档。
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('unsafe_request_url');
  if (!allowed.has(url.host.toLowerCase())) fail('host_not_allowed');
  for (const key of url.searchParams.keys()) if (SECRET_QUERY.test(key)) fail('secret_query_parameter');
  return url;
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('invalid_config');
  if (!Array.isArray(raw.allowed_hosts) || !raw.allowed_hosts.length) fail('missing_allowed_hosts');
  const allowed = new Set();
  for (const value of raw.allowed_hosts) {
    if (typeof value !== 'string' || value.includes('/') || value.includes('@') || value.includes('*')) fail('invalid_allowed_host');
    let host;
    try { host = new URL(`https://${value}`); } catch { fail('invalid_allowed_host'); }
    if (!host.hostname || host.host.toLowerCase() !== value.toLowerCase() || host.search || host.hash) fail('invalid_allowed_host');
    allowed.add(host.host.toLowerCase());
  }
  if (typeof raw.base_url !== 'string') fail('missing_base_url');
  const base = validatedUrl(raw.base_url, undefined, allowed);
  if (base.search) fail('base_url_query_not_supported');
  const headersEnv = raw.headers_env ?? {};
  if (!headersEnv || typeof headersEnv !== 'object' || Array.isArray(headersEnv)) fail('invalid_headers_env');
  const headers = new Headers();
  for (const [header, env] of Object.entries(headersEnv)) {
    if (FORBIDDEN_HEADERS.test(header) || typeof env !== 'string' || !/^[A-Z_][A-Z0-9_]*$/.test(env)) fail('invalid_header_mapping');
    const value = process.env[env];
    if (!value) fail('missing_header_environment_variable');
    try { headers.set(header, value); } catch { fail('invalid_header_value'); }
  }
  if (!Array.isArray(raw.requests) || !raw.requests.length) fail('missing_requests');
  const names = new Set();
  const requests = raw.requests.map(request => {
    if (!request || typeof request !== 'object' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(request.name ?? '') || names.has(request.name)) fail('invalid_or_duplicate_request_name');
    names.add(request.name);
    if ((typeof request.url === 'string') === (typeof request.path === 'string')) fail('provide_url_or_path');
    const method = request.method ?? 'GET';
    if (!['GET', 'POST'].includes(method)) fail('unsupported_method');
    if (method === 'GET' && request.body !== undefined) fail('get_body_not_supported');
    const url = validatedUrl(request.url ?? request.path, base, allowed);
    return { name: request.name, url: url.href, method, ...(request.body !== undefined ? { body: request.body } : {}) };
  });
  const config = {
    base_url: base.href, allowed_hosts: [...allowed].sort(), headers_env: headersEnv, requests,
    max_response_bytes: integer(raw.max_response_bytes, 10 * 1024 * 1024, 1, 200 * 1024 * 1024),
    timeout_ms: integer(raw.timeout_ms, 20000, 1000, 300000),
    interval_ms: integer(raw.interval_ms, 500, 250, 60000),
  };
  // Fingerprint config, but never persist resolved header values or request bodies.
  // 计算配置指纹，但绝不保存解析后的请求头值或请求正文。
  return { config, allowed, headers, baseHost: base.host, fingerprint: sha256(JSON.stringify(canonical(config))) };
}

async function rejectLinkedPath(filename) {
  // Check every existing path component, including Windows directory junctions.
  // 检查所有已存在的路径层级，包括 Windows 目录联接。
  let current = path.resolve(filename);
  while (true) {
    try { if ((await fs.lstat(current)).isSymbolicLink()) fail('unsafe_output_path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function boundedPath(filename, archiveRoot) {
  await rejectLinkedPath(filename);
  const parent = await fs.realpath(path.dirname(filename));
  const relative = path.relative(archiveRoot, parent);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('unsafe_output_path');
}

async function atomicWrite(filename, bytes, archiveRoot) {
  if (archiveRoot) await boundedPath(filename, archiveRoot);
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: 'wx' });
  try { await fs.rename(temporary, filename); }
  catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

async function boundedBody(response, maximum) {
  const announced = response.headers.get('content-length');
  if (announced !== null && /^\d+$/.test(announced) && Number(announced) > maximum) {
    await response.body?.cancel();
    fail('response_size_limit');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maximum) { await reader.cancel(); fail('response_size_limit'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, count);
}

async function requestBytes(request, runtime) {
  const { config, allowed, headers, baseHost } = runtime;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout_ms);
  let url = new URL(request.url);
  const visited = [];
  try {
    for (let hop = 0; hop <= 5; hop++) {
      // Headers are sent only to the configured base host, never other hosts.
      // 请求头只发送到配置的基础主机，其他主机不得接收凭据。
      const outgoing = url.host === baseHost ? new Headers(headers) : new Headers();
      let body;
      if (request.body !== undefined) {
        body = JSON.stringify(request.body);
        if (!outgoing.has('content-type')) outgoing.set('content-type', 'application/json');
      }
      const response = await fetch(url.href, { method: request.method, headers: outgoing, body, redirect: 'manual', signal: controller.signal });
      visited.push({ url: url.href, status: response.status });
      if ([401, 403, 429].includes(response.status)) { await response.body?.cancel(); fail(`http_${response.status}`); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        // POST redirects are not followed: a repeated POST may cause side effects.
        // 不跟随 POST 重定向，重复 POST 可能产生副作用。
        if (request.method !== 'GET') fail('post_redirect_not_followed');
        const location = response.headers.get('location');
        if (!location) fail('missing_redirect_location');
        if (hop === 5) fail('redirect_limit');
        url = validatedUrl(location, url, allowed);
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); fail(`http_${response.status}`); }
      const bytes = await boundedBody(response, config.max_response_bytes);
      return { bytes, final_url: url.href, status: response.status, content_type: response.headers.get('content-type') ?? '', redirects: visited };
    }
    fail('redirect_limit');
  } catch (error) {
    if (controller.signal.aborted) fail('request_timeout');
    throw error;
  } finally { clearTimeout(timer); }
}

function extension(contentType) {
  const type = contentType.toLowerCase().split(';')[0].trim();
  if (type === 'application/json' || type.endsWith('+json')) return 'json';
  if (type === 'application/pdf') return 'pdf';
  if (type === 'text/html') return 'html';
  if (type.startsWith('text/')) return 'txt';
  return 'bin';
}

async function archive(configFile, outputDir, resume) {
  const runtime = normalizeConfig(JSON.parse(await fs.readFile(configFile, 'utf8')));
  const { config, fingerprint } = runtime;
  if (resume && config.requests.some(request => request.method !== 'GET')) fail('resume_requires_get_only');
  const root = path.resolve(outputDir);
  const manifestFile = path.join(root, 'manifest.json');
  await rejectLinkedPath(manifestFile);
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (manifest && !resume) fail('existing_archive_requires_resume');
  if (resume && !manifest) fail('resume_manifest_missing');
  if (manifest && (manifest.version !== 1 || manifest.config_sha256 !== fingerprint)) fail('resume_config_mismatch');
  if (manifest && (!Array.isArray(manifest.requests) || !['running', 'complete', 'stopped'].includes(manifest.status))) fail('resume_invalid_manifest');
  const manifestKeys = new Set(['version', 'config_sha256', 'created_at', 'updated_at', 'status', 'stop_reason', 'requests']);
  if (manifest && Object.keys(manifest).some(key => !manifestKeys.has(key))) fail('resume_invalid_manifest');
  if (!manifest) {
    // Require an empty destination so unrelated files cannot be overwritten.
    // 要求目的目录为空，防止覆盖无关文件。
    try { if ((await fs.readdir(root)).length) fail('output_directory_not_empty'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    manifest = { version: 1, config_sha256: fingerprint, created_at: new Date().toISOString(), status: 'running', requests: [] };
  }
  await rejectLinkedPath(path.join(root, 'responses'));
  await fs.mkdir(path.join(root, 'responses'), { recursive: true });
  const canonicalRoot = await fs.realpath(root);
  await boundedPath(path.join(root, 'responses', 'boundary-check'), canonicalRoot);
  const save = async () => { manifest.updated_at = new Date().toISOString(); await atomicWrite(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, canonicalRoot); };
  // Validate every previously saved byte before issuing any resumed request.
  // 发出续跑请求前，先校验全部已保存字节。
  if (resume) {
    const configured = new Map(config.requests.map(request => [request.name, request]));
    const seen = new Set();
    for (const record of manifest.requests) {
      if (!record || typeof record !== 'object' || !configured.has(record.name)) fail('resume_unknown_request');
      if (seen.has(record.name)) fail('resume_duplicate_request');
      seen.add(record.name);
      if (!['saved', 'failed'].includes(record.status) || record.method !== configured.get(record.name).method) fail('resume_invalid_record');
      // Do not re-save unknown metadata that may contain credentials.
      // 不重新保存可能含凭据的未知元数据。
      const recordKeys = new Set(record.status === 'saved'
        ? ['name', 'method', 'request_url', 'final_url', 'status', 'http_status', 'content_type', 'bytes', 'sha256', 'file', 'redirects', 'saved_at']
        : ['name', 'method', 'status', 'reason', 'failed_at']);
      if (Object.keys(record).some(key => !recordKeys.has(key))) fail('resume_invalid_record');
      if (record.status !== 'saved') continue;
      // Bind saved bytes to their original configured request, not just any name.
      // 将已保存字节绑定到原始配置请求，不只是任意有效名称。
      const expected = configured.get(record.name);
      if (record.method !== 'GET' || record.request_url !== expected.url || typeof record.file !== 'string' || !new RegExp(`^responses/${record.name}\\.(json|pdf|html|txt|bin)$`).test(record.file)) fail('resume_invalid_record');
      if (typeof record.final_url !== 'string' || !Array.isArray(record.redirects) || record.redirects.length > 6) fail('resume_invalid_record');
      validatedUrl(record.final_url, undefined, runtime.allowed);
      for (const hop of record.redirects) {
        if (!hop || typeof hop.url !== 'string' || !Number.isInteger(hop.status) || Object.keys(hop).some(key => !['url', 'status'].includes(key))) fail('resume_invalid_record');
        validatedUrl(hop.url, undefined, runtime.allowed);
      }
      if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 || record.bytes > config.max_response_bytes || !/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) fail('resume_invalid_record');
      const responseFile = path.join(root, record.file);
      await boundedPath(responseFile, canonicalRoot);
      try { if (!(await fs.stat(responseFile)).isFile()) fail('resume_invalid_record'); }
      catch (error) { if (error.code === 'ENOENT') fail('resume_response_missing'); throw error; }
      if ((await fs.stat(responseFile)).size !== record.bytes) fail('resume_response_hash_mismatch');
      let bytes;
      try { bytes = await fs.readFile(responseFile); } catch { fail('resume_response_missing'); }
      if (sha256(bytes) !== record.sha256 || bytes.length !== record.bytes) fail('resume_response_hash_mismatch');
    }
  }
  manifest.status = 'running';
  delete manifest.stop_reason;
  await save();
  let skipped = 0;
  let saved = 0;
  let lastRequestAt = 0;
  for (const request of config.requests) {
    const old = manifest.requests.find(record => record.name === request.name);
    if (resume && old?.status === 'saved') { skipped++; continue; }
    if (lastRequestAt) await delay(Math.max(0, config.interval_ms - (Date.now() - lastRequestAt)));
    lastRequestAt = Date.now();
    try {
      const result = await requestBytes(request, runtime);
      const file = `responses/${request.name}.${extension(result.content_type)}`;
      await atomicWrite(path.join(root, file), result.bytes, canonicalRoot);
      const record = { name: request.name, method: request.method, request_url: request.url, final_url: result.final_url, status: 'saved', http_status: result.status, content_type: result.content_type, bytes: result.bytes.length, sha256: sha256(result.bytes), file, redirects: result.redirects, saved_at: new Date().toISOString() };
      if (old) manifest.requests[manifest.requests.indexOf(old)] = record;
      else manifest.requests.push(record);
      saved++;
      await save();
    } catch (error) {
      // Only bounded internal error codes are printed, never server bodies/secrets.
      // 仅打印受限的内部错误代码，绝不打印服务端正文或密钥。
      const code = safeErrorCode(error);
      const record = { name: request.name, method: request.method, status: 'failed', reason: code, failed_at: new Date().toISOString() };
      if (old) manifest.requests[manifest.requests.indexOf(old)] = record;
      else manifest.requests.push(record);
      manifest.status = 'stopped';
      manifest.stop_reason = code;
      await save();
      return { status: 'stopped', reason: code, saved, skipped, total: config.requests.length, exit_code: 1 };
    }
  }
  manifest.status = 'complete';
  await save();
  return { status: 'complete', saved, skipped, total: config.requests.length, exit_code: 0 };
}

function safeErrorCode(error) {
  const message = error?.message ?? '';
  const known = /^(?:http_\d{3}|invalid_[a-z_]+|missing_[a-z_]+|unsafe_request_url|unsafe_output_path|host_not_allowed|secret_query_parameter|base_url_query_not_supported|provide_url_or_path|unsupported_method|get_body_not_supported|response_size_limit|post_redirect_not_followed|redirect_limit|request_timeout|resume_[a-z_]+|existing_archive_requires_resume|output_directory_not_empty)$/;
  return known.test(message) ? message : 'archive_error';
}

const args = process.argv.slice(2);
if (args.length < 2 || args.length > 3 || (args[2] !== undefined && args[2] !== '--resume')) {
  process.stderr.write('Usage: node scripts/archive_api.mjs <config.json> <output-dir> [--resume]\n');
  process.exitCode = 2;
} else {
  try {
    const result = await archive(args[0], args[1], args[2] === '--resume');
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.exit_code;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'stopped', reason: safeErrorCode(error), exit_code: 1 })}\n`);
    process.exitCode = 1;
  }
}
