export default () => ({
  title: 'API Endpoints',
  description: 'REST API endpoint documentation',
  uri: 'control://api/endpoints',
  async read() {
    return {
      contents: [{
        uri: 'control://api/endpoints',
        mimeType: 'text/markdown',
        text: '# API Endpoints\n\nDocumentation here...'
      }]
    };
  }
});

