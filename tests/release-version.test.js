import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('package metadata identifies the stable 2.0.0 release', async () => {
  const pkg = JSON.parse(await read('../package.json'));
  assert.equal(pkg.version, '2.0.0');
});

test('production UI no longer describes the app as an unreleased testing build', async () => {
  const source = await read('../src/main.jsx');
  assert.doesNotMatch(source, /परीक्षण संस्करण/);
  assert.match(source, /संस्करण 2\.0\.0/);
});

test('release PWA cache is bumped and stale cache identifiers are absent', async () => {
  const worker = await read('../public/sw.js');
  assert.match(worker, /kamdhenu-pwa-v6/);
  assert.doesNotMatch(worker, /kamdhenu-pwa-v5/);
});
