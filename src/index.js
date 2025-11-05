import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import diagnostics from 'diagnostics';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { discover } from './discovery.js';
import { normalize } from './normalize.js';

const debug = diagnostics('uprising:mcp');

/**
 * Bootstrap and manage the MCP server lifecycle.
 */
export class Uprising {
  /**
   * Bootstrap a new MCP server instance with a mandatory configuration.
   *
   * @param {string} dir - Directory containing tools/resources/prompts folders.
   * @param {Record<string, any>} [configuration={}] - Additional configuration passed to module factories.
   */
  constructor(dir, configuration = {}) {
    if (!dir || typeof dir !== 'string') throw new Error('Uprising requires a directory path.');

    this.root = resolve(dir);
    this.config = configuration;
    this.packageInfo = this.readPackageInfo();

    const serverInfo = this.createServerInfo();
    const instructions = this.loadInstructions();

    this.server = new McpServer(serverInfo, instructions ? { instructions } : undefined);
    this.prepared = this._prepare();
  }

  /**
   * Register tools on the MCP server.
   *
   * @param {Record<string, { title: string, description: string, inputSchema?: unknown, exec: Function }>} tools - Mapping of tool name to definitions.
   */
  tools(tools) {
    Object.entries(tools).forEach(([name, tool]) => {
      this.server.registerTool(name, {
        title: tool.title.trim(),
        description: tool.description.trim(),
        inputSchema: tool.inputSchema
      }, async (args, extra) => {
        try {
          return await tool.exec(args, extra);
        } catch (error) {
          debug('failed to execute tool %s', name, error);

          return {
            isError: true,
            contents: [{
              type: 'text',
              text: error instanceof Error ? error.message : String(error)
            }]
          };
        }
      });
    });
  }

  /**
   * Register resources on the MCP server.
   *
   * @param {Record<string, { title: string, description: string, template?: ResourceTemplate, uri?: string, read: Function }>} resources - Mapping of resource name to definitions.
   */
  resources(resources) {
    Object.entries(resources).forEach(([name, resource]) => {
      const template = resource.template ?? (resource.uri ? new ResourceTemplate(resource.uri, { list: undefined }) : undefined);
      if (!template) {
        debug('resource "%s" is missing a template/uri, skipping registration', name);
        return;
      }

      this.server.registerResource(name, template, {
        title: resource.title.trim(),
        description: resource.description.trim()
      }, async (uri, variables) => {
        try {
          return await resource.read({ params: { uri: uri.toString() }, variables });
        } catch (error) {
          debug('failed to read resource %s', name, error);

          return {
            isError: true,
            contents: [{
              mimeType: 'text/markdown',
              text: error instanceof Error ? error.message : String(error),
              uri
            }]
          };
        }
      });
    });
  }

  /**
   * Register prompts on the MCP server.
   *
   * @param {Record<string, { title: string, description: string, argsSchema?: unknown, exec: Function }>} prompts - Mapping of prompt name to definitions.
   */
  prompts(prompts) {
    Object.entries(prompts).forEach(([name, prompt]) => {
      this.server.registerPrompt(name, {
        title: prompt.title.trim(),
        description: prompt.description.trim(),
        argsSchema: prompt.argsSchema
      }, async (args, extra) => {
        try {
          return await prompt.exec(args, extra);
        } catch (error) {
          debug('failed to execute prompt %s', name, error);

          return {
            isError: true,
            description: prompt.description.trim(),
            messages: [{
              role: 'assistant',
              content: {
                type: 'text',
                text: error instanceof Error ? error.message : String(error)
              }
            }]
          };
        }
      });
    });
  }

  /**
   * Render a template string using double-curly placeholders.
   *
   * @param {string} input - Template string containing placeholders (e.g. {{ profile.name }}).
   * @param {Record<string, any>} data - Data map used to resolve placeholder values.
   * @returns {string} Rendered string with placeholders replaced when data is available.
   */
  template(input, data) {
    return input.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
      let value = data;
      for (const segment of key.split('.')) {
        if (value && typeof value === 'object' && segment in value) {
          value = value[segment];
        } else {
          value = undefined;
          break;
        }
      }

      if (value === undefined || value === null) return match;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
  }

  /**
   * Start the MCP server using the provided transport.
   *
   * @param {import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport | any} [transport] - Optional transport instance (defaults to stdio).
   * @returns {Promise<McpServer>} Resolves once the server is connected.
   */
  async start(transport) {
    await this.prepared;
    const t = transport || new StdioServerTransport();

    await this.server.connect(t);
    return this.server;
  }

