// Test dynamic segment in folder with nested file
export default () => ({
  title: 'Tutorial',
  description: 'Tutorial documentation for a category',
  // No uri - should be inferred as resource://docs/{category}/tutorial
  async read({ params }) {
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'text/markdown',
        text: `# Tutorial for ${params.category || 'unknown'}\n\nTutorial content here.`
      }]
    };
  }
});

