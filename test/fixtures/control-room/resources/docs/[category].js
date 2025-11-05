// Test Next.js-style dynamic segments in .js files
export default () => ({
  title: 'Documentation by Category',
  description: 'Category-based documentation',
  // No uri specified - should be inferred as resource://docs/{category}
  async read({ params }) {
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'text/markdown',
        text: `# Documentation: ${params.category || 'unknown'}\n\nContent for this category.`
      }]
    };
  }
});

