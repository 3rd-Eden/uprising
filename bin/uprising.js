#!/usr/bin/env node
import { Command } from 'commander';
import diagnostics from 'diagnostics';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { start } from '../src/index.js';

const debug = diagnostics('uprising:cli');

/**
 * Entry point for the CLI.
 *
 * @param {string[]} argv - Raw argv values (defaults to process.argv).
 * @returns {Promise<void>}
 */
async function main(argv = process.argv) {
  const program = new Command();
  const pkg = await readPkg();

  program
    .name('uprising')
    .description('Start an Uprising MCP server from a directory tree')
    .version(pkg.version ?? '0.0.0', '-V, --version', 'output the current version')
    .argument('[directory]', 'directory containing tools/resources/prompts folders', '.')
    .option('-c, --config <path>', 'path to a JSON or ESM configuration file')
    .option('-t, --transport <name>', 'transport to use (currently only "stdio")', 'stdio')
    .option('-d, --diagnostics <names>', 'enable diagnostics namespaces (comma separated)')
    .action(run);

  await program.parseAsync(argv);
}

/**
 * Command action executed after CLI parsing.
 *
 * @param {string} directory - Directory argument supplied by the user.
 * @param {Record<string, any>} options - Parsed option values.
 * @returns {Promise<void>}
 */
async function run(dirInput, opts) {
  const root = resolve(dirInput);
  const transport = opts.transport ?? 'stdio';

  if (transport !== 'stdio') {
    console.error(`[uprising] unsupported transport "${transport}". Only "stdio" is currently available.`);
    process.exit(1);
  }

  if (opts.diagnostics) {
    const existing = process.env.DEBUG;
    process.env.DEBUG = existing ? `${existing},${opts.diagnostics}` : opts.diagnostics;
  }

  let cfg = {};
  if (opts.config) {
    try {
      cfg = await readCfg(opts.config);
    } catch (error) {
      console.error(`[uprising] failed to load config "${opts.config}":`, error?.message ?? error);
      debug(error);
      process.exit(1);
    }
  }

  try {
    console.log(`[uprising] starting server from ${root}`);
    const uprising = await start(root, cfg);
    debug('server started');

    trap(async (signal) => {
      debug('received %s, shutting down', signal);
      try {
        await uprising.close();
      } finally {
        process.exit(0);
      }
    });

    process.stdin.resume();
  } catch (error) {
    console.error('[uprising] failed to start:', error?.message ?? error);
    debug(error);
    process.exit(1);
  }
}

/**
 * Load package.json for metadata such as version.
 *
 * @returns {Promise<Record<string, any>>}
 */
async function readPkg() {
  const pkgUrl = new URL('../package.json', import.meta.url);
  return JSON.parse(await readFile(pkgUrl, 'utf8'));
}

/**
 * Load configuration from JSON or ESM/TS module.
 *
 * @param {string} inputPath - Path supplied via CLI.
 * @returns {Promise<Record<string, any>>}
 */
async function readCfg(inputPath) {
  const resolved = resolve(inputPath);
  if (resolved.endsWith('.json')) {
    return JSON.parse(await readFile(resolved, 'utf8'));
  }

  const module = await import(pathToFileURL(resolved).href);
  return module.default ?? module;
}

/**
 * Attach signal handlers to gracefully stop the MCP server.
 *
 * @param {(signal: NodeJS.Signals) => Promise<void>} handler - Callback invoked on termination signals.
 */
function trap(handler) {
  /** @type {(signal: NodeJS.Signals) => Promise<void>} */
  const wrapper = async (signal) => {
    try {
      await handler(signal);
    } catch (error) {
      console.error('[uprising] error during shutdown:', error?.message ?? error);
      debug(error);
      process.exit(1);
    }
  };

  process.on('SIGINT', wrapper);
  process.on('SIGTERM', wrapper);
}

main();
