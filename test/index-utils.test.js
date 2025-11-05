import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { template } from '../src/index.js';

describe('index template helper', () => {
  it('renders template values', () => {
    const output = template('Operators: {{ config.count }}', { config: { count: 2 } });
    assert.equal(output, 'Operators: 2');
  });
});
