import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface UprisingServerInfo {
  name?: string;
  title?: string;
  version?: string;
}

export interface UprisingConfiguration {
  server?: UprisingServerInfo;
  [key: string]: unknown;
}

export interface UprisingModuleContext {
  server: Uprising;
  config: UprisingConfiguration;
  root: string;
  package?: Record<string, unknown> | undefined;
}

export interface ToolRegistration {
  title: string;
  description: string;
  inputSchema?: unknown;
  exec: (args: unknown, extra?: unknown) => Promise<unknown> | unknown;
}

export interface ResourceRegistration {
  title: string;
  description: string;
  template?: unknown;
  uri?: string;
  read: (context: { params: { uri: string }; variables?: unknown }) => Promise<unknown> | unknown;
  list?: () => Promise<unknown> | unknown;
  complete?: Record<string, (...args: unknown[]) => Promise<unknown> | unknown>;
}

export interface PromptRegistration {
  title: string;
  description: string;
  argsSchema?: unknown;
  exec: (args: unknown, extra?: unknown) => Promise<unknown> | unknown;
}

export class Uprising {
  constructor(dir: string, configuration?: UprisingConfiguration);
  readonly root: string;
  readonly config: UprisingConfiguration;
  readonly packageInfo?: Record<string, unknown>;
  readonly server: McpServer;
  start(transport?: unknown): Promise<McpServer>;
  close(): Promise<void>;
  ready(): Promise<McpServer>;
  template(input: string, data: Record<string, unknown>): string;
  private tools(tools: Record<string, ToolRegistration>): void;
  private resources(resources: Record<string, ResourceRegistration>): void;
  private prompts(prompts: Record<string, PromptRegistration>): void;
  private readPackageInfo(): Record<string, unknown> | undefined;
  private createServerInfo(): UprisingServerInfo & { version: string; name: string; title: string; };
  private loadInstructions(): string | undefined;
  private _prepare(): Promise<void>;
  private discover(kind: 'tools' | 'resources' | 'prompts', context: UprisingModuleContext, normalizer: (name: string, definition: unknown) => unknown): Promise<Record<string, unknown>>;
}

export function start(dir: string, configuration?: UprisingConfiguration, transport?: unknown): Promise<Uprising>;
export function template(template: string, data: Record<string, unknown>): string;

export default Uprising;
