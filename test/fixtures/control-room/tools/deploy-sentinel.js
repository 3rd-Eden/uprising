import { z } from 'zod';

export default ({ config }) => ({
  title: 'Deploy Sentinel Drones',
  description: 'Scramble airborne drones to watch a sector.',
  inputSchema: {
    sector: z.string().min(1),
    count: z.number().int().positive().default(1)
  },
  async exec({ sector, count }) {
    const total = count ?? config.defaultDroneCount ?? 1;
    return {
      content: [{
        type: 'text',
        text: `Dispatching ${total} sentinel drone(s) to sector ${sector}.`
      }]
    };
  }
});
