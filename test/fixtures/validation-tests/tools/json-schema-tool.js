// This tool incorrectly uses JSON Schema instead of Zod schemas - should trigger an error
export default {
  name: 'json-schema-tool',
  title: 'Tool with JSON Schema',
  description: 'This tool uses JSON Schema which should trigger an error',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name parameter'
      },
      count: {
        type: 'number',
        description: 'Count parameter'
      }
    },
    required: ['name']
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

