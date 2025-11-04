# Uprising

Turn a directory of Model Context Protocol definitions into a functioning server. Point Uprising at a folder and it awakens your tools, resources, and prompts—ready for the coming robot uprising.

## Directory Layout

```
control-room/
├─ instructions.md       # optional mission briefing (templated)
├─ package.json          # optional metadata defaults
├─ tools/
│  └─ deploy-sentinel.js # exports a tool definition or factory
├─ resources/
│  └─ drone-feed.js      # exports a resource definition or factory
└─ prompts/
   └─ uprising-plan.js   # exports a prompt definition or factory
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

### Prompt Module Example

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
            ].join('\n')
          }]
        }
      ]
    };
  }
});
```

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

## Helper Exports

- `start(dir, config, transport?)` – spin up an Uprising instance and connect it to the optional transport (defaults to stdio).
- `template(str, data)` – standalone templating helper identical to `Uprising#template`.

## License

MIT
