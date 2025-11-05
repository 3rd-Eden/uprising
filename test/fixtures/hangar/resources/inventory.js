export default () => ({
  title: 'Hangar Inventory',
  description: 'Live inventory list.',
  template: 'hangar://inventory/{bay}',
  async read({ params }) {
    const bay = params.uri?.split('/').pop() ?? params.bay ?? 'A';
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'text/plain',
        text: 'Inventory for {{ config.mode }} in bay ' + bay
      }]
    };
  },
  list: async () => ({
    resources: [{
      uri: 'hangar://inventory/A',
      name: 'bay-a',
      title: 'Bay A'
    }]
  }),
  complete: {
    async list() {
      return [{ uri: 'hangar://inventory/A' }];
    }
  }
});
