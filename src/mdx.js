import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

const RUNTIME = {
  Fragment: ({ children }) => children ?? null,
  jsx: createElement,
  jsxs: createElement,
};

const SENTINEL = Symbol('uprising-mdx-sentinel');

/**
 * MDX helper that produces MCP-compatible definitions for prompts, resources, and tools.
 */
export class Mdx {
  /**
   * Load a prompt definition from an MDX or Markdown file.
   *
   * @param {string} file - Absolute path to the MDX file.
   * @param {Record<string, any>} [context={}] - Shared context passed to render lifecycle.
   * @returns {Promise<Record<string, any>>}
   */
  static async prompt(file, context = {}) {
    const loader = await PromptLoader.load(file, context);
    return loader.toDefinition();
  }

  /**
   * Load a resource definition from an MDX or Markdown file.
   *
   * @param {string} file - Absolute path to the MDX file.
   * @param {Record<string, any>} [context={}] - Shared context passed to render lifecycle.
   * @returns {Promise<Record<string, any>>}
   */
  static async resource(file, context = {}) {
    const loader = await ResourceLoader.load(file, context);
    return loader.toDefinition();
  }

  /**
   * Load a tool definition from an MDX or Markdown file.
   *
   * @param {string} file - Absolute path to the MDX file.
   * @param {Record<string, any>} [context={}] - Shared context passed to render lifecycle.
   * @returns {Promise<Record<string, any>>}
   */
  static async tool(file, context = {}) {
    const loader = await ToolLoader.load(file, context);
    return loader.toDefinition();
  }
}

/**
 * Shared base for MDX loaders handling file IO and compilation.
 */
class BaseLoader {
  /**
   * @param {string} file - Absolute path to the source document.
   * @param {Record<string, any>} frontMatter - Parsed metadata block.
   * @param {string} body - Body content stripped from front matter.
   * @param {Record<string, any>} context - Ambient values shared with builders.
   */
  constructor(file, frontMatter, body, context) {
    this.file = file;
    this.frontMatter = frontMatter;
    this.body = body;
    this.context = context;
  }

  /**
   * Read and split a file into front matter and markdown content.
   *
   * @param {string} file - Source file path.
   * @returns {Promise<{ data: Record<string, any>, content: string }>}
   */
  static async loadFile(file) {
    const contents = await fs.readFile(file, 'utf8');
    const parsed = matter(contents);
    return { data: parsed.data ?? {}, content: parsed.content ?? '' };
  }

  /**
   * Compile MDX to a callable render function using a lightweight runtime.
   *
   * @returns {Promise<Function|null>} Render function or null when body empty.
   */
  async compile() {
    if (!this.body.trim()) {
      return null;
    }

    const compiled = await compile(this.body, {
      baseUrl: pathToFileURL(this.file).href,
      remarkPlugins: [remarkGfm],
      development: false,
      providerImportSource: undefined,
      useDynamicImport: false,
      outputFormat: 'function-body',
    });

    const code = injectScope(String(compiled));
    const createModule = new Function(code);
    const module = createModule(RUNTIME);
    return module.default;
  }
}

class PromptLoader extends BaseLoader {
  static async load(file, context) {
    const { data, content } = await BaseLoader.loadFile(file);
    const loader = new PromptLoader(file, data, content, context);
    await loader.prepare();
    return loader;
  }

  async prepare() {
    this.renderer = await this.compile();
    const blueprint = this.render({}, {});
    this.schema = mergeSchemas(this.frontMatter.argsSchema, blueprint.schema);
    this.resources = blueprint.resources;
  }

  /**
   * Render a prompt with mock args to collect schema and message blueprint.
   *
   * @param {Record<string, any>} args - Prompt arguments supplied by the caller.
   * @param {Record<string, any>} runtimeContext - Additional execution context.
   * @returns {{ messages: Array, schema: Record<string, any>, resources: Array }}
   */
  render(args, runtimeContext) {
    if (!this.renderer) {
      const text = this.body.trim();
      return PromptBuilder.renderInline(text, args);
    }

    return withScope({
      args,
      params: runtimeContext?.params ?? {},
      context: runtimeContext ?? {},
    }, () => {
      const builder = new PromptBuilder(this.frontMatter, {
        ...this.context,
        ...runtimeContext,
      });

      this.renderer({
        components: builder.components(),
        args,
        params: runtimeContext?.params ?? {},
        context: runtimeContext,
      });

      return builder.finalize(args, runtimeContext);
    });
  }

