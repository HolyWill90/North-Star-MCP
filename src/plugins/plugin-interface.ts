/**
 * Plugin interface for extending North Star MCP functionality
 */

import { IStorage } from '../storage/storage-interface.js';
import { Config } from '../config/index.js';
import { AlignmentResult, Decision, MasterPlan } from '../types.js';
import { Logger } from 'pino';

/**
 * Context provided to plugins
 */
export interface PluginContext {
  storage: IStorage;
  logger: Logger;
  config: Config;
}

/**
 * A tool provided by a plugin
 */
export interface PluginTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any, context: PluginContext) => Promise<any>;
}

/**
 * Lifecycle hooks for plugins
 */
export interface PluginHooks {
  // Called before alignment check
  beforeAlignment?: (task: string, plan: MasterPlan) => Promise<void>;

  // Called after alignment check, can modify result
  afterAlignment?: (result: AlignmentResult) => Promise<AlignmentResult>;

  // Called before decision is logged
  beforeDecision?: (decision: Decision) => Promise<Decision>;

  // Called after decision is logged
  afterDecision?: (decision: Decision) => Promise<void>;

  // Called before master plan is saved
  beforeSavePlan?: (plan: MasterPlan) => Promise<MasterPlan>;

  // Called after master plan is saved
  afterSavePlan?: (plan: MasterPlan) => Promise<void>;
}

/**
 * Plugin interface
 */
export interface Plugin {
  // Plugin metadata
  name: string;
  version: string;
  description?: string;

  // Lifecycle hooks
  onInitialize?: (context: PluginContext) => Promise<void>;
  onShutdown?: () => Promise<void>;

  // Additional tools provided by plugin
  tools?: PluginTool[];

  // Event hooks
  hooks?: PluginHooks;
}

/**
 * Plugin factory function type
 */
export type PluginFactory = (context: PluginContext) => Plugin | Promise<Plugin>;
