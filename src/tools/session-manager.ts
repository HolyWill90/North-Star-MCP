/**
 * Session Management
 * Handles clearing and archiving project data
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Storage } from '../types.js';
import { storageLogger } from '../logging/logger.js';

export class SessionManager {
  private storage: Storage;
  private storageDir: string;

  constructor(storage: Storage, projectRoot: string) {
    this.storage = storage;
    this.storageDir = join(projectRoot, '.north-star');
  }

  /**
   * Archive current session data before clearing
   */
  async archiveSession(reason: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = join(this.storageDir, 'archives', timestamp);

    try {
      // Create archive directory
      await fs.mkdir(archiveDir, { recursive: true });

      // Get current data
      const plan = await this.storage.getMasterPlan();
      const decisions = await this.storage.getDecisions();
      const metrics = await this.storage.getMetrics();

      // Save to archive
      if (plan) {
        await fs.writeFile(join(archiveDir, 'master-plan.json'), JSON.stringify(plan, null, 2));
      }

      if (decisions.length > 0) {
        await fs.writeFile(
          join(archiveDir, 'decisions.json'),
          JSON.stringify({ decisions }, null, 2)
        );
      }

      await fs.writeFile(join(archiveDir, 'metrics.json'), JSON.stringify(metrics, null, 2));

      // Save archive metadata
      await fs.writeFile(
        join(archiveDir, 'metadata.json'),
        JSON.stringify(
          {
            archivedAt: new Date().toISOString(),
            reason,
            projectName: plan?.name || 'Unknown',
            totalDecisions: decisions.length,
            completionPercentage: metrics.progressPercentage,
          },
          null,
          2
        )
      );

      storageLogger.info(
        { archiveDir, reason, projectName: plan?.name },
        'Session archived successfully'
      );

      return archiveDir;
    } catch (error) {
      storageLogger.error({ error, archiveDir }, 'Failed to archive session');
      throw new Error(`Failed to archive session: ${error}`);
    }
  }

  /**
   * Clear current session data
   */
  async clearSession(
    archive: boolean = true,
    reason: string = 'Manual reset'
  ): Promise<{
    archived: boolean;
    archivePath?: string;
    filesCleared: string[];
  }> {
    const filesCleared: string[] = [];
    let archivePath: string | undefined;

    try {
      // Archive first if requested
      if (archive) {
        const plan = await this.storage.getMasterPlan();
        if (plan) {
          // Only archive if there's actual data
          archivePath = await this.archiveSession(reason);
        }
      }

      // Clear files
      const files = ['master-plan.json', 'decisions.json', 'metrics.json'];

      for (const file of files) {
        const filePath = join(this.storageDir, file);
        try {
          await fs.unlink(filePath);
          filesCleared.push(file);
          storageLogger.debug({ file }, 'File cleared');
        } catch (error) {
          // File might not exist, that's okay
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            storageLogger.warn({ file, error }, 'Failed to clear file');
          }
        }
      }

      storageLogger.info(
        { filesCleared: filesCleared.length, archived: !!archivePath },
        'Session cleared successfully'
      );

      return {
        archived: !!archivePath,
        archivePath,
        filesCleared,
      };
    } catch (error) {
      storageLogger.error({ error }, 'Failed to clear session');
      throw new Error(`Failed to clear session: ${error}`);
    }
  }

  /**
   * Check if session should be cleared based on context
   */
  async shouldClearSession(newProjectName: string): Promise<boolean> {
    // Check if there's an existing master plan
    const existingPlan = await this.storage.getMasterPlan();

    if (!existingPlan) {
      return false; // No existing data, no need to clear
    }

    // Clear if project name is different
    if (existingPlan.name !== newProjectName) {
      storageLogger.info(
        { oldProject: existingPlan.name, newProject: newProjectName },
        'Different project detected, will clear session'
      );
      return true;
    }

    // Same project name, don't clear
    return false;
  }

  /**
   * List archived sessions
   */
  async listArchives(): Promise<
    Array<{
      path: string;
      archivedAt: string;
      reason: string;
      projectName: string;
      totalDecisions: number;
      completionPercentage: number;
    }>
  > {
    const archivesDir = join(this.storageDir, 'archives');

    try {
      const entries = await fs.readdir(archivesDir, { withFileTypes: true });
      const archives = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = join(archivesDir, entry.name, 'metadata.json');
          try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            archives.push({
              path: join(archivesDir, entry.name),
              ...metadata,
            });
          } catch {
            // Skip if metadata is missing or invalid
          }
        }
      }

      return archives.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []; // No archives directory yet
      }
      throw error;
    }
  }
}