  toDefinition() {
    const name = this.frontMatter.name ?? inferName(this.file);
    const title = this.frontMatter.title ?? capitalize(name);
    const description = this.frontMatter.description ?? '';
    const annotations = this.frontMatter.annotations;
    const argsSchema = normalizeArgsSchema(this.schema);

    return {
      name,
      title,
      description,
      argsSchema,
      annotations,
      exec: async (args = {}, extra = {}) => {
        const output = this.render(args, { ...extra, args });
        const messages = output.messages.map((message) => ({
          role: message.role,
          name: message.name,
          content: { type: 'text', text: message.text },
        }));

        const response = { messages };
        if (output.resources.length) response.resources = output.resources;
        return response;
      },
    };
  }
}

class ResourceLoader extends BaseLoader {
  static async load(file, context) {
    const { data, content } = await BaseLoader.loadFile(file);
    const loader = new ResourceLoader(file, data, content, context);
    await loader.prepare();
    return loader;
  }

  async prepare() {
    this.renderer = await this.compile();
    const blueprint = this.render({ params: {} });
    this.mime = blueprint.mime ?? this.frontMatter.mime ?? 'text/markdown';
    this.listing = blueprint.listing ?? [];
  }

  /**
   * Render a resource to capture output shape and listings.
   *
   * @param {Record<string, any>} runtimeContext - Execution context with params.
   * @returns {{ text: string, mime?: string, listing?: Array }}
   */
  render(runtimeContext) {
    if (!this.renderer) {
      const text = this.body.trim();
      return ResourceBuilder.renderInline(text, this.frontMatter);
    }

    return withScope({
      args: runtimeContext?.args ?? {},
      params: runtimeContext?.params ?? {},
      context: runtimeContext ?? {},
    }, () => {
      const builder = new ResourceBuilder(this.frontMatter, {
        ...this.context,
        ...runtimeContext,
      });

      this.renderer({
        components: builder.components(),
        params: runtimeContext?.params ?? {},
        context: runtimeContext,
      });

      return builder.finalize(runtimeContext);
    });
  }

  toDefinition() {
    const name = this.frontMatter.name ?? inferName(this.file);
    const title = this.frontMatter.title ?? capitalize(name);
    const description = this.frontMatter.description ?? '';
    const uri = this.frontMatter.uri ?? this.frontMatter.template;
    const listing = Array.isArray(this.listing) ? this.listing : [];

    return {
      name,
      title,
      description,
      uri,
      template: this.frontMatter.template ?? uri,
      read: async ({ params = {} } = {}) => {
        const resolvedUri = params.uri ?? fillUri(uri, params);
        const context = { params, uri: resolvedUri };
        const value = this.render({ params });
        const text = interpolate(value.text, { params, context, config: this.context.config });

        return {
          contents: [
            {
              uri: resolvedUri,
              mimeType: value.mime ?? this.mime,
              text,
            },
          ],
        };
      },
      list: listing.length
        ? async () => ({
            resources: listing.map((item) => ({
              uri: fillUri(item.uri ?? uri, item.params ?? {}),
              name: item.name,
              title: item.title,
              description: item.description,
            })),
          })
        : undefined,
    };
  }
}

class ToolLoader extends BaseLoader {
  static async load(file, context) {
    const { data, content } = await BaseLoader.loadFile(file);
    const loader = new ToolLoader(file, data, content, context);
    await loader.prepare();
    return loader;
  }

  async prepare() {
    this.renderer = await this.compile();
    const blueprint = this.render({}, {});
    this.inputSchema = mergeSchemas(this.frontMatter.inputSchema, blueprint.inputSchema);
    this.outputSchema = mergeSchemas(this.frontMatter.outputSchema, blueprint.outputSchema);
    this.handler = blueprint.handler;
    this.examples = blueprint.examples;
  }

