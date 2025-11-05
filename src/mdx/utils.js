import path from 'node:path';
import { z } from 'zod';

/**
 * Infer a name from a file path using the basename without extension.
 *
 * @param {string} file - Absolute path to the file.
 * @returns {string} Inferred name.
 */
export function inferName(file) {
  return path.basename(file, path.extname(file));
}

/**
 * Capitalize the first character of a string.
 *
 * @param {string} value - String to capitalize.
 * @returns {string} Capitalized string.
 */
export function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Infer a resource URI from the file path relative to the base directory.
 * Follows Next.js-like folder structure conventions with dynamic segments.
 *
 * @param {string} file - Absolute path to the resource file.
 * @param {string} [baseDir] - Base directory for the resource type (e.g., /path/to/resources).
 * @returns {string} Inferred URI using forward slashes with resource:// scheme (e.g., "resource://frontend/javascript" or "resource://api/users/{id}").
 */
export function inferResourceUri(file, baseDir) {
  if (!baseDir) {
    // Fallback to just the filename without extension if baseDir is not provided
    const basename = path.basename(file, path.extname(file));
    return `resource://${convertDynamicSegments(basename)}`;
  }

  // Get the relative path from the base directory
  const relativePath = path.relative(baseDir, file);

  // Remove the file extension
  const withoutExt = relativePath.replace(/\.[^.]+$/u, '');

  // Convert platform-specific path separators to forward slashes
  const pathPart = withoutExt.split(path.sep).join('/');

  // Convert [param] to {param} for Next.js-style dynamic segments
  const withDynamicSegments = convertDynamicSegments(pathPart);

  // Add a URI scheme to make it a valid URI
  return `resource://${withDynamicSegments}`;
}

/**
 * Convert Next.js-style dynamic segments [param] to URI template parameters {param}.
 *
 * @param {string} pathPart - Path segment or full path.
 * @returns {string} Path with [param] converted to {param}.
 */
function convertDynamicSegments(pathPart) {
  return pathPart.replace(/\[([^\]]+)\]/g, '{$1}');
}

/**
 * Fill a URI template by replacing {param} placeholders with values.
 *
 * @param {string|undefined} template - URI template with {key} placeholders.
 * @param {Record<string, any>} [params={}] - Parameter values for substitution.
 * @returns {string|undefined} Resolved URI or undefined if template is empty.
 */
export function fillUri(template, params = {}) {
  if (!template) return undefined;
  return template.replace(/\{([^}]+)}/g, (_, key) => {
    const value = get(params, key.trim());
    return value === undefined ? `{${key}}` : value;
  });
}

/**
 * Interpolate a template string by replacing {{ expression }} placeholders.
 *
 * @param {string} template - Template string with {{ expr }} placeholders.
 * @param {Record<string, any>} scope - Scope object for expression evaluation.
 * @returns {string} Interpolated string.
 */
export function interpolate(template, scope) {
  if (!template) return '';
  return template.replace(/\{\{\s*([^}]+?)\s*}}/g, (_, expr) => {
    const value = get(scope, expr.trim());
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Get a nested property value from an object using dot notation.
 *
 * @param {Record<string, any>} source - Source object.
 * @param {string} pathExpression - Dot-separated property path (e.g., 'user.name').
 * @returns {any} Property value or undefined if not found.
 */
export function get(source, pathExpression) {
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

/**
 * Merge declarative schema fragments, giving precedence to latter entries.
 *
 * @param {Record<string, any>|undefined} base - Schema from front matter.
 * @param {Record<string, any>|undefined} extra - Schema collected during render.
 * @returns {Record<string, any>|undefined} Combined schema or undefined.
 */
export function mergeSchemas(base, extra) {
  if (!base && !extra) return undefined;
  return { ...(base ?? {}), ...(extra ?? {}) };
}

/**
 * Normalize a prompt arguments schema into Zod validators.
 *
 * @param {Record<string, any>} schema - Raw schema definitions.
 * @returns {Record<string, any>|undefined} Normalized Zod schema or undefined if empty.
 */
export function normalizeArgsSchema(schema) {
  if (!schema || !Object.keys(schema).length) return undefined;
  const shape = {};
  for (const [key, descriptor] of Object.entries(schema)) {
    shape[key] = createZodSchema(descriptor, { allowDefault: true });
  }
  return shape;
}

/**
 * Build an input schema for tool parameters using Zod validators.
 *
 * @param {Record<string, any>} definitions - Input parameter definitions.
 * @returns {Record<string, any>} Zod schema shape for inputs.
 */
export function buildInputSchema(definitions) {
  const shape = {};
  for (const [key, config] of Object.entries(definitions)) {
    shape[key] = createZodSchema(config, { allowDefault: true });
  }
  return shape;
}

/**
 * Build an output schema for tool results using Zod validators.
 *
 * @param {Record<string, any>} definitions - Output field definitions.
 * @returns {Record<string, any>} Zod schema shape for outputs.
 */
export function buildOutputSchema(definitions) {
  const shape = {};
  for (const [key, config] of Object.entries(definitions)) {
    shape[key] = createZodSchema(config, { allowDefault: false });
  }
  return shape;
}

/**
 * Create a Zod validator from a schema configuration object.
 *
 * @param {Object|string} [config={}] - Schema configuration or type string.
 * @param {string} [config.type='string'] - Data type (string, number, integer, boolean, array, object).
 * @param {any} [config.items] - Array item schema (for array type).
 * @param {number} [config.minimum] - Minimum value/length.
 * @param {number} [config.maximum] - Maximum value/length.
 * @param {any[]} [config.enum] - Enumeration values.
 * @param {any} [config.default] - Default value.
 * @param {boolean} [config.required] - Whether the field is required.
 * @param {Object} [options={}] - Schema options.
 * @param {boolean} [options.allowDefault] - Whether to allow default values.
 * @returns {Object} Zod validator instance.
 */
export function createZodSchema(config = {}, options = {}) {
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

