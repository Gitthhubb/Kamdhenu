import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Android PWA manifest launches Kamdhenu in standalone mode', async () => {
  const manifest = JSON.parse(await read('../public/manifest.webmanifest'));
  assert.equal(manifest.name, 'कामधेनु');
  assert.equal(manifest.short_name, 'कामधेनु');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.display_override.includes('standalone'));
  assert.equal(manifest.prefer_related_applications, false);
  assert.match(manifest.start_url, /source=android-app/);
  assert.equal(new URL(manifest.start_url, 'https://kamdhenu.example').origin, 'https://kamdhenu.example');
});

test('manifest supplies standard and maskable Android icons', async () => {
  const manifest = JSON.parse(await read('../public/manifest.webmanifest'));
  const normal192 = manifest.icons.find(icon => icon.sizes === '192x192' && icon.purpose === 'any');
  const normal512 = manifest.icons.find(icon => icon.sizes === '512x512' && icon.purpose === 'any');
  const maskable = manifest.icons.find(icon => icon.purpose === 'maskable');
  assert.equal(normal192?.src, '/icon-192.png');
  assert.equal(normal512?.src, '/icon-512.png');
  assert.equal(maskable?.src, '/icon-maskable.svg');

  const icon = await read('../public/icon-maskable.svg');
  assert.match(icon, /viewBox="0 0 512 512"/);
  assert.match(icon, /<rect width="512" height="512" fill="#285b40"/);
});

test('Android launcher shortcuts deep-link to milk and transactions', async () => {
  const manifest = JSON.parse(await read('../public/manifest.webmanifest'));
  assert.deepEqual(manifest.shortcuts.map(item => item.url), ['/?tab=milk', '/?tab=transactions']);
});

test('Android PNG launcher icons have their declared pixel dimensions', async () => {
  const icon192 = await readFile(new URL('../public/icon-192.png', import.meta.url));
  const icon512 = await readFile(new URL('../public/icon-512.png', import.meta.url));
  assert.equal(icon192.readUInt32BE(16), 192);
  assert.equal(icon192.readUInt32BE(20), 192);
  assert.equal(icon512.readUInt32BE(16), 512);
  assert.equal(icon512.readUInt32BE(20), 512);
});

test('service worker registers from the unauthenticated app shell and precaches the maskable icon', async () => {
  const source = await read('../src/main.jsx');
  const authGate = source.slice(source.indexOf('function AuthGate(){'));
  assert.match(authGate, /navigator\.serviceWorker\.register\('\/sw\.js'/);
  assert.match(authGate, /beforeinstallprompt/);
  assert.match(authGate, /appinstalled/);

  const worker = await read('../public/sw.js');
  assert.match(worker, /kamdhenu-pwa-v5/);
  assert.match(worker, /icon-maskable\.svg/);
});

test('Android shortcut query parameters select their requested ledger tab', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /get\('tab'\)==='transactions'\?'Transactions':'Milk'/);
  assert.match(source, /changeLedgerTab\('Transactions',setTab\)/);
});
