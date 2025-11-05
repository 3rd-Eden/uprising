/**
 * Check if an object looks like a JSON Schema (plain object with 'type', 'properties', etc.).
 *
 * @param {any} value - Value to check.
 * @returns {boolean} True if this looks like JSON Schema.
 */
function isJsonSchema(value) {
  if (!value || typeof value !== 'object') return false;

  // Common JSON Schema keywords that indicate this is JSON Schema, not a Zod schema object
  const jsonSchemaKeys = ['type', 'properties', 'required', 'items', 'additionalProperties', '$schema'];
  const keys = Object.keys(value);

  return jsonSchemaKeys.some(key => keys.includes(key));
}

/**
 * Validate a definition and throw if invalid.
 *
 * @param {'tool' | 'prompt' | 'resource'} kind - Type of definition.
 * @param {string} name - Registration name.
 * @param {any} definition - Definition object.
 * @param {string} [file] - Optional source file path for better error messages.
 * @throws {Error} If the definition is invalid.
 */
export function validate(kind, name, definition, file) {
  const context = file ? ` in ${file}` : '';
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);

  if (kind === 'tool' || kind === 'prompt') {
    // Tools and prompts must have exec
    if (typeof definition?.exec !== 'function') {
      throw new Error(
        `${kindLabel} "${name}"${context} must have an 'exec' function.`
      );
    }

    // Validate schema if present
    const schemaKey = kind === 'tool' ? 'inputSchema' : 'argsSchema';
    if (definition?.[schemaKey] && isJsonSchema(definition[schemaKey])) {
      throw new Error(
        `${kindLabel} "${name}"${context} uses JSON Schema format for '${schemaKey}', but Uprising expects Zod schemas.\n` +
        `  Expected: { name: z.string(), ... }\n` +
        `  Got: { type: 'object', properties: { ... }, ... }\n` +
        `  Fix: Import 'zod' and use Zod schema objects.`
      );
    }
  } else if (kind === 'resource') {
    // Resources must have read
    if (typeof definition?.read !== 'function') {
      throw new Error(
        `Resource "${name}"${context} must have a 'read' function.`
      );
    }
  }
}

