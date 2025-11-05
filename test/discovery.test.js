import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover } from '../src/discovery.js';

const fixturesRoot = fileURLToPath(new URL('./fixtures/discovery', import.meta.url));

describe('discovery', () => {
  it('returns empty result when directory missing', async () => {
    const result = await discover('/does/not/exist', 'tools', {}, (name, definition) => ({ name, definition }));
    assert.deepEqual(result, {});
  });

  it('loads JSON definitions and passes them to the normalizer', async () => {
    const calls = [];
    const result = await discover(fixturesRoot, 'resources', { label: 'json-test' }, (name, definition) => {
      calls.push({ name, definition });
      return { name, title: definition.title };
    });

    const entry = calls.find((call) => call.name === 'json-def');
    assert.ok(entry, 'json-def should be discovered');
    assert.equal(entry.definition.title, 'JSON Definition');
    assert.equal(result['json-def'].title, 'JSON Definition');
  });

  it('supports modules exporting a function', async () => {
    const result = await discover(fixturesRoot, 'resources', { label: 'fn-label' }, (name, definition) => ({
      name: definition.name ?? name,
      title: definition.title,
    }));
    assert.equal(result['fn-entry'].title, 'Function Definition (fn-label)');
  });

  it('supports modules exposing a create() method and arrays of definitions', async () => {
    const result = await discover(fixturesRoot, 'resources', {}, (name, definition) => ({
      name: definition?.name ?? name,
      title: definition.title ?? '',
    }));

    assert.equal(result['created-entry'].title, 'Created item');
    assert.equal(result['module-create'].title, 'Unnamed entry');
    assert.equal(result['array-entry'].title, 'Array Definition');
    assert.equal(result['module-array'].title, 'Second Entry');
  });

  it('logs and skips modules that fail to load', async () => {
    const logs = [];
    const result = await discover(fixturesRoot, 'resources', {}, (name, definition) => ({ name, definition }), (message, ...args) => {
      logs.push({ message, args });
    });

    assert.ok(logs.some((entry) => String(entry.args[1]).includes('module-error.js')), 'error should be logged');
    assert.ok(!result['module-error'], 'failing module should be skipped');
  });
});
