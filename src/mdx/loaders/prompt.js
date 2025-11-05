import { BaseLoader } from './base.js';
import { PromptBuilder } from '../builders/prompt.js';
import { withScope } from '../runtime.js';
import { mergeSchemas, normalizeArgsSchema, inferName, capitalize, interpolate } from '../utils.js';

/**
 * Loader for prompt definitions from MDX files.
 * @extends BaseLoader
 */
export class PromptLoader extends BaseLoader {
  /**
   * Load and prepare a prompt definition from an MDX file.
   *
   * @param {string} file - Absolute path to the MDX file.
   * @param {Record<string, any>} context - Shared context passed to the renderer.
   * @returns {Promise<PromptLoader>} Initialized loader instance.
   */
  static async load(file, context) {
    const { data, content } = await BaseLoader.loadFile(file);
    const loader = new PromptLoader(file, data, content, context);
    await loader.prepare();
    return loader;
  }

  /**
   * Prepare the prompt by compiling MDX and extracting schema and resources.
   *
   * @returns {Promise<void>}
   */
  async prepare() {
    // Only compile .mdx files; .md files are treated as plain markdown with template syntax
    const isMdx = this.file.endsWith('.mdx');
    this.renderer = isMdx ? await this.compile() : null;
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

  /**
   * Convert the loaded prompt into an MCP-compatible definition.
   *
   * @returns {Object} Prompt definition with name, title, description, argsSchema, and exec function.
   */
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
          content: {
            type: 'text',
            text: interpolate(message.text, {
              ...this.frontMatter,
              args,
              params: extra.params ?? {},
              context: extra,
              config: this.context.config,
              package: this.context.package ?? {}
            })
          },
        }));

        const response = { messages };
        if (output.resources.length) response.resources = output.resources;
        return response;
      },
    };
  }
}