  /**
   * Render a tool to collect schemas, handler, and examples.
   *
   * @param {Record<string, any>} args - Tool args used during render.
   * @param {Record<string, any>} runtimeContext - Additional execution context.
   * @returns {{ inputSchema?: Record<string, any>, outputSchema?: Record<string, any>, handler?: Function, examples: Array }}
   */
  render(args, runtimeContext) {
    if (!this.renderer) {
      throw new Error(`Tool documents require MDX: ${this.file}`);
    }

    return withScope({
      args,
      params: runtimeContext?.params ?? {},
      context: runtimeContext ?? {},
    }, () => {
      const builder = new ToolBuilder(this.frontMatter, {
        ...this.context,
        ...runtimeContext,
      });

      this.renderer({
        components: builder.components(),
        args,
        params: runtimeContext?.params ?? {},
        context: runtimeContext,
      });

      return builder.finalize(runtimeContext);
    });
  }

  toDefinition() {
    const name = this.frontMatter.name ?? inferName(this.file);
    const title = this.frontMatter.title ?? capitalize(name);
    const description = this.frontMatter.description ?? '';
    const annotations = this.frontMatter.annotations;
    const handler = this.handler;

    if (typeof handler !== 'function') {
      throw new Error(`Tool ${name} is missing a <Handler> definition (${this.file}).`);
    }

    return {
      name,
      title,
      description,
      annotations,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      exec: async (args = {}, extra = {}) => handler(args, { ...extra, ...this.context }),
      examples: this.examples,
    };
  }
}

class PromptBuilder {
  /**
   * @param {Record<string, any>} frontMatter - Prompt metadata from front matter.
   * @param {Record<string, any>} context - Runtime values exposed to components.
   */
  constructor(frontMatter, context) {
    this.frontMatter = frontMatter;
    this.context = context;
    this.messages = [];
    this.schema = {};
    this.resources = [];
  }

  static renderInline(text) {
    const trimmed = text.trim();
    return {
      messages: trimmed ? [{ role: 'assistant', text: trimmed }] : [],
      schema: {},
      resources: [],
    };
  }

  components() {
    return {
      Message: (props) => this.message(props),
      Ask: (props) => this.ask(props),
      Resource: (props) => this.resourceLink(props),
    };
  }

  message({ role = 'assistant', name, children }) {
    const text = flatten(children);
    this.messages.push({ role, name, text });
    return null;
  }

  ask({ name, type = 'string', label, required, description, ...rest }) {
    if (!name) return null;
    this.schema[name] = {
      type,
      label,
      required: Boolean(required),
      description,
      ...rest,
    };
    return null;
  }

  resourceLink({ uri, mode = 'link' }) {
    if (!uri) return '';
    this.resources.push({ uri, mode });
    return mode === 'embed' ? `[${uri}]` : '';
  }

  finalize() {
    return {
      messages: this.messages,
      schema: this.schema,
      resources: this.resources,
    };
  }
}

class ResourceBuilder {
  /**
   * @param {Record<string, any>} frontMatter - Resource metadata.
   * @param {Record<string, any>} context - Runtime values exposed to components.
   */
  constructor(frontMatter, context) {
    this.frontMatter = frontMatter;
    this.context = context;
    this.body = '';
    this.mime = frontMatter.mime;
    this.listing = [];
  }

  static renderInline(text, frontMatter) {
    return {
      text,
      mime: frontMatter.mime ?? 'text/markdown',
      listing: [],
    };
  }

  components() {
    return {
      Body: (props) => this.bodyContent(props),
      Resource: (props) => this.reference(props),
      List: ({ children }) => children ?? null,
      Item: (props) => this.addItem(props),
      Meta: (props) => this.overrideMeta(props),
    };
  }

  bodyContent({ mime, children }) {
    this.mime = mime ?? this.mime ?? 'text/markdown';
    this.body = flatten(children);
    return null;
  }

