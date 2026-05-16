/**
 * Schema migration framework for North Star MCP
 * Enables smooth upgrades between versions while maintaining backward compatibility
 */

import semver from 'semver';
import { CURRENT_SCHEMA_VERSION } from '../../types.js';
import { createModuleLogger } from '../../logging/logger.js';

const logger = createModuleLogger('migrations');

/**
 * A migration transforms data from one schema version to another
 */
export interface Migration {
  version: string;
  description: string;
  up: (data: any) => any;
  down: (data: any) => any;
}

/**
 * Registry of all migrations
 * Add new migrations here as the schema evolves
 */
export const migrations: Migration[] = [
  // Example future migration (not active yet)
  // {
  //   version: '1.1.0',
  //   description: 'Add priority field to milestones',
  //   up: (plan) => ({
  //     ...plan,
  //     schemaVersion: '1.1.0',
  //     phases: plan.phases.map((phase: any) => ({
  //       ...phase,
  //       milestones: phase.milestones.map((m: any) => ({
  //         ...m,
  //         priority: m.priority || 'medium' // default value
  //       }))
  //     }))
  //   }),
  //   down: (plan) => ({
  //     ...plan,
  //     schemaVersion: '1.0.0',
  //     phases: plan.phases.map((phase: any) => ({
  //       ...phase,
  //       milestones: phase.milestones.map(({ priority, ...m }: any) => m)
  //     }))
  //   })
  // }
];

/**
 * Manages schema migrations
 */
export class MigrationManager {
  constructor(private targetVersion: string = CURRENT_SCHEMA_VERSION) {}

  /**
   * Migrate data from old version to target version
   * Applies all migrations between fromVersion and targetVersion
   */
  migrate(data: any, fromVersion: string): any {
    // Normalize version (handle missing schemaVersion)
    const normalizedFrom = fromVersion || '1.0.0';

    if (normalizedFrom === this.targetVersion) {
      logger.debug({ version: normalizedFrom }, 'Data already at target version');
      return data;
    }

    logger.info(
      {
        from: normalizedFrom,
        to: this.targetVersion,
      },
      'Starting migration'
    );

    let migrated = { ...data };

    // Find applicable migrations
    const applicableMigrations = migrations
      .filter((m) => {
        const isAfterFrom = semver.gt(m.version, normalizedFrom);
        const isBeforeOrAtTarget = semver.lte(m.version, this.targetVersion);
        return isAfterFrom && isBeforeOrAtTarget;
      })
      .sort((a, b) => semver.compare(a.version, b.version));

    if (applicableMigrations.length === 0) {
      logger.debug('No migrations needed');
      // Just add schema version if missing
      if (!migrated.schemaVersion) {
        migrated.schemaVersion = this.targetVersion;
      }
      return migrated;
    }

    // Apply each migration in sequence
    for (const migration of applicableMigrations) {
      logger.info(
        {
          version: migration.version,
          description: migration.description,
        },
        'Applying migration'
      );

      try {
        migrated = migration.up(migrated);
        migrated.schemaVersion = migration.version;

        logger.debug(
          {
            version: migration.version,
          },
          'Migration applied successfully'
        );
      } catch (error) {
        logger.error(
          {
            version: migration.version,
            error,
          },
          'Migration failed'
        );
        throw new Error(
          `Failed to apply migration ${migration.version}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    logger.info(
      {
        from: normalizedFrom,
        to: migrated.schemaVersion,
      },
      'Migration completed'
    );

    return migrated;
  }

  /**
   * Check if data needs migration
   */
  needsMigration(data: any): boolean {
    const currentVersion = data.schemaVersion || '1.0.0';
    return currentVersion !== this.targetVersion;
  }

  /**
   * Get list of migrations that would be applied
   */
  getPendingMigrations(fromVersion: string): Migration[] {
    const normalizedFrom = fromVersion || '1.0.0';

    return migrations
      .filter((m) => {
        const isAfterFrom = semver.gt(m.version, normalizedFrom);
        const isBeforeOrAtTarget = semver.lte(m.version, this.targetVersion);
        return isAfterFrom && isBeforeOrAtTarget;
      })
      .sort((a, b) => semver.compare(a.version, b.version));
  }
}
