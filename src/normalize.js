import path from 'node:path';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { validate } from './validate.js';

/**
 * Normalise a definition into the structure required by the MCP server.
 *
 * @param {'tool' | 'prompt' | 'resource'} kind - Type of definition.
 * @param {string} name - Registration name.
 * @param {any} definition - Raw definition exported by the module.
 * @param {string} [file] - Optional source file path for better error messages.
 * @param {string} [baseDir] - Optional base directory for folder-based URI generation (resources only).
 * @returns {{ title: string, description: string, [key: string]: any } | undefined} Normalised definition.
 */
export function normalize(kind, name, definition, file, baseDir) {
  validate(kind, name, definition, file);

  const base = {
    title: typeof definition?.title === 'string' ? definition.title : name,
    description: typeof definition?.description === 'string' ? definition.description : '',
  };

  if (kind === 'tool') {
    return {
      ...base,
      inputSchema: definition?.inputSchema,
      exec: definition.exec
    };
  }

  if (kind === 'prompt') {
    return {
      ...base,
      argsSchema: definition?.argsSchema,
      exec: definition.exec
    };
  }

  if (kind === 'resource') {
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

    // If no template/uri provided, infer from folder structure (like .mdx files)
    if (!template && file && baseDir) {
      const inferredUri = inferResourceUriFromPath(file, baseDir);
      template = new ResourceTemplate(inferredUri, {
        list: typeof definition?.list === 'function' ? definition.list : undefined,
        complete: definition?.complete && typeof definition.complete === 'object' ? definition.complete : undefined
      });
    }

    if (!template) return undefined;

    return {
      ...base,
      template,
      read: definition.read
    };
  }
}

/**
 * Infer a resource URI from the file path relative to the base directory.
 * Follows Next.js-like folder structure conventions with dynamic segments.
 *
 * @param {string} file - Absolute path to the resource file.
 * @param {string} baseDir - Base directory for the resource type.
 * @returns {string} Inferred URI with resource:// scheme (e.g., "resource://api/users/{id}").
 */
function inferResourceUriFromPath(file, baseDir) {
  const relativePath = path.relative(baseDir, file);
  const withoutExt = relativePath.replace(/\.[^.]+$/u, '');
  const pathPart = withoutExt.split(path.sep).join('/');

  // Convert [param] to {param} for Next.js-style dynamic segments
  const withDynamicSegments = pathPart.replace(/\[([^\]]+)\]/g, '{$1}');

  return `resource://${withDynamicSegments}`;
}

