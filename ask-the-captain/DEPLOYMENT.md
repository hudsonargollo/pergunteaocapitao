# Deployment Guide

This guide covers the deployment process for the Ask the Captain application to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Workers enabled
2. **API Token**: Create a Cloudflare API token with the following permissions:
   - Account: Cloudflare Workers:Edit
   - Zone: Zone Settings:Read, Zone:Read
   - Account: Account Settings:Read
3. **OpenAI API Key**: Required for production deployments
4. **Node.js**: Version 20 or higher
5. **Wrangler CLI**: Installed via npm (included in dependencies)

## Environment Setup

### 1. Development Environment

```bash
# Set up development environment
npm run setup:dev

# Start development server
npm run dev
```

### 2. Staging Environment

```bash
# Set required environment variables
export CLOUDFLARE_API_TOKEN=your-api-token
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export OPENAI_API_KEY=your-openai-api-key

# Set up staging environment
npm run setup:staging

# Deploy to staging
npm run deploy:staging
```

### 3. Production Environment

```bash
# Set required environment variables
export CLOUDFLARE_API_TOKEN=your-api-token
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export OPENAI_API_KEY=your-openai-api-key

# Set up production environment
npm run setup:production

# Deploy to production
npm run deploy:production
```

## Deployment Commands

### Quick Commands

```bash
# Development deployment (local testing)
npm run deploy:dev

# Staging deployment
npm run deploy:staging

# Production deployment
npm run deploy:production

# Quick development deployment (skip build and migrations)
npm run deploy:quick
```

### Manual Deployment Steps

If you prefer to run deployment steps manually:

```bash
# 1. Build the application
npm run build

# 2. Deploy to Cloudflare Workers
npx wrangler deploy --env production

# 3. Run database migrations
npx wrangler d1 migrations apply --env production --remote

# 4. Check deployment health
curl -f https://your-domain.com/api/health
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow for automated deployments:

### Workflow Triggers

- **Staging**: Pushes to `main` branch
- **Production**: Pushes to `production` branch
- **Pull Requests**: Run tests and build validation

### Required GitHub Secrets

Set these secrets in your GitHub repository settings:

```
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
OPENAI_API_KEY=your-openai-api-key
STAGING_URL=https://your-staging-domain.com
PRODUCTION_URL=https://your-production-domain.com
```

### Workflow Steps

1. **Test**: Run unit tests and linting
2. **Build**: Build the Next.js application
3. **Deploy**: Deploy to Cloudflare Workers
4. **Migrate**: Run database migrations
5. **Health Check**: Verify deployment success

## Environment Configuration

### Cloudflare Resources

Each environment uses separate Cloudflare resources:

#### Development
- Worker: `ask-the-captain` (local development)
- Database: Local D1 instance
- Vectorize: Local index
- R2: Local bucket

#### Staging
- Worker: `ask-the-captain-staging`
- Database: `ask-the-captain-db-staging`
- Vectorize: `ask-the-captain-knowledge-base-staging`
- R2: `ask-the-captain-images-staging`

#### Production
- Worker: `ask-the-captain-production`
- Database: `ask-the-captain-db-production`
- Vectorize: `ask-the-captain-knowledge-base-production`
- R2: `ask-the-captain-images-production`

### Environment Variables

#### Development (.dev.vars)
```
NODE_ENV=development
OPENAI_API_KEY=your-dev-api-key
```

#### Staging/Production (Wrangler Secrets)
```
OPENAI_API_KEY=your-production-api-key
```

## Database Migrations

### Running Migrations

```bash
# Local development
npm run db:migrate:local

# Remote environments
npm run db:migrate:remote

# Using the migration script
npm run db:migrate

# Check migration status
npm run db:migrate:status
```

### Creating New Migrations

1. Create a new SQL file in the `migrations/` directory
2. Follow the naming convention: `XXXX_description.sql`
3. Test locally before deploying

## Knowledge Base Ingestion

After deployment, populate the knowledge base:

```bash
# Run document ingestion
npm run ingest-docs
```

This will:
1. Process all documents in `modocaverna-docs.md`
2. Extract text from PDFs in `aulas-modocaverna-cavefocus/`
3. Generate embeddings using OpenAI
4. Store vectors in Cloudflare Vectorize

## Health Monitoring

### Health Check Endpoint

The application includes a comprehensive health check at `/api/health`:

```bash
# Check application health
curl https://your-domain.com/api/health

# Simple uptime check
curl -I https://your-domain.com/api/health
```

### Health Check Response

```json
{
  "timestamp": "2025-01-08T10:00:00.000Z",
  "environment": "production",
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "vectorize": { "status": "healthy" },
    "r2": { "status": "healthy" },
    "openai": { "status": "healthy" }
  },
  "responseTime": 150,
  "version": "0.1.0"
}
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```bash
# Check Wrangler authentication
npx wrangler whoami

# Login if needed
npx wrangler login
```

#### 2. Resource Creation Failures
```bash
# Check if resources exist
npx wrangler d1 list
npx wrangler vectorize list
npx wrangler r2 bucket list
```

#### 3. Migration Failures
```bash
# Check migration status
npx wrangler d1 migrations list --env production

# Apply specific migration
npx wrangler d1 migrations apply --env production --remote
```

#### 4. Build Failures
```bash
# Clear build cache
rm -rf .next .open-next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Logs and Debugging

```bash
# View Worker logs
npx wrangler tail --env production

# View deployment logs
npx wrangler deployments list

# Debug specific deployment
npx wrangler deployments view <deployment-id>
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Secrets Management**: Use Wrangler secrets for sensitive data
3. **Environment Isolation**: Keep staging and production separate
4. **Access Control**: Limit Cloudflare API token permissions
5. **HTTPS**: Always use HTTPS in production

## Performance Optimization

1. **Edge Caching**: Leverage Cloudflare's edge cache
2. **Smart Placement**: Enabled for optimal performance
3. **Resource Limits**: Monitor Worker CPU and memory usage
4. **Database Optimization**: Use appropriate indexes
5. **Image Optimization**: Compress images before storage

## Rollback Procedures

### Quick Rollback

```bash
# List recent deployments
npx wrangler deployments list --env production

# Rollback to previous deployment
npx wrangler rollback <deployment-id> --env production
```

### Database Rollback

Database rollbacks require manual intervention:

1. Identify the problematic migration
2. Create a rollback migration
3. Test in staging first
4. Apply to production

## Support and Monitoring

### Monitoring Setup

1. **Cloudflare Analytics**: Monitor request patterns
2. **Worker Metrics**: Track performance and errors
3. **Custom Alerts**: Set up alerts for critical failures
4. **Health Checks**: Regular automated health monitoring

### Getting Help

1. Check the health endpoint first
2. Review Worker logs with `wrangler tail`
3. Check GitHub Actions for CI/CD issues
4. Review Cloudflare dashboard for resource status