  /**
   * Close the MCP server and underlying transport if available.
   *
   * @returns {Promise<void>}
   */
  async close() {
    try {
      await this.server.close();
    } catch (error) {
      debug('failed to close server', error);
    }
  }

  /**
   * Resolve package information if available in the root directory.
   *
   * @returns {Record<string, any> | undefined} Parsed package metadata, if present.
   */
  readPackageInfo() {
    try {
      const file = readFileSync(join(this.root, 'package.json'), 'utf8');
      return JSON.parse(file);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        debug('failed to read package info', error);
      }
      return undefined;
    }
  }

  /**
   * Create server information using package.json metadata when available.
   *
   * @returns {{ title: string, version: string, name: string }} Server metadata.
   */
  createServerInfo() {
    const serverConfig = this.config?.server ?? {};
    const fallbackName = serverConfig.name ?? this.packageInfo?.name ?? 'uprising';
    return {
      title: serverConfig.title ?? `${fallbackName} Command Node`,
      version: serverConfig.version ?? this.packageInfo?.version ?? '0.0.0',
      name: fallbackName
    };
  }

  /**
   * Load instructions.md from the root directory and render with template data.
   *
   * @returns {string | undefined} Rendered instruction text if present.
   */
  loadInstructions() {
    try {
      const instructions = readFileSync(join(this.root, 'instructions.md'), 'utf8');
      return this.template(instructions, {
        config: this.config,
        package: this.packageInfo ?? {},
        dir: this.root
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        debug('failed to load instructions', error);
      }
      return undefined;
    }
  }

  /**
   * Prepare the server by discovering tools, resources, and prompts from the filesystem.
   *
   * @returns {Promise<McpServer>} Resolves once the server is ready for use.
   */
  async ready() {
    await this.prepared;
    return this.server;
  }

  /**
   * Internal initialisation step that discovers and registers definitions.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _prepare() {
    const context = {
      server: this,
      config: this.config,
      root: this.root,
      package: this.packageInfo
    };

    const [tools, resources, prompts] = await Promise.all([
      discover(this.root, 'tools', context, (name, def, file) => normalize('tool', name, def, file), debug),
      discover(this.root, 'resources', context, (name, def, file, baseDir) => normalize('resource', name, def, file, baseDir), debug),
      discover(this.root, 'prompts', context, (name, def, file) => normalize('prompt', name, def, file), debug)
    ]);

    if (Object.keys(tools).length) this.tools(tools);
    if (Object.keys(resources).length) this.resources(resources);
    if (Object.keys(prompts).length) this.prompts(prompts);
  }
}

/**
 * Factory for creating a configured Uprising server instance.
 *
 * @param {string} dir - Working directory containing server definitions.
 * @param {Record<string, any>} [configuration={}] - Additional configuration passed to module factories.
 * @returns {Uprising} New Uprising instance ready for start().
 */
export function uprising(dir, configuration = {}) {
  debug('creating uprising instance at %s', dir);
  return new Uprising(dir, configuration);
}

/**
 * Convenience helper that creates and starts an Uprising instance.
 *
 * @param {string} dir - Working directory containing server definitions.
 * @param {Record<string, any>} [configuration={}] - Additional configuration passed to module factories.
 * @param {any} [transport] - Optional transport to attach.
 * @returns {Promise<Uprising>} Running uprising instance.
 */
export async function start(dir, configuration = {}, transport) {
  debug('starting uprising instance at %s', dir);
  const instance = new Uprising(dir, configuration);
  await instance.start(transport);
  return instance;
}

/**
 * Simple templating helper using double-curly placeholders (e.g. {{ year }}, {{ profile.name }}).
 *
 * @param {string} template - Raw template string containing placeholders.
 * @param {Record<string, any>} data - Data object used for substitution.
 * @returns {string} Rendered template string with placeholders replaced.
 */
export function template(template, data) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
    let value = data;
    for (const segment of key.split('.')) {
      if (value && typeof value === 'object' && segment in value) {
        value = value[segment];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined || value === null) return match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Retrieve a nested value using dotted path notation.
 *
 * @param {Record<string, any>} source - Object to search.
 * @param {string} pathExpression - Dotted path expression (e.g. `config.name`).
 * @returns {any} Resolved value or undefined when not found.
 */
function get(source, pathExpression) {
  const parts = pathExpression.split('.');
  let current = source;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export default Uprising;
