#!/usr/bin/env tsx

/**
 * Environment setup script for Ask the Captain
 * Handles secrets management and environment configuration
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  secrets: Record<string, string>;
  vars: Record<string, string>;
}

class EnvironmentManager {
  private config: EnvironmentConfig;
  private projectRoot: string;

  constructor(config: EnvironmentConfig) {
    this.config = config;
    this.projectRoot = process.cwd();
  }

  async setup(): Promise<void> {
    console.log(`🔧 Setting up ${this.config.environment} environment...`);

    try {
      // Step 1: Validate configuration
      await this.validateConfiguration();

      // Step 2: Set up secrets
      await this.setupSecrets();

      // Step 3: Set up environment variables
      await this.setupEnvironmentVariables();

      // Step 4: Validate setup
      await this.validateSetup();

      console.log(`✅ ${this.config.environment} environment setup completed!`);
    } catch (error) {
      console.error(`❌ Environment setup failed:`, error);
      process.exit(1);
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log('🔍 Validating configuration...');

    // Check if wrangler.jsonc exists
    const wranglerConfigPath = join(this.projectRoot, 'wrangler.jsonc');
    if (!existsSync(wranglerConfigPath)) {
      throw new Error('wrangler.jsonc not found');
    }

    // Validate required secrets for non-development environments
    if (this.config.environment !== 'development') {
      const requiredSecrets = ['OPENAI_API_KEY'];
      
      for (const secret of requiredSecrets) {
        if (!this.config.secrets[secret]) {
          throw new Error(`Missing required secret: ${secret}`);
        }
      }
    }

    console.log('✅ Configuration validation passed');
  }

  private async setupSecrets(): Promise<void> {
    console.log('🔐 Setting up secrets...');

    const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '';

    for (const [key, value] of Object.entries(this.config.secrets)) {
      if (value) {
        try {
          console.log(`Setting secret: ${key}`);
          
          // Use wrangler secret put to set the secret
          const command = `echo "${value}" | npx wrangler secret put ${key} ${envFlag}`;
          execSync(command, { 
            stdio: ['pipe', 'inherit', 'inherit'],
            cwd: this.projectRoot 
          });
          
          console.log(`✅ Secret ${key} set successfully`);
        } catch (error) {
          console.error(`❌ Failed to set secret ${key}:`, error);
          throw error;
        }
      }
    }

    console.log('✅ Secrets setup completed');
  }

  private async setupEnvironmentVariables(): Promise<void> {
    console.log('🌍 Setting up environment variables...');

    // For development, create/update .dev.vars file
    if (this.config.environment === 'development') {
      const devVarsPath = join(this.projectRoot, '.dev.vars');
      let devVarsContent = '';

      // Read existing .dev.vars if it exists
      if (existsSync(devVarsPath)) {
        devVarsContent = readFileSync(devVarsPath, 'utf-8');
      }

      // Add/update variables
      for (const [key, value] of Object.entries(this.config.vars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(devVarsContent)) {
          devVarsContent = devVarsContent.replace(regex, newLine);
        } else {
          devVarsContent += `\n${newLine}`;
        }
      }

      writeFileSync(devVarsPath, devVarsContent.trim() + '\n');
      console.log('✅ .dev.vars file updated');
    }

    // For staging/production, variables are set in wrangler.jsonc
    console.log('✅ Environment variables setup completed');
  }

  private async validateSetup(): Promise<void> {
    console.log('✅ Validating setup...');

    try {
      // Check if we can authenticate with Cloudflare
      const envFlag = this.config.environment !== 'development' ? `--env ${this.config.environment}` : '';
      execSync(`npx wrangler whoami`, { stdio: 'pipe' });
      
      console.log('✅ Cloudflare authentication validated');
    } catch (error) {
      console.warn('⚠️  Could not validate Cloudflare authentication');
    }

    console.log('✅ Setup validation completed');
  }
}

// Predefined environment configurations
const ENVIRONMENT_CONFIGS: Record<string, Partial<EnvironmentConfig>> = {
  development: {
    vars: {
      NODE_ENV: 'development',
    },
  },
  staging: {
    vars: {
      NODE_ENV: 'staging',
    },
  },
  production: {
    vars: {
      NODE_ENV: 'production',
    },
  },
};

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = (args[0] as EnvironmentConfig['environment']) || 'development';
  
  if (!['development', 'staging', 'production'].includes(environment)) {
    console.error('❌ Invalid environment. Use: development, staging, or production');
    process.exit(1);
  }

  // Get secrets from environment variables or prompt
  const secrets: Record<string, string> = {};
  
  if (environment !== 'development') {
    secrets.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    
    if (!secrets.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is required for staging/production');
      console.log('Set it with: export OPENAI_API_KEY=your-api-key');
      process.exit(1);
    }
  }

  const baseConfig = ENVIRONMENT_CONFIGS[environment] || {};
  const config: EnvironmentConfig = {
    environment,
    secrets,
    vars: baseConfig.vars || {},
  };

  const environmentManager = new EnvironmentManager(config);
  await environmentManager.setup();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { EnvironmentManager, type EnvironmentConfig };