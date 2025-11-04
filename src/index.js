import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import diagnostics from 'diagnostics';
import { readFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const debug = diagnostics('uprising:mcp');

const SUPPORTED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json']);

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
      this.discover('tools', context, normalizeTool),
      this.discover('resources', context, normalizeResource),
      this.discover('prompts', context, normalizePrompt)
    ]);

    if (Object.keys(tools).length) this.tools(tools);
    if (Object.keys(resources).length) this.resources(resources);
    if (Object.keys(prompts).length) this.prompts(prompts);
  }

  /**
   * Discover definitions within the given directory.
   *
   * @param {'tools' | 'resources' | 'prompts'} kind - Discovery bucket.
   * @param {Record<string, any>} context - Context passed to discovered modules.
   * @param {(name: string, definition: any) => any} normalizer - Normalisation strategy for registrations.
   * @returns {Promise<Record<string, any>>} Normalised definitions keyed by registration name.
   */
  async discover(kind, context, normalizer) {
    const baseDir = join(this.root, kind);
    const files = await collectFiles(baseDir);
    const result = {};

    for (const file of files) {
      try {
        const mod = await importModule(file);
        const definitions = await resolveDefinition(mod, context, kind);
        if (!definitions) continue;

        const items = Array.isArray(definitions) ? definitions : [definitions];
        for (const definition of items) {
          const name = String(definition?.name ?? inferName(baseDir, file));
          const normalized = normalizer(name, definition);
          if (!normalized) continue;
          result[name] = normalized;
        }
      } catch (error) {
        debug('failed to load %s from %s', kind.slice(0, -1), file, error);
      }
    }

    return result;
  }
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
 * Convenience helper that creates and starts an Uprising instance.
 *
 * @param {string} dir - Working directory containing server definitions.
 * @param {Record<string, any>} [configuration={}] - Additional configuration passed to module factories.
 * @param {any} [transport] - Optional transport to attach; defaults to stdio when omitted.
 * @returns {Promise<Uprising>} Running Uprising instance.
 */
export async function start(dir, configuration = {}, transport) {
  debug('starting uprising instance at %s', dir);
  const instance = new Uprising(dir, configuration);
  await instance.start(transport);
  return instance;
}

export default Uprising;

/**
 * Recursively collect all supported module files within a directory.
 *
 * @param {string} baseDir - Directory containing candidate modules.
 * @returns {Promise<string[]>} Sorted list of absolute file paths.
 */
async function collectFiles(baseDir) {
  try {
    const dirStat = await fs.stat(baseDir);
    if (!dirStat.isDirectory()) return [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      debug('failed to stat %s', baseDir, error);
    }
    return [];
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = join(baseDir, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectFiles(fullPath);
      files.push(...nested);
      continue;
    }

    if (!entry.isFile()) continue;
    const idx = entry.name.lastIndexOf('.');
    if (idx === -1) continue;
    const ext = entry.name.slice(idx).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    files.push(fullPath);
  }

  return files;
}

/**
 * Import a module from disk, supporting both JSON and ESM sources.
 *
 * @param {string} file - Absolute file path to import.
 * @returns {Promise<any>} Module exports or parsed JSON data.
 */
async function importModule(file) {
  const idx = file.lastIndexOf('.');
  const ext = idx === -1 ? '' : file.slice(idx).toLowerCase();
  if (ext === '.json') {
    const contents = await fs.readFile(file, 'utf8');
    return JSON.parse(contents);
  }

  return import(pathToFileURL(file).href);
}

/**
 * Resolve a candidate definition from a module export.
 *
 * @param {any} module - Module namespace or parsed object.
 * @param {Record<string, any>} context - Context passed to factory functions.
 * @param {'tools' | 'resources' | 'prompts'} kind - Discovery bucket determining fallback keys.
 * @returns {Promise<any>} Resolved definition or collection of definitions.
 */
async function resolveDefinition(module, context, kind) {
  const singular = kind.endsWith('s') ? kind.slice(0, -1) : kind;
  const candidate = module?.default
    ?? module?.[singular]
    ?? module?.[kind]
    ?? module?.create
    ?? module;

  if (typeof candidate === 'function') {
    return await candidate(context);
  }

  if (candidate && typeof candidate === 'object' && typeof candidate.create === 'function') {
    return await candidate.create(context);
  }

  return candidate;
}

/**
 * Infer a registration name from a file path relative to the discovery directory.
 *
 * @param {string} baseDir - Discovery base directory.
 * @param {string} file - Absolute file path.
 * @returns {string} Inferred registration name.
 */
function inferName(baseDir, file) {
  const relativePath = relative(baseDir, file);
  const withoutExt = relativePath.replace(/\.[^.]+$/u, '');
  return withoutExt.split(sep).join('-');
}

/**
 * Normalise a tool definition into the structure required by the MCP server.
 *
 * @param {string} name - Registration name for the tool.
 * @param {any} definition - Raw definition exported by the module.
 * @returns {{ title: string, description: string, inputSchema?: unknown, exec: Function } | undefined} Normalised definition.
 */
function normalizeTool(name, definition) {
  const exec = definition?.exec ?? definition?.handler ?? definition?.run;
  if (typeof exec !== 'function') return undefined;

  return {
    title: typeof definition?.title === 'string' ? definition.title : name,
    description: typeof definition?.description === 'string' ? definition.description : '',
    inputSchema: definition?.inputSchema,
    exec
  };
}

/**
 * Normalise a resource definition into the structure required by the MCP server.
 *
 * @param {string} name - Registration name for the resource.
 * @param {any} definition - Raw definition exported by the module.
 * @returns {{ title: string, description: string, template: ResourceTemplate, read: Function } | undefined} Normalised definition.
 */
function normalizeResource(name, definition) {
  const read = definition?.read ?? definition?.exec ?? definition?.handler;
  let template = definition?.template ?? null;

  if (template && typeof template === 'string') {
    template = new ResourceTemplate(template, {
      list: typeof definition?.list === 'function' ? definition.list : undefined,
      complete: definition?.complete && typeof definition.complete === 'object' ? definition.complete : undefined
    });
  }

  if (!template && typeof definition?.uri === 'string') {
    template = new ResourceTemplate(definition.uri, {
      list: typeof definition?.list === 'function' ? definition.list : undefined,
      complete: definition?.complete && typeof definition.complete === 'object' ? definition.complete : undefined
    });
  }

  if (typeof read !== 'function' || !template) return undefined;

  return {
    title: typeof definition?.title === 'string' ? definition.title : name,
    description: typeof definition?.description === 'string' ? definition.description : '',
    template,
    read
  };
}

/**
 * Normalise a prompt definition into the structure required by the MCP server.
 *
 * @param {string} name - Registration name for the prompt.
 * @param {any} definition - Raw definition exported by the module.
 * @returns {{ title: string, description: string, argsSchema?: unknown, exec: Function } | undefined} Normalised definition.
 */
function normalizePrompt(name, definition) {
  const exec = definition?.exec ?? definition?.handler ?? definition?.run;
  if (typeof exec !== 'function') return undefined;

  return {
    title: typeof definition?.title === 'string' ? definition.title : name,
    description: typeof definition?.description === 'string' ? definition.description : '',
    argsSchema: definition?.argsSchema,
    exec
  };
}