  reference({ uri }) {
    if (!uri) return '';
    return `[${uri}]`;
  }

  addItem({ params = {}, uri, title, description, name }) {
    this.listing.push({ params, uri, title, description, name });
    return null;
  }

  overrideMeta({ title, description }) {
    if (title) this.frontMatter.title = title;
    if (description) this.frontMatter.description = description;
    return null;
  }

  finalize() {
    return {
      text: this.body,
      mime: this.mime,
      listing: this.listing,
    };
  }
}

class ToolBuilder {
  /**
   * @param {Record<string, any>} frontMatter - Tool metadata block.
   * @param {Record<string, any>} context - Runtime values exposed to components.
   */
  constructor(frontMatter, context) {
    this.frontMatter = frontMatter;
    this.context = context;
    this.inputs = {};
    this.outputs = {};
    this.handler = null;
    this.examples = [];
  }

  components() {
    return {
      Input: (props) => this.addInput(props),
      Output: (props) => this.addOutput(props),
      Handler: (props) => this.setHandler(props),
      Example: (props) => this.addExample(props),
      Call: (props) => ({ type: 'call', props }),
      Response: (props) => ({ type: 'response', props }),
    };
  }

  addInput({ name, ...rest }) {
    if (!name) return null;
    this.inputs[name] = { ...rest };
    return null;
  }

  addOutput({ name, ...rest }) {
    if (!name) return null;
    this.outputs[name] = { ...rest };
    return null;
  }

  setHandler({ children }) {
    const fn = Array.isArray(children)
      ? children.find((child) => typeof child === 'function')
      : typeof children === 'function'
        ? children
        : null;
    if (typeof fn === 'function') {
      this.handler = fn;
    }
    return null;
  }

  addExample({ title, children }) {
    const nodes = Array.isArray(children) ? children : [children];
    const example = { title, call: null, response: null };
    for (const node of nodes) {
      if (node?.type === 'call') example.call = node.props;
      if (node?.type === 'response') example.response = flatten(node.props?.children);
    }
    this.examples.push(example);
    return null;
  }

  finalize() {
    return {
      inputSchema: Object.keys(this.inputs).length ? buildInputSchema(this.inputs) : undefined,
      outputSchema: Object.keys(this.outputs).length ? buildOutputSchema(this.outputs) : undefined,
      handler: this.handler,
      examples: this.examples,
    };
  }
}

/**
 * Lightweight JSX factory that feeds component functions during MDX execution.
 *
 * @param {string|Function} type - Tag name or component function.
 * @param {Record<string, any>} [props={}] - Element props.
 * @param {string|number} [key] - Optional React-style key (ignored but preserved).
 * @returns {any} Component invocation result or neutral element descriptor.
 */
function createElement(type, props = {}, key) {
  const next = { ...props };
  if (key !== undefined && key !== null) {
    next.key = key;
  }

  if (typeof type === 'function') {
    return type(next);
  }

  return { type, props: next };
}

/**
 * Collapse nested MDX children into a plain string.
 *
 * @param {any} value - Arbitrary MDX child structure.
 * @returns {string} Flattened textual representation.
 */
function flatten(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'object') {
    if ('props' in value) {
      return flatten(value.props?.children);
    }
    if ('children' in value) {
      return flatten(value.children);
    }
  }
  return '';
}

/**
 * Merge declarative schema fragments, giving precedence to latter entries.
 *
 * @param {Record<string, any>|undefined} base - Schema from front matter.
 * @param {Record<string, any>|undefined} extra - Schema collected during render.
 * @returns {Record<string, any>|undefined} Combined schema or undefined.
 */
function mergeSchemas(base, extra) {
  if (!base && !extra) return undefined;
  return { ...(base ?? {}), ...(extra ?? {}) };
}

function normalizeArgsSchema(schema) {
  if (!schema || !Object.keys(schema).length) return undefined;
  const shape = {};
  for (const [key, descriptor] of Object.entries(schema)) {
    shape[key] = createZodSchema(descriptor, { allowDefault: true });
  }
  return shape;
}

