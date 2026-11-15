import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Firebase Auth dependency includes the popup IndexedDB visibility regression fix', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const version = packageJson.dependencies?.firebase;
  assert.equal(typeof version, 'string', 'Firebase must be an explicit application dependency');

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  assert.ok(match, 'Firebase must be pinned to an exact release; received: ' + version);

  const actual = match.slice(1).map(Number);
  const fixed = [12, 18, 0];
  const isAtLeastFixed = actual[0] > fixed[0]
    || (actual[0] === fixed[0] && actual[1] > fixed[1])
    || (actual[0] === fixed[0] && actual[1] === fixed[1] && actual[2] >= fixed[2]);

  assert.ok(isAtLeastFixed, 'Firebase ' + version + ' contains the known Database is closing/hidden popup-auth regression. Use 12.18.0 or later.');
});
