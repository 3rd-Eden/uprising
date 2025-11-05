// This prompt incorrectly uses JSON Schema instead of Zod schemas - should trigger an error
export default {
  name: 'json-schema-prompt',
  title: 'Prompt with JSON Schema',
  description: 'This prompt uses JSON Schema which should trigger an error',
  argsSchema: {
    type: 'object',
    properties: {
      objective: {
        type: 'string',
        description: 'Mission objective'
      },
      constraints: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['objective']
  },
  async exec({ objective, constraints }) {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Objective: ${objective}, Constraints: ${constraints?.join(', ') ?? 'none'}`
        }
      }]
    };
  }
};

