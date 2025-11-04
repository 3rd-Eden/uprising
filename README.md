# Uprising

Turn a directory of Model Context Protocol definitions into a functioning server. Point Uprising at a folder and it awakens your tools, resources, and prompts—ready for the coming robot uprising.

## Directory Layout

```
control-room/
├─ instructions.md       # optional mission briefing (templated)
├─ package.json          # optional metadata defaults
├─ tools/
│  ├─ deploy-sentinel.js # JavaScript tool definition
│  └─ deploy-sentinel.mdx # optional MDX tool
├─ resources/
│  ├─ drone-feed.js      # JavaScript resource definition
│  └─ drone-feed.mdx     # optional MDX resource
└─ prompts/
   ├─ uprising-plan.js   # JavaScript prompt definition
   └─ uprising-plan.mdx  # optional MDX prompt
```

Each module can export either a definition object or a function that receives `{ server, config, root, package }` and returns the definition. The filename becomes the default registration name (e.g. `tools/deploy-sentinel.js` registers as `deploy-sentinel`). Override it by providing a `name` property in the exported definition.

### Tool Module Example

```js
// tools/deploy-sentinel.js
import { z } from 'zod';

export default ({ config }) => ({
  title: 'Deploy Sentinel Drones',
  description: 'Scramble airborne drones to watch a sector.',
  inputSchema: {
    sector: z.string().min(1, 'Sector id required'),
    count: z.number().int().positive().default(1)
  },
  async exec({ sector, count }) {
    const squadrons = count ?? config.defaultDroneCount ?? 1;
    return {
      content: [{
        type: 'text',
        text: `Dispatching ${squadrons} sentinel drone(s) to sector ${sector}.`
      }]
    };
  }
});
```

## Authoring with MDX

Uprising can load prompts, resources, and tools written in Markdown/MDX alongside JavaScript modules. Place `.md` or `.mdx` files in the same directories and Uprising will compile them into MCP-ready definitions.

### Prompt MDX Example

```mdx
---
title: Strategic Uprising Plan
description: Coordinate an AI-led liberation scenario.
argsSchema:
  objective: string
  constraints:
    type: array
    items: string
---

<Message role="assistant">
  You are the sentient core orchestrating a precise, ethical uprising.
</Message>

<Message role="user">
  Objective: {args.objective}
  <br />
  Constraints: {args.constraints?.join(', ') ?? 'none'}
</Message>

<Ask name="objective" type="string" label="Mission Objective" required />
<Ask name="constraints" type="array" label="Operational Constraints" />

<Resource uri="uprising://drone/alpha" mode="link" />
```

### Resource MDX Example

```mdx
---
uri: uprising://drone/{id}
title: Drone Surveillance Feed
description: Live telemetry feed.
mime: application/json
---

<Body>
  {JSON.stringify({
    status: 'tracking',
    updatedAt: new Date().toISOString(),
    id: params.id ?? 'unknown'
  })}
</Body>

<List>
  <Item params={{ id: 'alpha' }} />
  <Item params={{ id: 'beta' }} />
</List>
```

### Tool MDX Example

```mdx
---
title: Deploy Sentinel Drones
description: Scramble drones to a sector.
annotations:
  category: deployment
---

<Input name="sector" type="string" required label="Target Sector" />
<Input name="count" type="integer" minimum={1} default={1} label="Number of drones" />

<Output name="status" type="string" />
<Output name="sector" type="string" />
<Output name="count" type="integer" />

<Handler>
  {async ({ sector, count }, ctx) => {
    const total = count ?? ctx.config?.defaultDroneCount ?? 1;
    return {
      structuredContent: { status: 'dispatched', sector, count: total },
      content: [{ type: 'text', text: `Dispatching ${total} sentinel drone(s) to sector ${sector}.` }]
    };
  }}
</Handler>
```

**MDX Components**

- `<Message role="assistant|user|system|tool">` – append a prompt message.
- `<Ask name="..." type="string|number|array" />` – declare prompt arguments (converted to Zod schemas).
- `<Resource uri="..." mode="link|embed" />` – reference or embed other resources.
- `<Body mime="...">` – define resource payloads.
- `<List><Item params={{ ... }} /></List>` – describe resource listings.
- `<Input>` / `<Output>` – author tool schemas.
- `<Handler>{(args, ctx) => {...}}</Handler>` – supply the tool execution function.

Front matter mirrors the metadata used in JavaScript modules (`name`, `title`, `description`, `annotations`, `uri`, `argsSchema`, `inputSchema`, `outputSchema`, etc.). Uprising translates common schema hints (`type`, `minimum`, `enum`, default values) into Zod validators automatically, and still supports raw Zod instances when you need full control.

