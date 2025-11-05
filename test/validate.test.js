import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validate } from '../src/validate.js';
import { z } from 'zod';

describe('validate', () => {
  describe('tool', () => {
    it('should accept a valid tool with Zod schemas', () => {
      const tool = {
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          name: z.string(),
          count: z.number().optional()
        },
        exec: async () => ({ content: [] })
      };

      assert.doesNotThrow(() => validate('tool', 'test-tool', tool));
    });

    it('should throw when inputSchema is JSON Schema format', () => {
      const tool = {
        title: 'Bad Tool',
        description: 'Tool with JSON Schema',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        },
        exec: async () => ({ content: [] })
      };

      assert.throws(
        () => validate('tool', 'bad-tool', tool),
        /JSON Schema.*Zod schemas/
      );
    });

    it('should throw when missing exec', () => {
      const tool = {
        title: 'Broken Tool',
        description: 'Tool without execution method'
      };

      assert.throws(
        () => validate('tool', 'broken-tool', tool),
        /must have an 'exec' function/
      );
    });

    it('should throw when using handler instead of exec', () => {
      const tool = {
        title: 'Handler Tool',
        description: 'Tool with handler',
        handler: async () => ({ content: [] })
      };

      assert.throws(
        () => validate('tool', 'handler-tool', tool),
        /must have an 'exec' function/
      );
    });

    it('should throw when using run instead of exec', () => {
      const tool = {
        title: 'Run Tool',
        description: 'Tool with run',
        run: async () => ({ content: [] })
      };

      assert.throws(
        () => validate('tool', 'run-tool', tool),
        /must have an 'exec' function/
      );
    });

    it('should include file path in error messages when provided', () => {
      const tool = {
        title: 'Tool',
        description: 'Test'
      };

      assert.throws(
        () => validate('tool', 'test', tool, '/path/to/tool.js'),
        /\/path\/to\/tool\.js/
      );
    });
  });

  describe('prompt', () => {
    it('should accept a valid prompt with Zod schemas', () => {
      const prompt = {
        title: 'Test Prompt',
        description: 'A test prompt',
        argsSchema: {
          objective: z.string(),
          constraints: z.array(z.string()).optional()
        },
        exec: async () => ({ messages: [] })
      };

      assert.doesNotThrow(() => validate('prompt', 'test-prompt', prompt));
    });

    it('should throw when argsSchema is JSON Schema format', () => {
      const prompt = {
        title: 'Bad Prompt',
        description: 'Prompt with JSON Schema',
        argsSchema: {
          type: 'object',
          properties: {
            objective: { type: 'string' }
          },
          required: ['objective']
        },
        exec: async () => ({ messages: [] })
      };

      assert.throws(
        () => validate('prompt', 'bad-prompt', prompt),
        /JSON Schema.*Zod schemas/
      );
    });

    it('should throw when using handler instead of exec', () => {
      const prompt = {
        title: 'Handler Prompt',
        description: 'Prompt with handler',
        handler: async () => ({ messages: [] })
      };

      assert.throws(
        () => validate('prompt', 'handler-prompt', prompt),
        /must have an 'exec' function/
      );
    });

    it('should throw when missing exec', () => {
      const prompt = {
        title: 'Broken Prompt',
        description: 'Prompt without execution method'
      };

      assert.throws(
        () => validate('prompt', 'broken-prompt', prompt),
        /must have an 'exec' function/
      );
    });
  });

  describe('resource', () => {
    it('should accept a valid resource', () => {
      const resource = {
        title: 'Test Resource',
        description: 'A test resource',
        uri: 'test://{id}',
        read: async () => ({ contents: [] })
      };

      assert.doesNotThrow(() => validate('resource', 'test-resource', resource));
    });

    it('should throw when using exec instead of read', () => {
      const resource = {
        title: 'Exec Resource',
        description: 'Resource with exec',
        uri: 'test://{id}',
        exec: async () => ({ contents: [] })
      };

      assert.throws(
        () => validate('resource', 'exec-resource', resource),
        /must have a 'read' function/
      );
    });

    it('should throw when using handler instead of read', () => {
      const resource = {
        title: 'Handler Resource',
        description: 'Resource with handler',
        uri: 'test://{id}',
        handler: async () => ({ contents: [] })
      };

      assert.throws(
        () => validate('resource', 'handler-resource', resource),
        /must have a 'read' function/
      );
    });

    it('should throw when missing read', () => {
      const resource = {
        title: 'Broken Resource',
        description: 'Resource without read method',
        uri: 'test://{id}'
      };

      assert.throws(
        () => validate('resource', 'broken-resource', resource),
        /must have a 'read' function/
      );
    });
  });
});

