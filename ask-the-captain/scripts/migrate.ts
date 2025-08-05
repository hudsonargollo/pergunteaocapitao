#!/usr/bin/env tsx

/**
 * Database Migration Runner
 * 
 * This script provides utilities for running D1 database migrations
 * both locally and remotely using Wrangler CLI.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface MigrationOptions {
  environment: 'local' | 'remote';
  dryRun?: boolean;
  verbose?: boolean;
}

class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = join(process.cwd(), 'migrations');
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(options: MigrationOptions): Promise<void> {
    try {
      console.log(`🚀 Running migrations for ${options.environment} environment...`);
      
      // Verify migrations directory exists
      if (!existsSync(this.migrationsDir)) {
        throw new Error(`Migrations directory not found: ${this.migrationsDir}`);
      }

      // List available migrations
      const migrations = this.listMigrations();
      console.log(`📋 Found ${migrations.length} migration files:`);
      migrations.forEach(migration => console.log(`   - ${migration}`));

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no migrations will be executed');
        return;
      }

      // Build wrangler command
      const command = this.buildWranglerCommand(options.environment);
      
      if (options.verbose) {
        console.log(`🔧 Executing command: ${command}`);
      }

      // Execute migrations
      const output = execSync(command, { 
        encoding: 'utf-8',
        stdio: options.verbose ? 'inherit' : 'pipe'
      });

      if (!options.verbose && output) {
        console.log(output);
      }

      console.log(`✅ Migrations completed successfully for ${options.environment} environment`);

    } catch (error) {
      console.error(`❌ Migration failed:`, error);
      process.exit(1);
    }
  }

  /**
   * List all migration files
   */
  private listMigrations(): string[] {
    return readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  /**
   * Build the appropriate wrangler command
   */
  private buildWranglerCommand(environment: 'local' | 'remote'): string {
    const baseCommand = 'wrangler d1 migrations apply';
    const envFlag = environment === 'local' ? '--local' : '--remote';
    
    return `${baseCommand} ${envFlag}`;
  }

  /**
   * Check migration status
   */
  async checkStatus(environment: 'local' | 'remote'): Promise<void> {
    try {
      console.log(`📊 Checking migration status for ${environment} environment...`);
      
      const command = `wrangler d1 migrations list ${environment === 'local' ? '--local' : '--remote'}`;
      const output = execSync(command, { encoding: 'utf-8' });
      
      console.log(output);
    } catch (error) {
      console.error(`❌ Failed to check migration status:`, error);
      process.exit(1);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new MigrationRunner();

  // Parse command line arguments
  const command = args[0];
  const environment = (args.includes('--remote') ? 'remote' : 'local') as 'local' | 'remote';
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const options: MigrationOptions = {
    environment,
    dryRun,
    verbose
  };

  switch (command) {
    case 'run':
    case 'apply':
      await runner.runMigrations(options);
      break;
    
    case 'status':
    case 'list':
      await runner.checkStatus(environment);
      break;
    
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    
    default:
      console.error('❌ Unknown command. Use --help for usage information.');
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
📚 Database Migration Runner

Usage:
  tsx scripts/migrate.ts <command> [options]

Commands:
  run, apply    Run all pending migrations
  status, list  Check migration status
  help          Show this help message

Options:
  --local       Run against local D1 database (default)
  --remote      Run against remote D1 database
  --dry-run     Show what would be executed without running
  --verbose     Show detailed output

Examples:
  tsx scripts/migrate.ts run --local
  tsx scripts/migrate.ts run --remote --verbose
  tsx scripts/migrate.ts status --remote
  tsx scripts/migrate.ts run --dry-run

Note: Make sure you have wrangler CLI installed and configured.
  `);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { MigrationRunner };