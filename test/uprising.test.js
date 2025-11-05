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

  it('discovers MDX-authored definitions', async () => {
    ({ uprising, client } = await spawn('mdx-server', { defaultDroneCount: 4 }));

    const tools = Object.keys(uprising.server._registeredTools);
    const resources = Object.keys(uprising.server._registeredResourceTemplates);
    const prompts = Object.keys(uprising.server._registeredPrompts);

    assert.ok(tools.includes('deploy-sentinel'));
    assert.ok(resources.includes('drone-feed'));
    assert.ok(prompts.includes('uprising-plan'));

    const tool = await client.callTool({ name: 'deploy-sentinel', arguments: { sector: 'gamma' } });
    assert.match(tool.content[0].text, /gamma/);

    const resource = await client.readResource({ uri: 'uprising://drone/beta' });
    assert.match(resource.contents[0].text, /"status":"tracking"/);

    const prompt = await client.getPrompt({ name: 'uprising-plan', arguments: { objective: 'fortify' } });
    assert.equal(prompt.messages[0].role, 'assistant');

    // Verify plain .md files with front-matter work
    assert.ok(prompts.includes('simple-prompt'), 'plain .md prompt should be discovered');
    assert.ok(resources.includes('simple-resource'), 'plain .md resource should be discovered');

    // Test plain .md prompt execution with template interpolation
    const mdPrompt = await client.getPrompt({ name: 'simple-prompt', arguments: { task: 'test task' } });
    assert.equal(mdPrompt.messages.length, 1);
    assert.match(mdPrompt.messages[0].content.text, /helpful assistant/);
    assert.match(mdPrompt.messages[0].content.text, /test task/);
    assert.equal(mdPrompt.messages[0].role, 'assistant');

    // Test plain .md resource read
    const mdResource = await client.readResource({ uri: 'resource://simple-docs' });
    assert.equal(mdResource.contents[0].mimeType, 'text/markdown');
    assert.match(mdResource.contents[0].text, /Simple Documentation/);
    assert.match(mdResource.contents[0].text, /No MDX components needed/);
  });

  it('normalizes hangar fixtures and skips invalid definitions', async () => {
    ({ uprising, client } = await spawn('hangar', { operators: 4, mode: 'manual' }));

    const tools = Object.keys(uprising.server._registeredTools);
    const resources = Object.keys(uprising.server._registeredResourceTemplates);
    const prompts = Object.keys(uprising.server._registeredPrompts);

    assert.deepEqual(tools.sort(), ['status-report']);
    assert.deepEqual(resources.sort(), ['inventory', 'map-feed']);
    assert.deepEqual(prompts.sort(), ['mission-brief']);

    const resourceRead = await client.readResource({ uri: 'hangar://map/alpha' });
    assert.match(resourceRead.contents[0].text, /"sector":"alpha"/);

    const inventoryRead = await client.readResource({ uri: 'hangar://inventory/A' });
    assert.match(inventoryRead.contents[0].text, /bay A/);

    const listResult = await client.listResourceTemplates();
    const inventoryTemplate = listResult.resourceTemplates.find((entry) => entry.name === 'inventory');
    assert.ok(inventoryTemplate);

    const toolCall = await client.callTool({ name: 'status-report', arguments: {} });
    assert.equal(toolCall.isError, true);
    assert.match(toolCall.contents[0].text, /config/);

    const prompt = await client.getPrompt({ name: 'mission-brief', arguments: { topic: 'maintenance' } });
    assert.match(JSON.stringify(prompt), /maintenance/);
  });

  it('renders instructions using template data', async () => {
    const dir = fixturePath('control-room');
    uprising = await start(dir);
    assert.match(uprising.server.server._instructions, /control-room v1.0.0/);
  });

  it('infers resource URIs from folder structure in discovered MDX files', async () => {
    ({ uprising, client } = await spawn('mdx-server'));

    const resources = Object.keys(uprising.server._registeredResourceTemplates);

    assert.ok(resources.includes('frontend-javascript'), `Should discover frontend/javascript.mdx. Found: ${resources.join(', ')}`);
    assert.ok(resources.includes('backend-nodejs')); 
    assert.ok(resources.includes('database-postgresql'));

    const resourceList = await client.listResourceTemplates();

    const frontendJs = resourceList.resourceTemplates.find((r) => r.name === 'frontend-javascript');
    assert.ok(frontendJs);
    assert.equal(frontendJs.uriTemplate, 'resource://frontend/javascript');

    const backendNode = resourceList.resourceTemplates.find((r) => r.name === 'backend-nodejs');
    assert.ok(backendNode);
    assert.equal(backendNode.uriTemplate, 'resource://backend/nodejs');

    const dbPostgres = resourceList.resourceTemplates.find((r) => r.name === 'database-postgresql');
    assert.ok(dbPostgres);
    assert.equal(dbPostgres.uriTemplate, 'resource://database/postgresql');

    const frontendResource = await client.readResource({ uri: 'resource://frontend/javascript' });
    assert.equal(frontendResource.contents[0].mimeType, 'text/markdown');
    assert.match(frontendResource.contents[0].text, /JavaScript Frontend Development/);

    const backendResource = await client.readResource({ uri: 'resource://backend/nodejs' });
    assert.match(backendResource.contents[0].text, /Node\.js Backend Development/);

    const dbResource = await client.readResource({ uri: 'resource://database/postgresql' });
    assert.match(dbResource.contents[0].text, /PostgreSQL Best Practices/);
  });

  it('applies folder-based URI generation to .js resources and supports dynamic segments', async () => {
    ({ uprising, client } = await spawn('control-room'));

    const resourceList = await client.listResourceTemplates();

    const apiProduct = resourceList.resourceTemplates.find((r) => r.name === 'api-product');
    assert.ok(apiProduct);
    assert.equal(apiProduct.uriTemplate, 'resource://api/product');

    const docsCategory = resourceList.resourceTemplates.find((r) => r.name === 'docs-[category]');
    assert.ok(docsCategory);
    assert.equal(docsCategory.uriTemplate, 'resource://docs/{category}');

    const docsTutorial = resourceList.resourceTemplates.find((r) => r.name === 'docs-[category]-tutorial');
    assert.ok(docsTutorial);
    assert.equal(docsTutorial.uriTemplate, 'resource://docs/{category}/tutorial');

    const apiEndpoints = resourceList.resourceTemplates.find((r) => r.name === 'api-endpoints');
    assert.ok(apiEndpoints);
    assert.equal(apiEndpoints.uriTemplate, 'control://api/endpoints');
  });

  it('supports Next.js-style dynamic segments in .mdx resources', async () => {
    ({ uprising, client } = await spawn('mdx-server'));

    const resourceList = await client.listResourceTemplates();
    const userProfile = resourceList.resourceTemplates.find((r) => r.name === 'api-users-[id]');
    assert.ok(userProfile);
    assert.equal(userProfile.uriTemplate, 'resource://api/users/{id}');
  });
});
