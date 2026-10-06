import { writeFileSync } from "node:fs";

// Synthetic-only transport: the regression suite never contacts a real company.
// 纯合成网络替身：回归测试不会访问真实公司或发出真实网络请求。
const calls = [];
const response = (url, body, init = {}) => {
  const value = new Response(body, { headers: { "content-type": "text/html" }, ...init });
  Object.defineProperty(value, "url", { value: url });
  return value;
};

globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  calls.push(url.href);
  if (url.hostname === "redirect.example") {
    if (options.redirect === "follow") return response("https://unrelated.example/contact", '<a href="tel:+1 202 555 0199">Call</a>');
    return response(url.href, "", { status: 302, headers: { location: "https://unrelated.example/contact" } });
  }
  if (url.hostname === "unrelated.example") throw new Error("cross-domain request must not happen");
  if (url.hostname === "encoded.example") {
    return response(url.href, '<title>Demo Alpha</title><a href="mailto:info%40encoded.example?subject=Demo">Email</a>');
  }
  if (url.hostname === "malformed.example") {
    return response(url.href, '<title>Demo Beta</title><a href="mailto:info%ZZ%40malformed.example">Email</a><a href="mailto:info%40malformed.example%0AInjected">Bad encoding</a><a href="mailto:info%40malformed.example%2Cadmin%40malformed.example">Multiple recipients</a>');
  }
  return response(url.href, `<title>Demo Alpha</title><a href="/contact">Contact</a><a href="mailto:info@${url.hostname}">Email</a><a href="tel:+1 202 555 0148">Call</a>`);
};

// Only the local request log is persisted, allowing redirect/privacy assertions.
// 仅保存本地请求日志，用于断言跳转与隐私边界是否正确。
process.on("exit", () => {
  if (process.env.STUB_REQUEST_LOG) writeFileSync(process.env.STUB_REQUEST_LOG, JSON.stringify(calls));
});
