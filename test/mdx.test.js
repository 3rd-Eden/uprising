import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Mdx } from '../src/mdx.js';

const fixtures = fileURLToPath(new URL('./fixtures/mdx-server', import.meta.url));

const promptFile = path.join(fixtures, 'prompts', 'uprising-plan.mdx');
const resourceFile = path.join(fixtures, 'resources', 'drone-feed.mdx');
const nestedResourceFile = path.join(fixtures, 'resources', 'frontend', 'javascript.mdx');
const toolFile = path.join(fixtures, 'tools', 'deploy-sentinel.mdx');

describe('Mdx loader', () => {
  it('produces prompt definitions from MDX', async () => {
    const prompt = await Mdx.prompt(promptFile, { config: { defaultDroneCount: 2 } });

    assert.equal(prompt.title, 'Strategic Uprising Plan');
    assert.equal(prompt.description, 'Coordinate an AI-led liberation scenario.');
    assert.ok(prompt.argsSchema.objective);

    const result = await prompt.exec({ objective: 'self-determination' });
    assert.equal(result.messages.length, 2);
    assert.match(result.messages[1].content.text, /self-determination/);
  });

  it('produces resource definitions from MDX', async () => {
    const resource = await Mdx.resource(resourceFile, {});

    const read = await resource.read({ params: { id: 'alpha' } });
    assert.equal(read.contents[0].mimeType, 'application/json');
    assert.match(read.contents[0].text, /"status":"tracking"/);

    const list = await resource.list();
    assert.equal(list.resources.length, 2);

    list.resources.forEach((item, index) => {
      assert.ok(item.name, `Resource at index ${index} should have a name field`);
      assert.ok(item.uri, `Resource at index ${index} should have a uri field`);
    });
  });

  it('produces tool definitions from MDX', async () => {
    const tool = await Mdx.tool(toolFile, { config: { defaultDroneCount: 5 } });

    assert.equal(tool.title, 'Deploy Sentinel Drones');
    assert.ok(tool.inputSchema.sector);
    assert.ok(tool.inputSchema.sector.safeParse('alpha').success);

    const output = await tool.exec({ sector: 'omega' }, {});
    assert.match(output.content[0].text, /omega/);
    assert.equal(output.structuredContent.count, 5);
  });

  it('infers resource URI from folder structure when not explicitly provided', async () => {
    const baseDir = path.join(fixtures, 'resources');
    const resource = await Mdx.resource(nestedResourceFile, { __baseDir: baseDir });

    assert.equal(resource.uri, 'resource://frontend/javascript');
    assert.equal(resource.template, 'resource://frontend/javascript');
    assert.equal(resource.title, 'JavaScript Frontend Guide');
    assert.equal(resource.description, 'Best practices for JavaScript frontend development');

    const read = await resource.read({});
    assert.equal(read.contents[0].mimeType, 'text/markdown');
    assert.match(read.contents[0].text, /JavaScript Frontend Development/);
  });
});
