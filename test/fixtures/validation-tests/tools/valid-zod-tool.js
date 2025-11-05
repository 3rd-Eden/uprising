import { z } from 'zod';

// This is a properly formatted tool using Zod schemas
export default {
  name: 'valid-tool',
  title: 'Valid Tool with Zod',
  description: 'This tool correctly uses Zod schemas',
  inputSchema: {
    name: z.string().min(1),
    count: z.number().int().positive().optional()
  },
  async exec({ name, count }) {
    return {
      content: [{
        type: 'text',
        text: `Processing ${name} with count ${count ?? 1}`
      }]
    };
  }
};

