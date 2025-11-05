import { BaseLoader } from './base.js';
import { ToolBuilder } from '../builders/tool.js';
import { withScope } from '../runtime.js';
import { mergeSchemas, inferName, capitalize } from '../utils.js';

/**
 * Loader for tool definitions from MDX files.
 * @extends BaseLoader
 */
export class ToolLoader extends BaseLoader {
  /**
   * Load and prepare a tool definition from an MDX file.
   *
   * @param {string} file - Absolute path to the MDX file.
   * @param {Record<string, any>} context - Shared context passed to the renderer.
   * @returns {Promise<ToolLoader>} Initialized loader instance.
   */
  static async load(file, context) {
    const { data, content } = await BaseLoader.loadFile(file);
    const loader = new ToolLoader(file, data, content, context);
    await loader.prepare();
    return loader;
  }

  /**
   * Prepare the tool by compiling MDX and extracting schemas, handler, and examples.
   *
   * @returns {Promise<void>}
   */
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

  /**
   * Convert the loaded tool into an MCP-compatible definition.
   *
   * @returns {Object} Tool definition with name, title, description, schemas, exec function, and examples.
   * @throws {Error} If the tool is missing a handler function.
   */
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

