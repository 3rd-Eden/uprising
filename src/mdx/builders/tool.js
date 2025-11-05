import { flatten } from '../runtime.js';
import { buildInputSchema, buildOutputSchema } from '../utils.js';

/**
 * Builder for assembling tool components during MDX rendering.
 */
export class ToolBuilder {
  /**
   * @param {Record<string, any>} frontMatter - Tool metadata block.
   * @param {Record<string, any>} context - Runtime values exposed to components.
   */
  constructor(frontMatter, context) {
    this.frontMatter = frontMatter;
    this.context = context;
    this.inputs = {};
    this.outputs = {};
    this.handler = null;
    this.examples = [];
  }

  /**
   * Get component handlers for MDX rendering.
   *
   * @returns {Object} Map of component names to handler functions.
   */
  components() {
    return {
      Input: (props) => this.input(props),
      Output: (props) => this.output(props),
      Exec: (props) => this.exec(props),
      Example: (props) => this.example(props),
      Call: (props) => ({ type: 'call', props }),
      Response: (props) => ({ type: 'response', props }),
    };
  }

  /**
   * Handle <Input> component to define a tool input parameter.
   *
   * @param {Object} props - Component properties.
   * @param {string} props.name - Input parameter name.
   * @returns {null}
   */
  input({ name, ...rest }) {
    if (!name) return null;
    this.inputs[name] = { ...rest };
    return null;
  }

  /**
   * Handle <Output> component to define a tool output field.
   *
   * @param {Object} props - Component properties.
   * @param {string} props.name - Output field name.
   * @returns {null}
   */
  output({ name, ...rest }) {
    if (!name) return null;
    this.outputs[name] = { ...rest };
    return null;
  }

  /**
   * Handle <Exec> component to set the tool execution function.
   *
   * @param {Object} props - Component properties.
   * @param {Function|Function[]} props.children - Execution function or array containing function.
   * @returns {null}
   */
  exec({ children }) {
    const fn = Array.isArray(children)
      ? children.find((child) => typeof child === 'function')
      : typeof children === 'function'
        ? children
        : null;
    if (typeof fn === 'function') {
      this.handler = fn;
    }
    return null;
  }

  /**
   * Handle <Example> component to add a tool usage example.
   *
   * @param {Object} props - Component properties.
   * @param {string} [props.title] - Example title.
   * @param {any} [props.children] - Example content with Call and Response components.
   * @returns {null}
   */
  example({ title, children }) {
    const nodes = Array.isArray(children) ? children : [children];
    const example = { title, call: null, response: null };
    for (const node of nodes) {
      if (node?.type === 'call') example.call = node.props;
      if (node?.type === 'response') example.response = flatten(node.props?.children);
    }
    this.examples.push(example);
    return null;
  }

  /**
   * Finalize the tool and return the complete blueprint.
   *
   * @returns {Object} Complete tool blueprint with schemas, handler, and examples.
   */
  finalize() {
    return {
      inputSchema: Object.keys(this.inputs).length ? buildInputSchema(this.inputs) : undefined,
      outputSchema: Object.keys(this.outputs).length ? buildOutputSchema(this.outputs) : undefined,
      handler: this.handler,
      examples: this.examples,
    };
  }
}

