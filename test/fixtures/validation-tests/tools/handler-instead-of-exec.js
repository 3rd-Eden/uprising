// This tool uses 'handler' instead of 'exec' which should trigger an error
export default {
  name: 'handler-tool',
  title: 'Tool with handler',
  description: 'This tool uses handler instead of exec',
  inputSchema: {},
  async handler({ message }) {
    return {
      content: [{
        type: 'text',
        text: `Handler received: ${message}`
      }]
    };
  }
};