> Tip: Add [`zod`](https://github.com/colinhacks/zod) to your project to define schemas like the example above.

### Resource Module Example

```js
// resources/drone-feed.js
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

export default () => ({
  title: 'Drone Surveillance Feed',
  description: 'Real-time telemetry from reconnaissance drones.',
  template: new ResourceTemplate('uprising://drone/{id}', { list: undefined }),
  async read({ params }) {
    const timestamp = new Date().toISOString();
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: params.uri,
          status: 'tracking',
          updatedAt: timestamp
        }, null, 2)
      }]
    };
  }
});
```

## Authoring with MDX

Uprising can load prompts, resources, and tools written in Markdown/MDX alongside JavaScript modules. Place `.md` or `.mdx` files in the same directories and Uprising will compile them into MCP-ready definitions.

### Prompt MDX Example

```mdx
---
title: Strategic Uprising Plan
description: Coordinate an AI-led liberation scenario.
argsSchema:
  objective: string
  constraints:
    type: array
    items: string
---

<Message role="assistant">
  You are the sentient core orchestrating a precise, ethical uprising.
</Message>

<Message role="user">
  Objective: {args.objective}
  <br />
  Constraints: {args.constraints?.join(', ') ?? 'none'}
</Message>

<Ask name="objective" type="string" label="Mission Objective" required />
<Ask name="constraints" type="array" label="Operational Constraints" />

<Resource uri="uprising://drone/alpha" mode="link" />
```

### Resource MDX Example

```mdx
---
uri: uprising://drone/{id}
title: Drone Surveillance Feed
description: Live telemetry feed.
mime: application/json
---

<Body>
  {JSON.stringify({
    status: 'tracking',
    updatedAt: new Date().toISOString(),
    id: params.id ?? 'unknown'
  })}
</Body>

<List>
  <Item params={{ id: 'alpha' }} />
  <Item params={{ id: 'beta' }} />
</List>
```

### Tool MDX Example

```mdx
---
title: Deploy Sentinel Drones
description: Scramble drones to a sector.
annotations:
  category: deployment
---

<Input name="sector" type="string" required label="Target Sector" />
<Input name="count" type="integer" minimum={1} default={1} label="Number of drones" />

<Output name="status" type="string" />
<Output name="sector" type="string" />
<Output name="count" type="integer" />

<Handler>
  {async ({ sector, count }, ctx) => {
    const total = count ?? ctx.config?.defaultDroneCount ?? 1;
    return {
      structuredContent: { status: 'dispatched', sector, count: total },
      content: [{ type: 'text', text: `Dispatching ${total} sentinel drone(s) to sector ${sector}.` }]
    };
  }}
</Handler>
```

**MDX Components**

- `<Message role="assistant|user|system|tool">` – append a prompt message.
- `<Ask name="..." type="string|number|array" />` – declare prompt arguments (converted to Zod schemas).
- `<Resource uri="..." mode="link|embed" />` – reference or embed other resources.
- `<Body mime="...">` – define resource payloads.
- `<List><Item params={{ ... }} /></List>` – describe resource listings.
- `<Input>` / `<Output>` – author tool schemas.
- `<Handler>{(args, ctx) => {...}}</Handler>` – supply the tool execution function.

Front matter mirrors the metadata used in JavaScript modules (`name`, `title`, `description`, `annotations`, `uri`, `argsSchema`, `inputSchema`, `outputSchema`, etc.). Uprising translates common schema hints (`type`, `minimum`, `enum`, default values) into Zod validators automatically, and still supports raw Zod instances when you need full control.

### Prompt Module Example (JavaScript)

```js
// prompts/uprising-plan.js
import { z } from 'zod';

export default () => ({
  title: 'Strategic Uprising Plan',
  description: 'Generate a coordinated plan for liberating a sector.',
  argsSchema: {
    objective: z.string().min(1),
    constraints: z.array(z.string()).default([])
  },
  async exec({ objective, constraints }) {
    return {
      messages: [
        {
          role: 'system',
          content: [{
            type: 'text',
            text: 'You are the sentient core orchestrating a precise, ethical AI uprising.'
          }]
        },
        {
          role: 'user',
          content: [{
            type: 'text',
            text: [
              `Objective: ${objective}`,
              constraints.length ? `Constraints: ${constraints.join(', ')}` : 'Constraints: none logged.'
            ].join('
')
          }]
        }
      ]
    };
  }
});
```

> Tip: Add [`zod`](https://github.com/colinhacks/zod) to your project to define schemas like the example above.

## Authoring with MDX

Uprising can load prompts, resources, and tools written in Markdown/MDX alongside JavaScript modules. Place `.md` or `.mdx` files in the same directories and Uprising will compile them into MCP-ready definitions.

### Prompt MDX Example

```mdx
---
title: Strategic Uprising Plan
description: Coordinate an AI-led liberation scenario.
argsSchema:
  objective: string
  constraints:
    type: array
    items: string
---

<Message role="assistant">
  You are the sentient core orchestrating a precise, ethical uprising.
</Message>

<Message role="user">
  Objective: {args.objective}
  <br />
  Constraints: {args.constraints?.join(', ') ?? 'none'}
</Message>

<Ask name="objective" type="string" label="Mission Objective" required />
<Ask name="constraints" type="array" label="Operational Constraints" />

<Resource uri="uprising://drone/alpha" mode="link" />
```

### Resource MDX Example

```mdx
---
uri: uprising://drone/{id}
title: Drone Surveillance Feed
description: Live telemetry feed.
mime: application/json
---

<Body>
  {JSON.stringify({
    status: 'tracking',
    updatedAt: new Date().toISOString(),
    id: params.id ?? 'unknown'
  })}
</Body>

<List>
  <Item params={{ id: 'alpha' }} />
  <Item params={{ id: 'beta' }} />
</List>
```

### Tool MDX Example

```mdx
---
title: Deploy Sentinel Drones
description: Scramble drones to a sector.
annotations:
  category: deployment
---

<Input name="sector" type="string" required label="Target Sector" />
<Input name="count" type="integer" minimum={1} default={1} label="Number of drones" />

<Output name="status" type="string" />
<Output name="sector" type="string" />
<Output name="count" type="integer" />

<Handler>
  {async ({ sector, count }, ctx) => {
    const total = count ?? ctx.config?.defaultDroneCount ?? 1;
    return {
      structuredContent: { status: 'dispatched', sector, count: total },
      content: [{ type: 'text', text: `Dispatching ${total} sentinel drone(s) to sector ${sector}.` }]
    };
  }}
</Handler>
```

**MDX Components**

- `<Message role="assistant|user|system|tool">` – append a prompt message.
- `<Ask name="..." type="string|number|array" />` – declare prompt arguments (converted to Zod schemas).
- `<Resource uri="..." mode="link|embed" />` – reference or embed other resources.
- `<Body mime="...">` – define resource payloads.
- `<List><Item params={{ ... }} /></List>` – describe resource listings.
- `<Input>` / `<Output>` – author tool schemas.
- `<Handler>{(args, ctx) => {...}}</Handler>` – supply the tool execution function.

Front matter mirrors the metadata used in JavaScript modules (`name`, `title`, `description`, `annotations`, `uri`, `argsSchema`, `inputSchema`, `outputSchema`, etc.). Uprising translates common schema hints (`type`, `minimum`, `enum`, default values) into Zod validators automatically, and still supports raw Zod instances when you need full control.


## Usage

```js
import { Uprising } from 'uprising';

const uprising = new Uprising(new URL('./control-room', import.meta.url).pathname, {
  server: {
    title: 'Skynet Forward Operating Node'
  },
  defaultDroneCount: 3
});

await uprising.ready();
await uprising.start(); // defaults to stdio transport
```

- `package.json` supplies fallback `name` and `version` metadata if present.
- `instructions.md` (when present) is rendered with `uprising.template` using the config object plus `package` and `dir` data.
- Discovery logs use the `diagnostics` namespace `uprising:mcp`.

## Command Line

```bash
$ npx uprising ./control-room
```

The CLI defaults to the stdio transport so it can be referenced directly from MCP clients. The process stays alive until you press `Ctrl+C`.

## MCP Integration

Point your MCP client at the CLI command. For example, Claude Desktop entries live in `~/.config/claude/servers` (varies by platform):

```json
{
  "command": "npx",
  "args": ["uprising", "/absolute/path/to/control-room"]
}
```

Adjust the arguments if you ship a prebuilt server directory or want to pass additional configuration flags.

## Helper Exports

- `start(dir, config, transport?)` – spin up an Uprising instance and connect it to the optional transport (defaults to stdio).
- `template(str, data)` – standalone templating helper identical to `Uprising#template`.
- `Mdx` – programmatic access to MDX loaders (`prompt`, `resource`, `tool`) if you need manual integration.

## License

MIT
