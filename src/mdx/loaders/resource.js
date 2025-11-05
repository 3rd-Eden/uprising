import path from 'node:path';
import { BaseLoader } from './base.js';
import { ResourceBuilder } from '../builders/resource.js';
import { withScope } from '../runtime.js';
import { fillUri, interpolate, inferResourceUri, capitalize } from '../utils.js';

/**
 * Loader for resource definitions from MDX files.
 * @extends BaseLoader
 */
export class ResourceLoader extends BaseLoader {
  /**
   * Load and prepare a resource definition from an MDX file.
   *
   * @param {string} file - Absolute path to the MDX file.
   * @param {Record<string, any>} context - Shared context passed to the renderer.
   * @returns {Promise<ResourceLoader>} Initialized loader instance.
   */
  static async load(file, context) {
    const { data, content } = await BaseLoader.loadFile(file);
    const loader = new ResourceLoader(file, data, content, context);
    await loader.prepare();
    return loader;
  }

  /**
   * Prepare the resource by compiling MDX and extracting MIME type and listings.
   *
   * @returns {Promise<void>}
   */
  async prepare() {
    // Only compile .mdx files; .md files are treated as plain markdown with template syntax
    const isMdx = this.file.endsWith('.mdx');
    this.renderer = isMdx ? await this.compile() : null;
    const blueprint = this.render({ params: {} });
    this.mime = blueprint.mime ?? this.frontMatter.mime ?? 'text/markdown';
    this.listing = blueprint.listing ?? [];
  }

  /**
   * Infer a name from the file path, respecting folder structure when baseDir is available.
   *
   * @param {string} file - Absolute path to the file.
   * @param {string} [baseDir] - Base directory for the resource type.
   * @returns {string} Inferred name.
   */
  inferResourceName(file, baseDir) {
    if (!baseDir) {
      return path.basename(file, path.extname(file));
    }

    const relativePath = path.relative(baseDir, file);
    const withoutExt = relativePath.replace(/\.[^.]+$/u, '');
    return withoutExt.split(path.sep).join('-');
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

  /**
   * Convert the loaded resource into an MCP-compatible definition.
   *
   * @returns {Object} Resource definition with name, title, description, uri, template, read function, and optional list function.
   */
  toDefinition() {
    const name = this.frontMatter.name ?? this.inferResourceName(this.file, this.context.__baseDir);
    const title = this.frontMatter.title ?? capitalize(name);
    const description = this.frontMatter.description ?? '';
    const uri = this.frontMatter.uri ?? this.frontMatter.template ?? inferResourceUri(this.file, this.context.__baseDir);
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
        const text = interpolate(value.text, {
          ...this.frontMatter,
          params,
          context,
          config: this.context.config,
          package: this.context.package ?? {}
        });

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
            resources: listing.map((item, index) => {
              const itemUri = fillUri(item.uri ?? uri, item.params ?? {});
              return {
                uri: itemUri,
                name: item.name ?? `${name}-${index}`,
                title: item.title,
                description: item.description,
              };
            }),
          })
        : undefined,
    };
  }
}

