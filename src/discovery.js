import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Mdx } from './mdx.js';

export const SUPPORTED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.mdx']);

/**
 * Discover definitions for tools, resources, or prompts within a directory.
 *
 * @param {string} root - Server root directory.
 * @param {'tools' | 'resources' | 'prompts'} kind - Discovery bucket.
 * @param {Record<string, any>} context - Context passed to factories/MDX renderers.
 * @param {(name: string, definition: any) => any} normalizer - Converts raw exports into MCP registrations.
 * @param {(message: string, ...args: any[]) => void} [log] - Optional debug logger.
 * @returns {Promise<Record<string, any>>}
 */
export async function discover(root, kind, context, normalizer, log) {
  const baseDir = path.join(root, kind);
  const files = await scan(baseDir);
  const result = {};

  for (const file of files) {
    try {
      const ext = path.extname(file).toLowerCase();

      if (ext === '.md' || ext === '.mdx') {
        const definition = await fromMdx(file, context, kind);
        if (!definition) continue;

        const baseName = definition.name ?? label(baseDir, file);
        const normalized = normalizer(baseName, definition);
        if (!normalized) continue;
        const name = normalized.name ?? baseName;
        result[name] = { ...normalized, name };
        continue;
      }

      const mod = await load(file);
      const definitions = await pick(mod, context, kind);
      if (!definitions) continue;

      const items = Array.isArray(definitions) ? definitions : [definitions];
      for (const definition of items) {
        const candidateName = String(definition?.name ?? label(baseDir, file));
        const normalized = normalizer(candidateName, definition);
        if (!normalized) continue;
        const name = normalized.name ?? candidateName;
        result[name] = { ...normalized, name };
      }
    } catch (error) {
      log?.('failed to load %s from %s', kind.slice(0, -1), file, error);
    }
  }

  return result;
}

/**
 * Recursively collect discoverable files from a directory.
 *
 * @param {string} directory - Directory to scan.
 * @returns {Promise<string[]>} Sorted list of absolute file paths.
 */
async function scan(directory) {
  try {
    const dirStat = await fs.stat(directory);
    if (!dirStat.isDirectory()) return [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const nested = await scan(fullPath);
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

  return files.sort();
}

/**
 * Import a module (JSON or ESM) from disk.
 *
 * @param {string} file - Absolute file path.
 * @returns {Promise<any>} Module namespace or parsed JSON object.
 */
async function load(file) {
  const idx = file.lastIndexOf('.');
  const ext = idx === -1 ? '' : file.slice(idx).toLowerCase();
  if (ext === '.json') {
    const contents = await fs.readFile(file, 'utf8');
    return JSON.parse(contents);
  }

  return import(pathToFileURL(file).href);
}

/**
 * Resolve the export representing a definition from a module.
 *
 * @param {any} module - Imported module namespace.
 * @param {Record<string, any>} context - Context passed to factory functions.
 * @param {'tools' | 'resources' | 'prompts'} kind - Discovery bucket type.
 * @returns {Promise<any>} Resolved definition(s) or null.
 */
async function pick(module, context, kind) {
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
 * Load a definition using the MDX loader based on the discovery kind.
 *
 * @param {string} file - MDX file path.
 * @param {Record<string, any>} context - Context passed to the MDX renderer.
 * @param {'tools' | 'resources' | 'prompts'} kind - Discovery bucket type.
 * @returns {Promise<any>} Definition object or null when unsupported.
 */
async function fromMdx(file, context, kind) {
  if (kind === 'prompts') {
    return await Mdx.prompt(file, context);
  }
  if (kind === 'resources') {
    return await Mdx.resource(file, context);
  }
  if (kind === 'tools') {
    return await Mdx.tool(file, context);
  }
  return null;
}

/**
 * Infer a registration name from a file path relative to the discovery directory.
 *
 * @param {string} baseDir - Base discovery directory.
 * @param {string} file - Absolute file path.
 * @returns {string} Inferred registration name.
 */
function label(baseDir, file) {
  const relativePath = path.relative(baseDir, file);
  const withoutExt = relativePath.replace(/\.[^.]+$/u, '');
  return withoutExt.split(path.sep).join('-');
}
