import { PromptLoader } from './loaders/prompt.js';
import { ResourceLoader } from './loaders/resource.js';
import { ToolLoader } from './loaders/tool.js';

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

