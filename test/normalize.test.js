import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalize } from '../src/normalize.js';
import { z } from 'zod';

describe('normalize', () => {
  describe('tool', () => {
    it('should normalize a valid tool definition', () => {
      const tool = {
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          name: z.string()
        },
        exec: async () => ({ content: [] })
      };

      const result = normalize('tool', 'test-tool', tool);

      assert.strictEqual(result.title, 'Test Tool');
      assert.strictEqual(result.description, 'A test tool');
      assert.ok(result.inputSchema);
      assert.strictEqual(typeof result.exec, 'function');
    });

    it('should use name as title when title is missing', () => {
      const tool = {
        description: 'A test tool',
        exec: async () => ({ content: [] })
      };

      const result = normalize('tool', 'my-tool', tool);

      assert.strictEqual(result.title, 'my-tool');
    });

    it('should use empty string as description when description is missing', () => {
      const tool = {
        title: 'Test Tool',
        exec: async () => ({ content: [] })
      };

      const result = normalize('tool', 'test-tool', tool);

      assert.strictEqual(result.description, '');
    });

    it('should throw when exec is missing', () => {
      const tool = {
        title: 'Bad Tool',
        description: 'Missing exec'
      };

      assert.throws(
        () => normalize('tool', 'bad-tool', tool),
        /must have an 'exec' function/
      );
    });
  });

  describe('prompt', () => {
    it('should normalize a valid prompt definition', () => {
      const prompt = {
        title: 'Test Prompt',
        description: 'A test prompt',
        argsSchema: {
          objective: z.string()
        },
        exec: async () => ({ messages: [] })
      };

      const result = normalize('prompt', 'test-prompt', prompt);

      assert.strictEqual(result.title, 'Test Prompt');
      assert.strictEqual(result.description, 'A test prompt');
      assert.ok(result.argsSchema);
      assert.strictEqual(typeof result.exec, 'function');
    });

    it('should use name as title when title is missing', () => {
      const prompt = {
        description: 'A test prompt',
        exec: async () => ({ messages: [] })
      };

      const result = normalize('prompt', 'my-prompt', prompt);

      assert.strictEqual(result.title, 'my-prompt');
    });

    it('should throw when exec is missing', () => {
      const prompt = {
        title: 'Bad Prompt',
        description: 'Missing exec'
      };

      assert.throws(
        () => normalize('prompt', 'bad-prompt', prompt),
        /must have an 'exec' function/
      );
    });
  });

  describe('resource', () => {
    it('should normalize a valid resource with uri', () => {
      const resource = {
        title: 'Test Resource',
        description: 'A test resource',
        uri: 'resource://{id}',
        read: async () => ({ contents: [] })
      };

      const result = normalize('resource', 'test-resource', resource);

      assert.strictEqual(result.title, 'Test Resource');
      assert.strictEqual(result.description, 'A test resource');
      assert.ok(result.template);
      assert.strictEqual(typeof result.read, 'function');
    });

    it('should normalize a resource with template string', () => {
      const resource = {
        title: 'Test Resource',
        description: 'A test resource',
        template: 'resource://{id}',
        read: async () => ({ contents: [] })
      };

      const result = normalize('resource', 'test-resource', resource);

      assert.ok(result.template);
      assert.strictEqual(typeof result.read, 'function');
    });

    it('should infer URI from file path when no uri or template provided', () => {
      const resource = {
        title: 'Test Resource',
        description: 'A test resource',
        read: async () => ({ contents: [] })
      };

      const result = normalize(
        'resource',
        'test-resource',
        resource,
        '/base/dir/api/users.js',
        '/base/dir'
      );

      assert.ok(result.template);
      assert.strictEqual(typeof result.read, 'function');
    });

    it('should return undefined when no template can be determined', () => {
      const resource = {
        title: 'Test Resource',
        description: 'A test resource',
        read: async () => ({ contents: [] })
      };

      const result = normalize('resource', 'test-resource', resource);

      assert.strictEqual(result, undefined);
    });

    it('should throw when read is missing', () => {
      const resource = {
        title: 'Bad Resource',
        description: 'Missing read',
        uri: 'resource://{id}'
      };

      assert.throws(
        () => normalize('resource', 'bad-resource', resource),
        /must have a 'read' function/
      );
    });

    it('should handle list and complete options', () => {
      const resource = {
        title: 'Test Resource',
        description: 'A test resource',
        uri: 'resource://{id}',
        read: async () => ({ contents: [] }),
        list: async () => ([]),
        complete: { enabled: true }
      };

      const result = normalize('resource', 'test-resource', resource);

      assert.ok(result.template);
      assert.strictEqual(typeof result.read, 'function');
    });
  });
});

