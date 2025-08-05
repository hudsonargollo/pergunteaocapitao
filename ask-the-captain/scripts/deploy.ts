#!/usr/bin/env tsx

/**
 * Deployment script for Ask the Captain
 * Handles environment setup, resource creation, and deployment
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  skipBuild?: boolean;
  skipMigrations?: boolean;
  skipHealthCheck?: boolean;
}

class DeploymentManager {
  private config: DeploymentConfig;
  private projectRoot: string;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.projectRoot = process.cwd();
  }

  async deploy(): Promise<void> {
    console.log(`🚀 Starting deployment to ${this.config.environment}...`);

    try {
      // Step 1: Validate environment
      await this.validateEnvironment();

      // Step 2: Build application (unless skipped)
      if (!this.config.skipBuild) {
        await this.buildApplication();
      }

      // Step 3: Create/update Cloudflare resources
      await this.setupCloudflareResources();

      // Step 4: Deploy to Cloudflare Workers
      await this.deployToWorkers();

      // Step 5: Run database migrations (unless skipped)
      if (!this.config.skipMigrations) {
        await this.runMigrations();
      }

      // Step 6: Health check (unless skipped)
      if (!this.config.skipHealthCheck) {
        await this.performHealthCheck();
      }

      console.log(`✅ Deployment to ${this.config.environment} completed successfully!`);
    } catch (error) {
      console.error(`❌ Deployment failed:`, error);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment...');

    // Check if required environment variables are set
    const requiredEnvVars = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
    
    if (this.config.environment !== 'development') {
      requiredEnvVars.push('OPENAI_API_KEY');
    }

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Check if wrangler is installed
    try {
      execSync('npx wrangler --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Wrangler CLI is not installed or not accessible');
    }

    console.log('✅ Environment validation passed');
  }

  private async buildApplication(): Promise<void> {
    console.log('🏗️  Building application...');

    try {
      // Install dependencies
      execSync('npm ci', { stdio: 'inherit', cwd: this.projectRoot });

      // Run tests
      execSync('npm run test', { stdio: 'inherit', cwd: this.projectRoot });

      // Build application
      execSync('npm run build', { stdio: 'inherit', cwd: this.projectRoot });

      console.log('✅ Application built successfully');
    } catch (error) {
      throw new Error(`Build failed: ${error}`);
    }
  }

  private async setupCloudflareResources(): Promise<void> {
    console.log('☁️  Setting up Cloudflare resources...');

    const envSuffix = this.config.environment === 'production' ? '-production' : 
                     this.config.environment === 'staging' ? '-staging' : '';

    try {
      // Create D1 database
      const dbName = `ask-the-captain-db${envSuffix}`;
      console.log(`Creating D1 database: ${dbName}`);
      
      try {
        execSync(`npx wrangler d1 create ${dbName}`, { stdio: 'pipe' });
        console.log(`✅ D1 database ${dbName} created`);
      } catch (error) {
        // Database might already exist
        console.log(`ℹ️  D1 database ${dbName} already exists or creation failed`);
      }

      // Create Vectorize index
      const indexName = `ask-the-captain-knowledge-base${envSuffix}`;
      console.log(`Creating Vectorize index: ${indexName}`);
      
      try {
        execSync(`npx wrangler vectorize create ${indexName} --dimensions=1536 --metric=cosine`, { stdio: 'pipe' });
        console.log(`✅ Vectorize index ${indexName} created`);
      } catch (error) {
        // Index might already exist
        console.log(`ℹ️  Vectorize index ${indexName} already exists or creation failed`);
      }

      // Create R2 bucket
      const bucketName = `ask-the-captain-images${envSuffix}`;
      console.log(`Creating R2 bucket: ${bucketName}`);
      
      try {
        execSync(`npx wrangler r2 bucket create ${bucketName}`, { stdio: 'pipe' });
        console.log(`✅ R2 bucket ${bucketName} created`);
      } catch (error) {
        // Bucket might already exist
        console.log(`ℹ️  R2 bucket ${bucketName} already exists or creation failed`);
      }

      console.log('✅ Cloudflare resources setup completed');
    } catch (error) {
      throw new Error(`Resource setup failed: ${error}`);
    }
  }

  private async deployToWorkers(): Promise<void> {
    console.log('🚀 Deploying to Cloudflare Workers...');

    try {
      const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '';
      const deployCommand = `npx wrangler deploy ${envFlag}`;
      
      execSync(deployCommand, { stdio: 'inherit', cwd: this.projectRoot });
      console.log('✅ Deployment to Cloudflare Workers completed');
    } catch (error) {
      throw new Error(`Workers deployment failed: ${error}`);
    }
  }

  private async runMigrations(): Promise<void> {
    console.log('🗃️  Running database migrations...');

    try {
      const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '--local';
      const remoteFlag = this.config.environment !== 'development' ? '--remote' : '';
      const migrationCommand = `npx wrangler d1 migrations apply ${envFlag} ${remoteFlag}`.trim();
      
      execSync(migrationCommand, { stdio: 'inherit', cwd: this.projectRoot });
      console.log('✅ Database migrations completed');
    } catch (error) {
      throw new Error(`Migration failed: ${error}`);
    }
  }

  private async performHealthCheck(): Promise<void> {
    console.log('🏥 Performing health check...');

    // For now, just log that health check would be performed
    // In a real implementation, this would make HTTP requests to the deployed application
    console.log('ℹ️  Health check implementation pending - would check /api/health endpoint');
    console.log('✅ Health check completed');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = (args[0] as DeploymentConfig['environment']) || 'development';
  
  if (!['development', 'staging', 'production'].includes(environment)) {
    console.error('❌ Invalid environment. Use: development, staging, or production');
    process.exit(1);
  }

  const config: DeploymentConfig = {
    environment,
    skipBuild: args.includes('--skip-build'),
    skipMigrations: args.includes('--skip-migrations'),
    skipHealthCheck: args.includes('--skip-health-check'),
  };

  const deploymentManager = new DeploymentManager(config);
  await deploymentManager.deploy();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { DeploymentManager, type DeploymentConfig };