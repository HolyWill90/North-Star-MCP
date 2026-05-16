/**
 * Plugin registry for managing plugins
 */

import { Plugin, PluginContext, PluginTool } from './plugin-interface.js';
import { createModuleLogger } from '../logging/logger.js';
import { AlignmentResult, Decision, MasterPlan } from '../types.js';

const logger = createModuleLogger('plugin-registry');

/**
 * Manages plugin lifecycle and execution
 */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Register a plugin
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      logger.warn({ plugin: plugin.name }, 'Plugin already registered, skipping');
      return;
    }

    logger.info(
      {
        plugin: plugin.name,
        version: plugin.version,
        description: plugin.description,
      },
      'Registering plugin'
    );

    try {
      // Initialize plugin
      if (plugin.onInitialize) {
        await plugin.onInitialize(this.context);
      }

      this.plugins.set(plugin.name, plugin);

      logger.info(
        {
          plugin: plugin.name,
          tools: plugin.tools?.length || 0,
          hooks: Object.keys(plugin.hooks || {}).length,
        },
        'Plugin registered successfully'
      );
    } catch (error) {
      logger.error(
        {
          plugin: plugin.name,
          error,
        },
        'Failed to register plugin'
      );
      throw new Error(
        `Failed to register plugin ${plugin.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      logger.warn({ plugin: pluginName }, 'Plugin not found');
      return;
    }

    logger.info({ plugin: pluginName }, 'Unregistering plugin');

    try {
      if (plugin.onShutdown) {
        await plugin.onShutdown();
      }

      this.plugins.delete(pluginName);
      logger.info({ plugin: pluginName }, 'Plugin unregistered');
    } catch (error) {
      logger.error({ plugin: pluginName, error }, 'Error during plugin shutdown');
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all tools provided by plugins
   */
  getTools(): PluginTool[] {
    const tools: PluginTool[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.tools) {
        tools.push(...plugin.tools);
      }
    }

    return tools;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): PluginTool | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.tools) {
        const tool = plugin.tools.find((t) => t.name === name);
        if (tool) {
          return tool;
        }
      }
    }
    return undefined;
  }

  /**
   * Run a hook across all plugins that can modify data
   */
  private async runModifyingHook<T>(
    hookName: string,
    data: T,
    hookGetter: (plugin: Plugin) => ((data: T) => Promise<T>) | undefined
  ): Promise<T> {
    let result = data;

    for (const plugin of this.plugins.values()) {
      const hook = hookGetter(plugin);
      if (hook) {
        try {
          result = await hook(result);

          logger.debug(
            {
              plugin: plugin.name,
              hook: hookName,
            },
            'Hook executed'
          );
        } catch (error) {
          logger.error(
            {
              plugin: plugin.name,
              hook: hookName,
              error,
            },
            'Hook execution failed'
          );
          // Continue with other plugins even if one fails
        }
      }
    }

    return result;
  }

  /**
   * Run beforeAlignment hook
   */
  async runBeforeAlignment(task: string, plan: MasterPlan): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.beforeAlignment) {
        try {
          await plugin.hooks.beforeAlignment(task, plan);
        } catch (error) {
          logger.error(
            {
              plugin: plugin.name,
              error,
            },
            'beforeAlignment hook failed'
          );
        }
      }
    }
  }

  /**
   * Run afterAlignment hook
   */
  async runAfterAlignment(result: AlignmentResult): Promise<AlignmentResult> {
    return this.runModifyingHook(
      'afterAlignment',
      result,
      (plugin) => plugin.hooks?.afterAlignment
    );
  }

  /**
   * Run beforeDecision hook
   */
  async runBeforeDecision(decision: Decision): Promise<Decision> {
    return this.runModifyingHook(
      'beforeDecision',
      decision,
      (plugin) => plugin.hooks?.beforeDecision
    );
  }

  /**
   * Run afterDecision hook
   */
  async runAfterDecision(decision: Decision): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterDecision) {
        try {
          await plugin.hooks.afterDecision(decision);
        } catch (error) {
          logger.error(
            {
              plugin: plugin.name,
              error,
            },
            'afterDecision hook failed'
          );
        }
      }
    }
  }

  /**
   * Run beforeSavePlan hook
   */
  async runBeforeSavePlan(plan: MasterPlan): Promise<MasterPlan> {
    return this.runModifyingHook('beforeSavePlan', plan, (plugin) => plugin.hooks?.beforeSavePlan);
  }

  /**
   * Run afterSavePlan hook
   */
  async runAfterSavePlan(plan: MasterPlan): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterSavePlan) {
        try {
          await plugin.hooks.afterSavePlan(plan);
        } catch (error) {
          logger.error(
            {
              plugin: plugin.name,
              error,
            },
            'afterSavePlan hook failed'
          );
        }
      }
    }
  }

  /**
   * Shutdown all plugins
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all plugins');

    const pluginNames = Array.from(this.plugins.keys());
    for (const name of pluginNames) {
      await this.unregister(name);
    }

    logger.info('All plugins shut down');
  }
}
