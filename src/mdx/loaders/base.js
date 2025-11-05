import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { RUNTIME, injectScope } from '../runtime.js';

/**
 * Shared base for MDX loaders handling file IO and compilation.
 */
export class BaseLoader {
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

