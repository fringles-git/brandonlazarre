import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../src/sw.js', import.meta.url), 'utf8');
const handlers = new Map();
const cacheData = new Map([['./', new Response('cached-shell', { status: 200 })]]);
const cache = {
  async match(key) { return cacheData.get(typeof key === 'string' ? key : key.url); },
  async put(key, response) { cacheData.set(typeof key === 'string' ? key : key.url, response); },
  async addAll() {},
  async delete() { return true; },
  async keys() { return []; },
};
const caches = {
  async open() { return cache; },
  async match(key) { return cache.match(key); },
  async keys() { return []; },
};

const context = vm.createContext({
  console,
  URL,
  Response,
  Blob,
  Promise,
  setTimeout,
  clearTimeout,
  caches,
  location: { origin: 'https://notes.example.test' },
  self: {
    addEventListener(type, fn) { handlers.set(type, fn); },
    skipWaiting() {},
    clients: { claim() {} },
  },
  fetch: async () => new Response('proxy-error', { status: 503 }),
});
vm.runInContext(source.replace("const VERSION = '__VERSION__';", "const VERSION = 'test-cache';"), context);

const navigation = handlers.get('fetch');
assert.ok(navigation, 'service worker must register a fetch handler');

let responsePromise;
navigation({
  request: { method: 'GET', mode: 'navigate', url: 'https://notes.example.test/' },
  respondWith(promise) { responsePromise = promise; },
});
const response = await responsePromise;
assert.equal(response.status, 200, 'non-2xx navigation responses must fall back to the cached shell');
assert.equal(await response.text(), 'cached-shell');

console.log('Service worker regression: non-2xx navigation falls back to cached shell.');
