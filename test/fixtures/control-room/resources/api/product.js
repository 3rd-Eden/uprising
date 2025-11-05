// Test that .js files without uri get folder-based URIs
export default () => ({
  title: 'Product Information',
  description: 'Product data from API',
  // No uri - should be inferred as resource://api/product
  async read() {
    return {
      contents: [{
        uri: 'resource://api/product',
        mimeType: 'application/json',
        text: JSON.stringify({ name: 'Widget', price: 29.99 })
      }]
    };
  }
});

