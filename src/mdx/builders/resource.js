import { flatten } from '../runtime.js';

/**
 * Builder for assembling resource components during MDX rendering.
 */
export class ResourceBuilder {
  /**
   * @param {Record<string, any>} frontMatter - Resource metadata.
   * @param {Record<string, any>} context - Runtime values exposed to components.
   */
  constructor(frontMatter, context) {
    this.frontMatter = frontMatter;
    this.context = context;
    this.body = '';
    this.mime = frontMatter.mime;
    this.listing = [];
  }

  /**
   * Render plain text as an inline resource without MDX components.
   *
   * @param {string} text - Plain text resource content.
   * @param {Record<string, any>} frontMatter - Resource metadata.
   * @returns {Object} Resource blueprint with text, mime type, and empty listing.
   */
  static renderInline(text, frontMatter) {
    return {
      text,
      mime: frontMatter.mime ?? 'text/markdown',
      listing: [],
    };
  }

  /**
   * Get component handlers for MDX rendering.
   *
   * @returns {Object} Map of component names to handler functions.
   */
  components() {
    return {
      Body: (props) => this.bodyContent(props),
      Resource: (props) => this.reference(props),
      List: ({ children }) => children ?? null,
      Item: (props) => this.addItem(props),
      Meta: (props) => this.overrideMeta(props),
    };
  }

  /**
   * Handle <Body> component to set resource content.
   *
   * @param {Object} props - Component properties.
   * @param {string} [props.mime] - MIME type override.
   * @param {any} [props.children] - Body content.
   * @returns {null}
   */
  bodyContent({ mime, children }) {
    this.mime = mime ?? this.mime ?? 'text/markdown';
    this.body = flatten(children);
    return null;
  }

  /**
   * Handle <Resource> component to create a resource reference.
   *
   * @param {Object} props - Component properties.
   * @param {string} props.uri - Resource URI to reference.
   * @returns {string} Resource reference markup.
   */
  reference({ uri }) {
    if (!uri) return '';
    return `[${uri}]`;
  }

  /**
   * Handle <Item> component to add a resource listing entry.
   *
   * @param {Object} props - Component properties.
   * @param {Record<string, any>} [props.params={}] - Parameters for URI template.
   * @param {string} [props.uri] - Item URI.
   * @param {string} [props.title] - Item title.
   * @param {string} [props.description] - Item description.
   * @param {string} [props.name] - Item name.
   * @returns {null}
   */
  addItem({ params = {}, uri, title, description, name }) {
    this.listing.push({ params, uri, title, description, name });
    return null;
  }

  /**
   * Handle <Meta> component to override resource metadata.
   *
   * @param {Object} props - Component properties.
   * @param {string} [props.title] - Override title.
   * @param {string} [props.description] - Override description.
   * @returns {null}
   */
  overrideMeta({ title, description }) {
    if (title) this.frontMatter.title = title;
    if (description) this.frontMatter.description = description;
    return null;
  }

  /**
   * Finalize the resource and return the complete blueprint.
   *
   * @returns {Object} Complete resource blueprint with text, mime type, and listing.
   */
  finalize() {
    return {
      text: this.body,
      mime: this.mime,
      listing: this.listing,
    };
  }
}

