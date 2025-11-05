#!/usr/bin/env node
import { Command } from 'commander';
import diagnostics from 'diagnostics';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { start } from '../src/index.js';
import pkg from '../package.json' with { type: 'json' };

const debug = diagnostics('uprising:cli');

/**
 * Command action executed after CLI parsing.
 *
 * @param {string} directory - Directory argument supplied by the user.
 * @param {Record<string, any>} options - Parsed option values.
 * @returns {Promise<void>}
 */
async function run(dirInput, opts) {
  const root = resolve(dirInput);
  let config = {};

  try {
    const resolved = resolve(opts.config ?? root, 'package.json');

    if (resolved.endsWith('.json')) {
      config = JSON.parse(await readFile(resolved, 'utf8'));
    } else {
      const module = await import(pathToFileURL(resolved).href);
      config = module.default ?? module;
    }
  } catch (e) {
    debug('failed to load config:', e);
  }

  try {
    debug(`starting server from ${root} with config`, config);
    const uprising = await start(root, config);

    trap(async (signal) => {
      debug('received %s, shutting down', signal);
      try {
        await uprising.close();
      } finally {
        process.exit(0);
      }
    });
  } catch (error) {
    console.error('[uprising] failed to start:', error?.message ?? error);
    process.exit(1);
  }
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

/**
 * Entry point for the CLI.
 *
 * @param {string[]} argv - Raw argv values (defaults to process.argv).
 * @returns {Promise<void>}
 */
(async function main(argv = process.argv) {
  const program = new Command();

  program
    .name('uprising')
    .description('Start an Uprising MCP server from a directory tree')
    .version(pkg.version ?? '0.0.0', '-V, --version', 'output the current version')
    .argument('[directory]', 'directory containing tools/resources/prompts folders', '.')
    .option('-c, --config <path>', 'path to a JSON or ESM configuration file')
    .action(run);

  await program.parseAsync(argv);
})();
