export default () => ({
  title: 'Hangar Map Feed',
  description: 'Tactical map overlay.',
  uri: 'hangar://map/{sector}',
  async read({ params }) {
    return {
      contents: [{
        uri: params.uri,
        mimeType: 'application/json',
        text: JSON.stringify({ sector: params.sector ?? 'alpha', status: 'online' })
      }]
    };
  }
});
