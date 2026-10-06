/**
 * Offline synthetic transport; no network traffic is generated.
 * 离线合成传输层，不产生网络请求。
 */
import fs from 'node:fs';
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  calls.push({ host: parsed.host, path: parsed.pathname, method: options.method, authorization: options.headers?.get('Authorization') ?? null });
  switch (parsed.pathname) {
    case '/json': return new Response('{"items":[{"name":"Example organization"}]}', { headers: { 'content-type': 'application/json' } });
    case '/binary': return new Response(new Uint8Array([0, 1, 2, 3, 255]), { headers: { 'content-type': 'application/octet-stream' } });
    case '/redirect': return new Response(null, { status: 302, headers: { location: 'https://files.example.test/binary' } });
    case '/external': return new Response(null, { status: 302, headers: { location: 'https://unlisted.example.test/json' } });
    case '/insecure': return new Response(null, { status: 302, headers: { location: 'http://api.example.test/json' } });
    case '/limited': return new Response('synthetic limit', { status: 429 });
    case '/denied': return new Response('synthetic denial', { status: 403 });
    case '/large': return new Response(new Uint8Array(33), { headers: { 'content-type': 'application/octet-stream' } });
    case '/announced-large': return new Response(new Uint8Array(1), { headers: { 'content-length': '1000' } });
    default: throw new Error('Unexpected synthetic fixture route');
  }
};
process.on('exit', () => { if (process.env.API_STUB_LOG) fs.writeFileSync(process.env.API_STUB_LOG, JSON.stringify(calls)); });
