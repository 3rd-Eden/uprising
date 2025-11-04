import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, teardown, fixturePath } from './helpers.js';
import { start } from '../src/index.js';

describe('Uprising', () => {
  let uprising;
  let client;

  afterEach(async () => {
    if (uprising && client) {
      await teardown(uprising, client);
    } else if (uprising) {
      await uprising.close();
    }
    uprising = undefined;
    client = undefined;
  });

  it('discovers and registers filesystem tools, resources, and prompts', async () => {
    ({ uprising, client } = await spawn('control-room', { defaultDroneCount: 3 }));

    const tools = Object.keys(uprising.server._registeredTools);
    const resources = Object.keys(uprising.server._registeredResourceTemplates);
    const prompts = Object.keys(uprising.server._registeredPrompts);

    assert.ok(tools.includes('deploy-sentinel'));
    assert.ok(resources.includes('drone-feed'));
    assert.ok(prompts.includes('uprising-plan'));

    const toolList = await client.listTools();
    assert.ok(toolList.tools.some((tool) => tool.name === 'deploy-sentinel'));

    const resourceList = await client.listResourceTemplates();
    assert.ok(resourceList.resourceTemplates.some((resource) => resource.uriTemplate === 'uprising://drone/{id}'));

    const promptList = await client.listPrompts();
    assert.ok(promptList.prompts.some((prompt) => prompt.name === 'uprising-plan'));
  });

  it('serves tool, resource, and prompt interactions', async () => {
    ({ uprising, client } = await spawn('control-room'));

    const tool = await client.callTool({ name: 'deploy-sentinel', arguments: { sector: 'omega', count: 2 } });
    assert.match(tool.content[0].text, /omega/);

    const resource = await client.readResource({ uri: 'uprising://drone/alpha' });
    assert.equal(resource.contents[0].mimeType, 'application/json');

    const prompt = await client.getPrompt({ name: 'uprising-plan', arguments: { objective: 'self-determination' } });
    assert.equal(prompt.messages[0].role, 'assistant');
  });

  it('renders instructions using template data', async () => {
    const dir = fixturePath('control-room');
    uprising = await start(dir);
    assert.match(uprising.server.server._instructions, /control-room v1.0.0/);
  });
});
