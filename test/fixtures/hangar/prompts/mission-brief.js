import { z } from 'zod';

export default () => ({
  title: 'Mission Brief',
  description: 'Provide latest mission briefing.',
  argsSchema: { topic: z.string() },
  async exec({ topic }) {
    return {
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: `Mission topic: ${topic}` }
        }
      ]
    };
  }
});
