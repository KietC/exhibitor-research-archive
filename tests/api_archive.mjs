/**
 * Run with Node.js; all API calls use the offline fixture transport.
 * 使用 Node.js 运行，全部 API 请求使用离线合成传输层。
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'exhibitor-api-test-'));
const fixture = pathToFileURL(path.join(root, 'tests', 'fixtures', 'api_fetch_stub.mjs')).href;
let total = 0;
function base(requests) {
  return { base_url: 'https://api.example.test/', allowed_hosts: ['api.example.test', 'files.example.test'], headers_env: {}, interval_ms: 250, requests };
}
async function execute(name, config, extra = [], env = {}, output = undefined) {
  const directory = path.join(temporary, name);
  await fs.mkdir(directory, { recursive: true });
  const configPath = path.join(directory, 'config.json');
  const logPath = path.join(directory, 'calls.json');
  await fs.writeFile(configPath, JSON.stringify(config));
  const target = output ?? path.join(directory, 'archive');
  const result = spawnSync(process.execPath, ['--import', fixture, path.join(root, 'scripts', 'archive_api.mjs'), configPath, target, ...extra], {
    encoding: 'utf8', env: { ...process.env, EXAMPLE_API_AUTH: '', API_STUB_LOG: logPath, ...env }, timeout: 10000,
  });
  if (result.error) throw result.error;
  const calls = JSON.parse(await fs.readFile(logPath, 'utf8'));
  const report = JSON.parse(result.stdout.trim());
  return { result, calls, report, target };
}
async function test(name, run) { await run(); total++; process.stdout.write(`PASS ${name}\n`); }

try {
  const config = base([{ name: 'list', path: '/json', method: 'GET' }, { name: 'file', path: '/binary', method: 'GET' }]);
  let original;
  await test('save JSON and binary bytes with manifest', async () => {
    original = await execute('saved', config);
    assert.equal(original.result.status, 0);
    const manifest = JSON.parse(await fs.readFile(path.join(original.target, 'manifest.json'), 'utf8'));
    assert.equal(manifest.status, 'complete');
    assert.equal(manifest.requests.length, 2);
    assert.equal(manifest.requests[1].bytes, 5);
    assert.match(manifest.requests[0].sha256, /^[a-f0-9]{64}$/);
  });
  await test('resume skips only verified bytes', async () => {
    const resumed = await execute('resume', config, ['--resume'], {}, original.target);
    assert.equal(resumed.result.status, 0);
    assert.equal(resumed.report.skipped, 2);
    assert.equal(resumed.calls.length, 0);
  });
  await test('reject existing archive without resume', async () => {
    const repeated = await execute('repeat', config, [], {}, original.target);
    assert.equal(repeated.result.status, 1);
    assert.equal(repeated.report.reason, 'existing_archive_requires_resume');
    assert.equal(repeated.calls.length, 0);
  });
  await test('reject changed resume configuration', async () => {
    const changed = await execute('changed', { ...config, max_response_bytes: 9999 }, ['--resume'], {}, original.target);
    assert.equal(changed.report.reason, 'resume_config_mismatch');
    assert.equal(changed.calls.length, 0);
  });
  await test('reject corrupted saved response', async () => {
    await fs.writeFile(path.join(original.target, 'responses', 'list.json'), '{}');
    const corrupt = await execute('corrupt', config, ['--resume'], {}, original.target);
    assert.equal(corrupt.report.reason, 'resume_response_hash_mismatch');
    assert.equal(corrupt.calls.length, 0);
  });
  await test('resume binds each file to its configured request', async () => {
    for (const [label, mutate] of [
      ['rename', manifest => { manifest.requests = manifest.requests.slice(0, 1); manifest.requests[0].name = 'file'; }],
      ['url', manifest => { manifest.requests[0].request_url = 'https://api.example.test/binary'; }],
      ['duplicate', manifest => { manifest.requests.push({ ...manifest.requests[0] }); }],
      ['schema', manifest => { manifest.requests = {}; }],
      ['metadata', manifest => { manifest.requests[0].extra_private_header = 'synthetic-private-metadata'; }],
      ['root-metadata', manifest => { manifest.extra_private_header = 'synthetic-private-metadata'; }],
    ]) {
      const seeded = await execute(`binding-${label}`, config);
      const filename = path.join(seeded.target, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(filename, 'utf8'));
      mutate(manifest);
      await fs.writeFile(filename, JSON.stringify(manifest));
      const resumed = await execute(`binding-resume-${label}`, config, ['--resume'], {}, seeded.target);
      assert.equal(resumed.result.status, 1);
      assert.match(resumed.report.reason, /^resume_(invalid_record|duplicate_request|invalid_manifest)$/);
      assert.equal(resumed.calls.length, 0);
    }
  });
  await test('reject output and response directory links before fetch', async () => {
    // Windows junctions need no symlink privilege and exercise the same boundary.
    // Windows 目录联接无需符号链接权限，可测试同一目录边界。
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    const seeded = await execute('linked-responses', config);
    const responses = path.join(seeded.target, 'responses');
    const outside = path.join(temporary, 'outside-responses');
    await fs.rename(responses, outside);
    await fs.symlink(outside, responses, linkType);
    try {
      const resumed = await execute('linked-responses-resume', config, ['--resume'], {}, seeded.target);
      assert.equal(resumed.report.reason, 'unsafe_output_path');
      assert.equal(resumed.calls.length, 0);
    } finally { await fs.unlink(responses); }
    const rootLink = path.join(temporary, 'linked-output');
    await fs.symlink(seeded.target, rootLink, linkType);
    try {
      const resumed = await execute('linked-output-resume', config, ['--resume'], {}, rootLink);
      assert.equal(resumed.report.reason, 'unsafe_output_path');
      assert.equal(resumed.calls.length, 0);
    } finally { await fs.unlink(rootLink); }
  });
  await test('strip credentials on allowed cross-host redirect', async () => {
    const authConfig = { ...base([{ name: 'redirected', path: '/redirect' }]), headers_env: { Authorization: 'EXAMPLE_API_AUTH' } };
    const redirected = await execute('redirect', authConfig, [], { EXAMPLE_API_AUTH: 'Bearer SYNTHETIC_TEST_VALUE' });
    assert.equal(redirected.result.status, 0);
    assert.equal(redirected.calls[0].authorization, 'Bearer SYNTHETIC_TEST_VALUE');
    assert.equal(redirected.calls[1].authorization, null);
    const manifestText = await fs.readFile(path.join(redirected.target, 'manifest.json'), 'utf8');
    assert.ok(!manifestText.includes('SYNTHETIC_TEST_VALUE'));
    assert.ok(!redirected.result.stdout.includes('SYNTHETIC_TEST_VALUE'));
  });
  await test('reject external redirect before second fetch', async () => {
    const external = await execute('external', base([{ name: 'external', path: '/external' }]));
    assert.equal(external.report.reason, 'host_not_allowed');
    assert.equal(external.calls.length, 1);
  });
  await test('reject HTTPS downgrade redirect', async () => {
    const insecure = await execute('insecure', base([{ name: 'insecure', path: '/insecure' }]));
    assert.equal(insecure.report.reason, 'unsafe_request_url');
    assert.equal(insecure.calls.length, 1);
  });
  await test('429 stops before later requests without retry', async () => {
    const limited = await execute('limited', base([{ name: 'limited', path: '/limited' }, { name: 'later', path: '/json' }]));
    assert.equal(limited.result.status, 1);
    assert.equal(limited.report.reason, 'http_429');
    assert.equal(limited.calls.length, 1);
  });
  await test('403 stops immediately', async () => {
    const denied = await execute('denied', base([{ name: 'denied', path: '/denied' }]));
    assert.equal(denied.report.reason, 'http_403');
    assert.equal(denied.calls.length, 1);
  });
  await test('stream response limit and Content-Length limit', async () => {
    for (const route of ['large', 'announced-large']) {
      const large = await execute(route, { ...base([{ name: 'large', path: `/${route}` }]), max_response_bytes: 32 });
      assert.equal(large.report.reason, 'response_size_limit');
      assert.equal(large.calls.length, 1);
    }
  });
  await test('missing environment value makes no requests', async () => {
    const missing = await execute('env', { ...config, headers_env: { Authorization: 'EXAMPLE_API_AUTH' } });
    assert.equal(missing.report.reason, 'missing_header_environment_variable');
    assert.equal(missing.calls.length, 0);
  });
  await test('reject URL credentials, query secrets and foreign port', async () => {
    for (const [url, reason] of [
      ['https://user:password@api.example.test/json', 'unsafe_request_url'],
      ['https://api.example.test/json?access_token=synthetic', 'secret_query_parameter'],
      ['https://api.example.test/json?session_id=synthetic', 'secret_query_parameter'],
      ['https://api.example.test/json?X-Amz-Credential=synthetic', 'secret_query_parameter'],
      ['https://api.example.test:8443/json', 'host_not_allowed'],
    ]) {
      const rejected = await execute(`url-${total}-${reason}`, base([{ name: 'rejected', url }]));
      assert.equal(rejected.report.reason, reason);
      assert.equal(rejected.calls.length, 0);
    }
  });
  await test('POST is sent once and is not resumed', async () => {
    const postConfig = base([{ name: 'post', path: '/json', method: 'POST', body: { example: true } }]);
    const posted = await execute('post', postConfig);
    assert.equal(posted.result.status, 0);
    assert.equal(posted.calls.length, 1);
    assert.equal(posted.calls[0].method, 'POST');
    const resumed = await execute('post-resume', postConfig, ['--resume'], {}, posted.target);
    assert.equal(resumed.report.reason, 'resume_requires_get_only');
    assert.equal(resumed.calls.length, 0);
  });
  process.stdout.write(`API archive regression: ${total} passed; offline only.\n`);
} finally {
  // Remove only the exact temporary directory created by this test.
  // 只删除本测试创建的精确临时目录。
  await fs.rm(temporary, { recursive: true, force: true });
}