function buildInputSchema(definitions) {
  const shape = {};
  for (const [key, config] of Object.entries(definitions)) {
    shape[key] = createZodSchema(config, { allowDefault: true });
  }
  return shape;
}

function buildOutputSchema(definitions) {
  const shape = {};
  for (const [key, config] of Object.entries(definitions)) {
    shape[key] = createZodSchema(config, { allowDefault: false });
  }
  return shape;
}

function createZodSchema(config = {}, options = {}) {
  if (config && typeof config.safeParse === 'function') {
    return config;
  }

  if (typeof config === 'string') {
    return createZodSchema({ type: config }, options);
  }

  const { type = 'string', items, minimum, maximum, enum: enumeration, default: def, required } = config;
  let schema;

  switch (type) {
    case 'integer':
      schema = z.number().int();
      break;
    case 'number':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      schema = z.array(createZodSchema(items ?? { type: 'string' }, options));
      break;
    case 'object':
      schema = z.record(z.any());
      break;
    default:
      schema = z.string();
      break;
  }

  if (typeof minimum === 'number' && typeof schema.min === 'function') {
    schema = schema.min(minimum);
  }

  if (typeof maximum === 'number' && typeof schema.max === 'function') {
    schema = schema.max(maximum);
  }

  if (Array.isArray(enumeration) && enumeration.length) {
    schema = z.enum(enumeration.map((value) => String(value)));
  }

  if (!required) {
    schema = schema.optional();
  }

  if (options.allowDefault && def !== undefined) {
    schema = schema.default(def);
  }

  return schema;
}

/**
 * Temporarily expose args/params/context on the global object for MDX evaluation.
 *
 * @param {{ args?: Record<string, any>, params?: Record<string, any>, context?: Record<string, any> }} scope - Values to expose.
 * @param {Function} fn - Callback executed while the scope is active.
 * @returns {any} Return value from the callback.
 */
function withScope(scope, fn) {
  const previousArgs = Object.prototype.hasOwnProperty.call(globalThis, 'args') ? globalThis.args : SENTINEL;
  const previousParams = Object.prototype.hasOwnProperty.call(globalThis, 'params') ? globalThis.params : SENTINEL;
  const previousContext = Object.prototype.hasOwnProperty.call(globalThis, 'context') ? globalThis.context : SENTINEL;

  globalThis.args = scope.args ?? {};
  globalThis.params = scope.params ?? {};
  globalThis.context = scope.context ?? {};

  try {
    return fn();
  } finally {
    if (previousArgs === SENTINEL) delete globalThis.args;
    else globalThis.args = previousArgs;

    if (previousParams === SENTINEL) delete globalThis.params;
    else globalThis.params = previousParams;

    if (previousContext === SENTINEL) delete globalThis.context;
    else globalThis.context = previousContext;
  }
}

/**
 * Injects scoped arg helpers into compiled MDX so components can access args/params/context.
 *
 * @param {string} code - Generated function body from `@mdx-js/mdx`.
 * @returns {string} Patched code string.
 */
function injectScope(code) {
  const needle = 'function _createMdxContent(props) {\n';
  if (code.includes(needle)) {
    const injection =
      'function _createMdxContent(props) {\n' +
      '  const args = props.args ?? props.context?.args ?? {};\n' +
      '  const params = props.params ?? props.context?.params ?? {};\n' +
      '  const context = props.context ?? {};\n';
    return code.replace(needle, injection);
  }
  return code;
}

function inferName(file) {
  return path.basename(file, path.extname(file));
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fillUri(template, params = {}) {
  if (!template) return undefined;
  return template.replace(/\{([^}]+)}/g, (_, key) => {
    const value = get(params, key.trim());
    return value === undefined ? `{${key}}` : value;
  });
}

function interpolate(template, scope) {
  if (!template) return '';
  return template.replace(/\{\{\s*([^}]+?)\s*}}/g, (_, expr) => {
    const value = get(scope, expr.trim());
    return value === undefined || value === null ? '' : String(value);
  });
}

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
