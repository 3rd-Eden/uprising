import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { start } from '../src/index.js';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const fixturesRoot = fileURLToPath(new URL('./fixtures', import.meta.url));

/**
 * Resolve absolute path to a named fixture directory.
 *
 * @param {string} name - Fixture folder name.
 * @returns {string} Absolute path.
 */
export function fixturePath(name) {
  return join(fixturesRoot, name);
}

/**
 * Spin up an Uprising instance backed by the given fixture directory and connect a client.
 *
 * @param {string} name - Fixture folder name.
 * @param {Record<string, any>} [config] - Extra configuration passed to Uprising.
 * @returns {Promise<{ uprising: import('../src/index.js').Uprising, client: McpClient }>}
 */
export async function spawn(name, config = {}) {
  const dir = fixturePath(name);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const uprising = await start(dir, config, serverTransport);
  const client = new McpClient({ name: 'test-client', version: '0.0.0' }, { capabilities: { tools: {}, resources: {}, prompts: {} } });
  await client.connect(clientTransport);

  return { uprising, client };
}

/**
 * Tear down the provided uprising instance and client.
 *
 * @param {import('../src/index.js').Uprising} uprising - Active uprising instance.
 * @param {McpClient} client - Connected MCP client.
 * @returns {Promise<void>}
 */
export async function teardown(uprising, client) {
  await client.close();
  await uprising.close();
}
