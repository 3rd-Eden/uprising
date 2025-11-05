/**
 * MDX runtime components and helpers for compilation and rendering.
 */

const SENTINEL = Symbol('uprising-mdx-sentinel');

/**
 * Lightweight JSX factory that feeds component functions during MDX execution.
 *
 * @param {string|Function} type - Tag name or component function.
 * @param {Record<string, any>} [props={}] - Element props.
 * @param {string|number} [key] - Optional React-style key (ignored but preserved).
 * @returns {any} Component invocation result or neutral element descriptor.
 */
export function createElement(type, props = {}, key) {
  const next = { ...props };
  if (key !== undefined && key !== null) {
    next.key = key;
  }

  if (typeof type === 'function') {
    return type(next);
  }

  return { type, props: next };
}

/**
 * Collapse nested MDX children into a plain string.
 *
 * @param {any} value - Arbitrary MDX child structure.
 * @returns {string} Flattened textual representation.
 */
export function flatten(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'object') {
    if ('props' in value) {
      return flatten(value.props?.children);
    }
    if ('children' in value) {
      return flatten(value.children);
    }
  }
  return '';
}

/**
 * Temporarily expose args/params/context on the global object for MDX evaluation.
 *
 * @param {{ args?: Record<string, any>, params?: Record<string, any>, context?: Record<string, any> }} scope - Values to expose.
 * @param {Function} fn - Callback executed while the scope is active.
 * @returns {any} Return value from the callback.
 */
export function withScope(scope, fn) {
  const previousArgs = Object.prototype.hasOwnProperty.call(globalThis, 'args') ? globalThis.args : SENTINEL;
  const previousParams = Object.prototype.hasOwnProperty.call(globalThis, 'params') ? globalThis.params : SENTINEL;
  const previousContext = Object.prototype.hasOwnProperty.call(globalThis, 'context') ? globalThis.context : SENTINEL;

  globalThis.args = scope.args ?? {};
  globalThis.params = scope.params ?? {};
  globalThis.context = scope.context ?? {};

  try {
    return fn();
  } finally {
    if (previousArgs === SENTINEL) delete globalThis.args;
    else globalThis.args = previousArgs;

    if (previousParams === SENTINEL) delete globalThis.params;
    else globalThis.params = previousParams;

    if (previousContext === SENTINEL) delete globalThis.context;
    else globalThis.context = previousContext;
  }
}

/**
 * Injects scoped arg helpers into compiled MDX so components can access args/params/context.
 *
 * @param {string} code - Generated function body from `@mdx-js/mdx`.
 * @returns {string} Patched code string.
 */
export function injectScope(code) {
  const needle = 'function _createMdxContent(props) {\n';
  if (code.includes(needle)) {
    const injection =
      'function _createMdxContent(props) {\n' +
      '  const args = props.args ?? props.context?.args ?? {};\n' +
      '  const params = props.params ?? props.context?.params ?? {};\n' +
      '  const context = props.context ?? {};\n';
    return code.replace(needle, injection);
  }
  return code;
}

/**
 * Runtime object provided to compiled MDX modules.
 */
export const RUNTIME = {
  Fragment: ({ children }) => children ?? null,
  jsx: createElement,
  jsxs: createElement,
};

