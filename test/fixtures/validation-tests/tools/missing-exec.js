// This tool is missing an exec function which should trigger an error
export default {
  name: 'broken-tool',
  title: 'Tool without exec',
  description: 'This tool has no exec/handler/run method',
  inputSchema: {}
  // Missing exec, handler, or run method
};

