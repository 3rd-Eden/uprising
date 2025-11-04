import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

export default () => ({
  title: 'Drone Surveillance Feed',
  description: 'Telemetry stream from reconnaissance drones.',
  template: new ResourceTemplate('uprising://drone/{id}', { list: undefined }),
  async read({ params }) {
    const now = new Date().toISOString();
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          uri: params.uri,
          status: 'tracking',
          updatedAt: now
        })
      }]
    };
  }
});
