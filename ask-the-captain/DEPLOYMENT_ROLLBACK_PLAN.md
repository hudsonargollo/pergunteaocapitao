# Deployment Rollback Plan

## Overview
This document outlines the rollback procedures for the Ask the Captain application deployment on Cloudflare Workers.

## Pre-Deployment Checklist
- [ ] Backup current production deployment
- [ ] Verify staging environment is working
- [ ] Confirm all environment variables are set
- [ ] Test critical user flows in staging
- [ ] Verify knowledge base is accessible
- [ ] Check image generation fallbacks work

## Rollback Triggers
Execute rollback if any of the following occur:
- Application fails to start
- Critical API endpoints return 5xx errors
- Chat interface is non-functional
- Image generation system completely fails
- Database connectivity issues
- Performance degradation > 50%

## Rollback Procedures

### 1. Immediate Rollback (< 5 minutes)
```bash
# Rollback to previous deployment
wrangler deploy --name ask-the-captain-production --rollback

# Or deploy specific version
wrangler deploy --name ask-the-captain-production --compatibility-date 2025-03-01
```

### 2. Database Rollback (if needed)
```bash
# Restore database from backup
wrangler d1 restore ask-the-captain-production --from-backup [BACKUP_ID]

# Verify database integrity
wrangler d1 execute ask-the-captain-production --command "SELECT COUNT(*) FROM GeneratedImages;"
```

### 3. Asset Rollback
```bash
# Clear R2 cache if needed
wrangler r2 object delete ask-the-captain-images --prefix "cache/"

# Restore critical assets
wrangler r2 object put ask-the-captain-images/fallback-images/ --file ./public/reference*.webp
```

### 4. Configuration Rollback
```bash
# Restore environment variables
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production

# Verify configuration
wrangler secret list --env production
```

## Verification Steps
After rollback, verify:
1. Application loads at https://ask-the-captain.workers.dev
2. Health endpoint returns 200: `/api/health`
3. Chat interface accepts input
4. Captain image displays correctly
5. Error handling works properly

## Communication Plan
1. Notify stakeholders immediately
2. Update status page if available
3. Document rollback reason and resolution
4. Schedule post-mortem if needed

## Recovery Testing
Before next deployment:
1. Identify root cause of failure
2. Fix issues in development
3. Test thoroughly in staging
4. Update deployment procedures
5. Consider gradual rollout strategy

## Emergency Contacts
- Technical Lead: [Contact Info]
- DevOps Team: [Contact Info]
- Cloudflare Support: [Support Ticket System]

## Monitoring
Monitor these metrics post-rollback:
- Response times < 500ms
- Error rate < 1%
- Availability > 99.9%
- Memory usage < 80%
- CPU usage < 70%