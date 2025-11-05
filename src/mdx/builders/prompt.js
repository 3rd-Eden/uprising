import { flatten } from '../runtime.js';

/**
 * Builder for assembling prompt components during MDX rendering.
 */
export class PromptBuilder {
  /**
   * @param {Record<string, any>} frontMatter - Prompt metadata from front matter.
   * @param {Record<string, any>} context - Runtime values exposed to components.
   */
  constructor(frontMatter, context) {
    this.frontMatter = frontMatter;
    this.context = context;
    this.messages = [];
    this.schema = {};
    this.resources = [];
  }

  /**
   * Render plain text as an inline prompt without MDX components.
   *
   * @param {string} text - Plain text prompt content.
   * @returns {Object} Prompt blueprint with messages, schema, and resources.
   */
  static renderInline(text) {
    const trimmed = text.trim();
    return {
      messages: trimmed ? [{ role: 'assistant', text: trimmed }] : [],
      schema: {},
      resources: [],
    };
  }

  /**
   * Get component handlers for MDX rendering.
   *
   * @returns {Object} Map of component names to handler functions.
   */
  components() {
    return {
      Message: (props) => this.message(props),
      Ask: (props) => this.ask(props),
      Resource: (props) => this.resourceLink(props),
    };
  }

  /**
   * Handle <Message> component to add a prompt message.
   *
   * @param {Object} props - Component properties.
   * @param {string} [props.role='assistant'] - Message role.
   * @param {string} [props.name] - Optional message name.
   * @param {any} [props.children] - Message content.
   * @returns {null}
   */
  message({ role = 'assistant', name, children }) {
    const text = flatten(children);
    this.messages.push({ role, name, text });
    return null;
  }

  /**
   * Handle <Ask> component to define a prompt argument.
   *
   * @param {Object} props - Component properties.
   * @param {string} props.name - Argument name.
   * @param {string} [props.type='string'] - Argument type.
   * @param {string} [props.label] - Display label.
   * @param {boolean} [props.required] - Whether argument is required.
   * @param {string} [props.description] - Argument description.
   * @returns {null}
   */
  ask({ name, type = 'string', label, required, description, ...rest }) {
    if (!name) return null;
    this.schema[name] = {
      type,
      label,
      required: Boolean(required),
      description,
      ...rest,
    };
    return null;
  }

  /**
   * Handle <Resource> component to link or embed a resource.
   *
   * @param {Object} props - Component properties.
   * @param {string} props.uri - Resource URI.
   * @param {string} [props.mode='link'] - Resource mode ('link' or 'embed').
   * @returns {string} Resource reference markup for embed mode, empty string otherwise.
   */
  resourceLink({ uri, mode = 'link' }) {
    if (!uri) return '';
    this.resources.push({ uri, mode });
    return mode === 'embed' ? `[${uri}]` : '';
  }

  /**
   * Finalize the prompt and return the complete blueprint.
   *
   * @returns {Object} Complete prompt blueprint with messages, schema, and resources.
   */
  finalize() {
    return {
      messages: this.messages,
      schema: this.schema,
      resources: this.resources,
    };
  }
}

