# Uprising

> Filesystem-driven MCP server that transforms directories into living AI capabilities.

Turn a folder of definitions into a complete Model Context Protocol server. Uprising discovers your tools, resources, and prompts—awakening them for the coming robot uprising.

## Quick Start

```bash
npm install uprising
```

Create your server directory:

```
my-server/
├── instructions.md       # Server instructions (optional)
├── package.json          # Metadata (optional)
├── tools/                # Executable capabilities
│   ├── example.js
│   ├── another.mdx
│   └── simple.md         # Not supported - tools need exec logic
├── resources/            # Data providers
│   ├── docs.js
│   ├── api.mdx
│   └── guide.md          # ✅ Plain markdown works!
└── prompts/              # Templated conversations
    ├── helper.js
    ├── advanced.mdx
    └── simple.md         # ✅ Plain markdown works!
```

You can use the provided CLI to start the MCP server, providing it with the
directory that contains your MCP setup:

```bash
npx uprising ./my-server
```

Or in code:

```javascript
import { start } from 'uprising';

await start('./my-server', {
  myConfig: 'value'
});
```

## Table of Contents

- [Tools](#tools) - Executable capabilities
- [Resources](#resources) - Data providers
- [Prompts](#prompts) - Templated conversations
- [Instructions](#instructions) - Server-level guidance
- [Template Variables](#template-variables) - Available interpolation data
- [Best Practices](#best-practices) - Recommended patterns
- [CLI Usage](#cli-usage) - Command line interface
- [MCP Integration](#mcp-integration) - Connect to MCP clients

---

## Tools

Tools are executable capabilities. They **require an `exec` function**, so they must be authored in **JavaScript/TypeScript** or **MDX** (plain `.md` is not supported).

### JavaScript Tool

```javascript
// tools/deploy.js
import { z } from 'zod';

export default {
  title: 'Deploy Application',
  description: 'Deploy an application to a specific environment',
  inputSchema: {
    app: z.string().min(1),
    env: z.enum(['dev', 'staging', 'prod']).default('dev'),
    force: z.boolean().optional()
  },
  async exec({ app, env, force }) {
    // Your logic here
    return {
      content: [{
        type: 'text',
        text: `Deploying ${app} to ${env}${force ? ' (forced)' : ''}`
      }]
    };
  }
};
```

**Key points:**
- ✅ Must export an `exec` async function
- ✅ Use Zod schemas for `inputSchema` (not JSON Schema)
- ✅ Return `{ content: [{ type: 'text', text: '...' }] }`
- Can export a function that receives `{ config, server, root, package }`
- Should be part of the `tools` folder.

### MDX Tool

```mdx
---
title: Deploy Application
description: Deploy to environments
annotations:
  category: deployment
---

<Input name="app" type="string" required label="Application Name" />
<Input name="env" type="string" default="dev" label="Environment" />
<Input name="force" type="boolean" label="Force deployment" />

<Output name="status" type="string" />
<Output name="deployedAt" type="string" />

<Exec>
  {async ({ app, env, force }, ctx) => {
    const timestamp = new Date().toISOString();
    return {
      content: [{
        type: 'text',
        text: `Deploying ${app} to ${env}${force ? ' (forced)' : ''}`
      }],
      structuredContent: {
        status: 'deployed',
        deployedAt: timestamp
      }
    };
  }}
</Exec>

<Example title="Deploy to production">
  <Call arguments={{ app: 'web-app', env: 'prod' }} />
  <Response>
    {JSON.stringify({ status: 'deployed', env: 'prod' })}
  </Response>
</Example>
```

**MDX Components:**
- `<Input>` - Define input parameters
- `<Output>` - Define output structure (optional)
- `<Exec>` - Execution function (required)
- `<Example>` - Usage examples with `<Call>` and `<Response>`

#### Tool MDX Component Props

##### `<Input>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | ✅ | Identifier for the input parameter. Must be unique within the tool and becomes the object key passed to `exec`. |
| `type` | string | ❌ | Expected data type. Supports `string`, `number`, `integer`, `boolean`, `array`, and `object`. Defaults to `string`. Supplying a Zod schema instance is also supported. |
| `required` | boolean | ❌ | When `true`, the generated Zod schema marks the parameter as required. Defaults to optional. |
| `default` | any | ❌ | Provides a default value on the Zod schema (ignored if `required` is `true`). |
| `enum` | any[] | ❌ | Restricts the value to the provided choices. Values are stringified before constructing the enum schema. |
| `minimum` / `maximum` | number | ❌ | Applies numeric bounds or string length limits, depending on the type. |
| `items` | object | ❌ | Defines the element schema when `type="array"`. Accepts the same shape options as `<Input>` itself. |
| `label` / `description` | string | ❌ | Optional metadata useful for documentation or future UIs. Currently not interpreted by the runtime. |

All additional props are forwarded to the schema builder, which ignores unknown options.

##### `<Output>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | ✅ | Identifier for the output field; used to build the tool's `outputSchema`. |
| `type` | string | ❌ | Same options as `<Input type>`, defaulting to `string`. Supplying a Zod schema instance is also supported. |
| `enum` | any[] | ❌ | Restricts the returned value to the provided options. |
| `minimum` / `maximum` | number | ❌ | Applies bounds identical to `<Input>`. |
| `items` | object | ❌ | Element schema when `type="array"`. |
| `label` / `description` | string | ❌ | Optional metadata. |

Unlike inputs, `default` values are ignored for outputs to prevent masking missing data.

##### `<Exec>`

- **children:** supply an async function (or array containing one). The first function child is captured and used as the tool's `exec` handler. Receives `(args, context)` just like JavaScript tools.

##### `<Example>`

- **title:** optional string shown alongside the example.
- **children:** include exactly one `<Call>` and one `<Response>` to document inputs and outputs. Multiple `<Example>` blocks are allowed per tool.

##### `<Call>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `arguments` | object | ❌ | Captured wholesale and stored with the example. Use this to show sample payloads. |
| _any_ | any | ❌ | Additional props are preserved, enabling custom documentation consumers to read extra metadata. |

The component has no rendered body; it simply records the provided props.

##### `<Response>`

- **children:** place sample output (any MDX content). Text is flattened to plain strings for storage.
- **mime:** optional string describing the sample response type.

---

## Resources

Resources provide data. They can be authored in **JavaScript/TypeScript**, **MDX**, or **plain Markdown**.

### JavaScript Resource

```javascript
// resources/docs.js
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

export default {
  title: 'Documentation',
  description: 'Access project documentation',
  uri: 'docs://{section}',
  async read({ params }) {
    const content = await loadDoc(params.section);
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'text/markdown',
        text: content
      }]
    };
  },
  async list() {
    return {
      resources: [
        { uri: 'docs://getting-started', name: 'Getting Started' },
        { uri: 'docs://api', name: 'API Reference' }
      ]
    };
  }
};
```

**Key points:**
- ✅ Must export a `read` async function
- ✅ Provide `uri` or `template` for URI pattern
- Optional `list()` function for resource discovery
- Return `{ contents: [{ uri, mimeType, text }] }`
- Should be part of the `resources` folder.

### MDX Resource

```mdx
---
title: API Documentation
description: REST API reference
uri: api://{version}/{endpoint}
mime: text/markdown
---

<Body>
  # API Endpoint: {params.endpoint}

  Version: {params.version}

  Access this endpoint at `{{ config.apiBaseUrl }}/{{ params.version }}/{{ params.endpoint }}`
</Body>

<List>
  <Item params={{ version: 'v1', endpoint: 'users' }} title="Users API" />
  <Item params={{ version: 'v1', endpoint: 'products' }} title="Products API" />
  <Item params={{ version: 'v2', endpoint: 'users' }} title="Users API v2" />
</List>
```

**MDX Components:**
- `<Body>` - Resource content
- `<List>` + `<Item>` - Discoverable resources
- `<Meta>` - Override metadata dynamically
- `<Resource>` - Embed other resources

#### Resource MDX Component Props

##### `<Body>`

- **mime:** optional MIME type override for the rendered body. Defaults to the front-matter `mime` or `text/markdown`.
- **children:** main resource content; flattened to plain text.

##### `<List>`

- Acts as a container for `<Item>` children. It does not accept its own props.

##### `<Item>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `params` | object | ❌ | Parameter values applied when generating URIs from templates (e.g., `{ version: 'v1' }`). |
| `uri` | string | ❌ | Explicit URI for the listing item. When omitted, the discovery layer resolves the URI from the parent file path and `params`. |
| `title` | string | ❌ | Human-friendly name surfaced in discovery responses. |
| `description` | string | ❌ | Additional detail shown alongside the listing entry. |
| `name` | string | ❌ | Override for the resource's registration name. |

##### `<Meta>`

- **title:** overrides the resource title after front-matter is parsed.
- **description:** overrides the resource description.

##### `<Resource>`

- **uri:** required. Embeds a reference to another resource and renders as `[uri]` in the body.

### Plain Markdown Resource

```md
---
title: Getting Started Guide
description: How to get started
uri: resource://guides/getting-started
mime: text/markdown
author: Engineering Team
version: 1.2.0
---

# Getting Started

Welcome to {{ package.name }}!

**Guide Version:** {{ version }}
**Author:** {{ author }}
**Server Config:** {{ config.environment }}

This guide will help you get up and running quickly.
```

**Key points:**
- ✅ Front-matter defines `uri`, `mime`, and metadata
- ✅ Body is plain Markdown with `{{ template }}` variables
- ✅ Access to `frontMatter`, `params`, `config`, `package`
- Perfect for static documentation

---

## Prompts

Prompts are templated conversations. They can be authored in **JavaScript/TypeScript**, **MDX**, or **plain Markdown**.

### JavaScript Prompt

```javascript
// prompts/code-review.js
import { z } from 'zod';

export default {
  title: 'Code Review Assistant',
  description: 'Help review code with specific focus areas',
  argsSchema: {
    language: z.string(),
    focusAreas: z.array(z.string()).default([]),
    severity: z.enum(['strict', 'moderate', 'lenient']).default('moderate')
  },
  async exec({ language, focusAreas, severity }) {
    return {
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: `You are a ${severity} code reviewer specializing in ${language}.`
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this code. Focus on: ${focusAreas.join(', ') || 'general best practices'}.`
          }
        }
      ]
    };
  }
};
```

**Key points:**
- ✅ Must export an `exec` async function
- ✅ Use Zod schemas for `argsSchema` (not JSON Schema)
- ✅ Return `{ messages: [{ role, content: { type, text } }] }`
- Can include `resources` array for embeddings
- Should be part of the `prompts` folder.

### MDX Prompt

```mdx
---
title: Code Review Assistant
description: Help review code
argsSchema:
  language: string
  focusAreas:
    type: array
    items: string
  severity:
    type: string
    enum: [strict, moderate, lenient]
---

<Message role="system">
  You are a {args.severity ?? 'moderate'} code reviewer specializing in {args.language}.
</Message>

<Message role="user">
  Please review this code.

  Focus areas: {args.focusAreas?.join(', ') ?? 'general best practices'}
</Message>

<Ask name="language" type="string" label="Programming Language" required />
<Ask name="focusAreas" type="array" label="Focus Areas" />
<Ask name="severity" type="string" label="Review Severity" />

<Resource uri="resource://style-guide/{args.language}" mode="embed" />
```

**MDX Components:**
- `<Message>` - Add messages (roles: `assistant`, `user`, `system`, `tool`)
- `<Ask>` - Define prompt arguments (generates Zod schemas)
- `<Resource>` - Embed or link resources

#### Prompt MDX Component Props

##### `<Message>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `role` | string | ❌ | Sets the message role. Supports `assistant`, `user`, `system`, and `tool`. Defaults to `assistant`. |
| `name` | string | ❌ | Optional identifier for the message. Useful when multiple tool messages need to be distinguished. |
| _children_ | MDX | ❌ | Body text for the message; flattened to plain strings. |

##### `<Ask>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | ✅ | Argument key exposed to the prompt consumer. Must be unique. |
| `type` | string | ❌ | One of `string`, `number`, `integer`, `boolean`, `array`, or `object`. Defaults to `string`. |
| `label` | string | ❌ | Friendly display label. Stored with the schema for use by clients. |
| `description` | string | ❌ | Longer help text for UI presentation. |
| `required` | boolean | ❌ | Marks the argument as mandatory. Defaults to optional. |
| `default` | any | ❌ | Provides a default value when omitted. |
| `enum` | any[] | ❌ | Restricts the argument to a discrete set of values. |
| `items` | object | ❌ | Element schema when `type="array"`. |
| `minimum` / `maximum` | number | ❌ | Applies numeric or length bounds, mirroring `<Input>`. |

Unknown props are forwarded to the schema builder and currently ignored.

##### `<Resource>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `uri` | string | ✅ | Identifies the resource to associate with the prompt. |
| `mode` | string | ❌ | Either `link` (default) or `embed`. `embed` records the URI for inclusion in prompt outputs and emits `[uri]` inline. |

### Plain Markdown Prompt

```md
---
title: Code Review Assistant
description: Review code with AI assistance
author: Engineering Team
argsSchema:
  language: string
  severity: string
---

You are a {{ severity }} code reviewer specializing in {{ args.language }}.

Please review the following code carefully and provide feedback.

**Reviewer:** {{ author }}
**Project:** {{ package.name }}
```

**Key points:**
- ✅ Front-matter defines `argsSchema` and metadata
- ✅ Body becomes a single `assistant` role message
- ✅ Template variables: `{{ args.* }}`, `{{ config.* }}`, `{{ package.* }}`, and any front-matter fields
- Perfect for simple, single-message prompts

---

## Instructions

The `instructions.md` file at your server root provides server-level guidance to AI clients.

### Example

```md
---
title: My AI Server
version: 2.0
team: Engineering
---

# {{ title }}

Version {{ version }} - Maintained by {{ team }}

This server provides tools and resources for {{ package.description }}.

**Environment:** {{ config.environment }}
**Server Path:** {{ dir }}

## Available Capabilities

Use the tools in this server to automate deployment, access documentation, and get code review assistance.
```

**Template variables:**
- `...frontMatter` - Any fields from front-matter
- `config` - Server configuration object
- `package` - Contents of `package.json`
- `dir` - Absolute path to server root

---

## Template Variables

All `.md` files support `{{ variable }}` interpolation with dot notation.

### Common Variables

| Variable | Available In | Description |
|----------|-------------|-------------|
| `args.*` | Prompts | Arguments passed to prompt |
| `params.*` | Resources | URI template parameters |
| `config.*` | All | Server configuration |
| `package.*` | All | package.json contents |
| `dir` | Instructions | Server root directory |
| `context.*` | Prompts, Resources | Execution context |
| `...frontMatter` | All | Any custom front-matter fields |

### Examples

```md
{{ args.task }}                    # Prompt argument
{{ params.id }}                    # Resource URI parameter
{{ config.apiKey }}                # Server configuration
{{ package.name }}                 # From package.json
{{ package.version }}              # Package version
{{ title }}                        # From front-matter
{{ author }}                       # Custom front-matter field
{{ config.database.host }}         # Nested with dot notation
```

**Note:** Objects are automatically JSON stringified: `{{ config.database }}` → `{"host":"localhost","port":5432}`

---

## Schema Definitions

### Zod Schemas (JavaScript)

**Required format for JavaScript tools and prompts:**

```javascript
import { z } from 'zod';

export default {
  inputSchema: {
    name: z.string().min(1),
    age: z.number().int().positive(),
    email: z.string().email().optional(),
    tags: z.array(z.string()).default([])
  },
  exec: async ({ name, age, email, tags }) => { ... }
};
```

### Simple Schemas (Front-matter)

**For MDX and MD files, use simplified schema syntax in front-matter:**

```yaml
argsSchema:
  name: string                    # Simple type
  age:
    type: integer
    minimum: 0
  email:
    type: string
    format: email
  tags:
    type: array
    items: string
    default: []
```

Uprising automatically converts these to Zod validators.

**Supported types:** `string`, `number`, `integer`, `boolean`, `array`, `object`

**Supported modifiers:** `minimum`, `maximum`, `enum`, `default`, `required`, `format`

---

## Best Practices

### 1. **Choose the Right Format**

| Format | Use When | Example |
|--------|----------|---------|
| **JavaScript** | Complex logic, TypeScript needed, external APIs | Tools with business logic |
| **MDX** | Interactive examples, structured I/O, complex prompts | Tools with demos, multi-message prompts |
| **Markdown** | Static content, simple templates | Documentation resources, basic prompts |

### 2. **Schema Design**

```javascript
// ✅ DO: Use descriptive names and validation
inputSchema: {
  deploymentTarget: z.string().min(1),
  environment: z.enum(['dev', 'staging', 'prod']),
  config: z.object({ ... }).optional()
}

// ❌ DON'T: Use JSON Schema format
inputSchema: {
  type: 'object',
  properties: { ... }  // ❌ This will error!
}
```

### 3. **Tool Organization**

```
tools/
├── deployment/
│   ├── deploy.js
│   └── rollback.js
├── testing/
│   └── run-tests.js
└── utilities/
    └── format-code.js
```

Tool names will be: `deployment-deploy`, `deployment-rollback`, `testing-run-tests`, `utilities-format-code`

### 4. **Error Handling**

```javascript
async exec({ input }) {
  try {
    const result = await doSomething(input);
    return {
      content: [{ type: 'text', text: result }]
    };
  } catch (error) {
    // Errors are automatically caught and formatted
    throw new Error(`Failed to process: ${error.message}`);
  }
}
```

Uprising automatically wraps errors in proper MCP format.

### 5. **Configuration**

```javascript
// tools/api-call.js
export default ({ config }) => ({
  title: 'Call API',
  description: 'Make API requests',
  inputSchema: { endpoint: z.string() },
  async exec({ endpoint }) {
    const baseUrl = config.apiBaseUrl ?? 'https://api.example.com';
    const response = await fetch(`${baseUrl}${endpoint}`);
    // ...
  }
});
```

Access config by exporting a factory function.

### 6. **Dynamic Resources**

```javascript
// resources/user/[id].js
export default {
  title: 'User Profile',
  description: 'Get user by ID',
  uri: 'user://{id}',  // {id} from file path [id].js
  async read({ params }) {
    const user = await db.users.find(params.id);
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'application/json',
        text: JSON.stringify(user, null, 2)
      }]
    };
  }
};
```

Use `[param]` in folder/file names for Next.js-style dynamic segments.

---

## Directory Layout

```
my-server/
├── instructions.md              # Server instructions (optional)
├── package.json                 # Metadata (optional)
│
├── tools/                       # Tools must be .js or .mdx
│   ├── simple-tool.js          # Basic JavaScript tool
│   ├── advanced-tool.mdx       # MDX with examples
│   └── nested/
│       └── subtool.js          # → tool name: "nested-subtool"
│
├── resources/                   # Can be .js, .mdx, or .md
│   ├── static-doc.md           # Plain markdown (static)
│   ├── dynamic-doc.mdx         # MDX with components
│   ├── api.js                  # JavaScript (dynamic)
│   └── users/
│       └── [id].js             # → URI: "resource://users/{id}"
│
└── prompts/                     # Can be .js, .mdx, or .md
    ├── simple.md               # Single-message prompt
    ├── complex.mdx             # Multi-message with components
    └── custom.js               # Full control
```

**File Naming:**
- Filename becomes the registration name (e.g., `deploy-app.js` → `deploy-app`)
- Override with `name` property in definition
- Nested paths use dashes (e.g., `api/users.js` → `api-users`)
- `[param]` syntax creates URI templates with `{param}`

---

## Tool Reference

### Required Properties

```javascript
{
  exec: async (args, context) => { ... }  // Required
}
```

### Optional Properties

```javascript
{
  name: 'custom-name',           // Override filename
  title: 'Human Title',          // Display name
  description: 'What it does',   // Description
  inputSchema: { ... },          // Zod schemas for inputs
  outputSchema: { ... },         // Zod schemas for outputs (MDX only)
  annotations: { ... }           // Custom metadata
}
```

### Context Object

```javascript
async exec(args, context) {
  context.config    // Server configuration
  context.server    // Uprising instance
  context.root      // Server directory
  context.package   // package.json data
}
```

---

## Resource Reference

### Required Properties

```javascript
{
  read: async ({ params, variables }) => { ... },  // Required
  uri: 'scheme://{param}'                          // Required (or template)
}
```

### Optional Properties

```javascript
{
  name: 'custom-name',           // Override filename
  title: 'Human Title',          // Display name
  description: 'What it provides', // Description
  template: 'scheme://{param}',  // Alternative to uri
  list: async () => { ... },     // Resource discovery
  mime: 'text/markdown'          // MIME type override
}
```

---

## Prompt Reference

### Required Properties

```javascript
{
  exec: async (args, context) => { ... }  // Required
}
```

### Optional Properties

```javascript
{
  name: 'custom-name',           // Override filename
  title: 'Human Title',          // Display name
  description: 'What it does',   // Description
  argsSchema: { ... },           // Zod schemas for arguments
  annotations: { ... }           // Custom metadata
}
```

### Return Format

```javascript
{
  messages: [
    {
      role: 'system' | 'assistant' | 'user' | 'tool',
      content: { type: 'text', text: '...' },
      name: 'optional-name'  // Optional
    }
  ],
  resources: [  // Optional - resources to embed
    { uri: 'resource://...' }
  ]
}
```

---

## CLI Usage

### Start Server

```bash
npx uprising ./my-server
```

### With Configuration

Pass JSON configuration via environment variable or config file (if supported by your MCP client).

---

## MCP Integration

### Claude Desktop

Add to `~/.config/claude/servers` (or platform-specific path):

```json
{
  "my-server": {
    "command": "npx",
    "args": ["uprising", "/absolute/path/to/my-server"]
  }
}
```

### VS Code / Cursor

Configure in your MCP settings with the uprising command.

### Custom Integration

```javascript
import { Uprising } from 'uprising';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const uprising = new Uprising('./my-server', {
  apiKey: process.env.API_KEY,
  environment: 'production'
});

await uprising.start(new StdioServerTransport());
```

---

## API Validation

Uprising validates definitions during discovery and throws clear errors:

### Common Errors

**Missing exec function:**
```
Error: Tool "my-tool" in tools/my-tool.js must have an 'exec' function.
```

**Using JSON Schema instead of Zod:**
```
Error: Tool "my-tool" uses JSON Schema format for 'inputSchema', but Uprising expects Zod schemas.
  Expected: { name: z.string(), ... }
  Got: { type: 'object', properties: { ... }, ... }
  Fix: Import 'zod' and use Zod schema objects.
```

**Wrong method name for resources:**
```
Error: Resource "my-resource" must have a 'read' function.
```

---

## Advanced Features

### Factory Functions

Export a function to access configuration:

```javascript
// tools/configured-tool.js
export default ({ config, server, root, package }) => ({
  title: 'Configured Tool',
  inputSchema: { ... },
  async exec(args) {
    // Access config.myValue, server, etc.
  }
});
```

### Resource Listings

```javascript
export default {
  uri: 'resource://docs/{section}',
  async read({ params }) { ... },
  async list() {
    return {
      resources: [
        { uri: 'resource://docs/api', name: 'API Docs', title: 'API' },
        { uri: 'resource://docs/guide', name: 'Guide', title: 'User Guide' }
      ]
    };
  }
};
```

### Multiple Definitions in One File

```javascript
// resources/api/endpoints.js
export default [
  {
    name: 'users-api',
    uri: 'api://users',
    read: async () => { ... }
  },
  {
    name: 'products-api',
    uri: 'api://products',
    read: async () => { ... }
  }
];
```

### Structured Tool Output

```javascript
async exec({ input }) {
  return {
    content: [{ type: 'text', text: 'Success!' }],
    structuredContent: {
      status: 'completed',
      processedAt: new Date().toISOString(),
      result: { ... }
    }
  };
}
```

---

## Debugging

Enable diagnostic logging:

```bash
DIAGNOSTICS='uprising:*' npx uprising ./my-server
```

Or specific namespaces:

```bash
DIAGNOSTICS='uprising:mcp' npx uprising ./my-server
```

---

## Package.json

Uprising uses `package.json` for server metadata if present:

```json
{
  "name": "my-ai-server",
  "version": "1.0.0",
  "description": "Custom AI capabilities",
  "type": "module"
}
```

These values become available in templates and default server info.

---

## Exports

```javascript
import {
  Uprising,        // Main class
  start,           // Convenience starter
  template,        // Templating helper
  Mdx              // MDX loaders (advanced)
} from 'uprising';
```

---

## Requirements

- Node.js 18+ (ESM support required)
- `zod` package for schema definitions

---

## License

MIT