# Portainer Deployment Guide

This guide explains how to deploy FireVision IPTV Server to production using GitHub Actions and Portainer.

## Overview

The deployment process consists of two stages:

1. **Build & Release** (Automated): Triggered by Git tags, builds Docker images and creates GitHub releases
2. **Deploy to Portainer** (Manual): Triggered manually, deploys the latest release to Portainer

## Prerequisites

- Portainer instance running and accessible
- GHCR (GitHub Container Registry) for image storage
- GitHub repository with Actions enabled
- Production server with Docker installed

## Setup Instructions

### 1. Configure Portainer

#### Create API Token

1. Log in to your Portainer instance
2. Go to **User settings** → **Access tokens**
3. Click **Add access token**
4. Name it `github-actions-deploy`
5. Copy the token (you won't see it again!)

#### Create Stack

1. Go to **Stacks** → **Add stack**
2. Name it `firevision-iptv-production`
3. Use the Web editor and paste the contents of `docker-compose.production.yml`
4. Add environment variables (or use GitHub Secrets)
5. Click **Deploy the stack**
6. Note the **Stack ID** from the URL (e.g., `/stacks/5` means ID is `5`)

#### Get Endpoint ID

1. Go to **Endpoints**
2. Note the ID of your Docker endpoint (usually `1` or `2`)

### 2. Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

#### Container Registry

Images are published to GHCR (`ghcr.io/akshaynikhare/firevisioniptvserver`). No extra secrets are needed -- the workflow uses `GITHUB_TOKEN` automatically.

#### Portainer Secrets

| Secret Name             | Description              | Example                         |
| ----------------------- | ------------------------ | ------------------------------- |
| `PORTAINER_URL`         | Portainer instance URL   | `https://portainer.example.com` |
| `PORTAINER_API_TOKEN`   | API token from Portainer | `ptr_xxxxx`                     |
| `PORTAINER_STACK_ID`    | Stack ID                 | `5`                             |
| `PORTAINER_ENDPOINT_ID` | Endpoint ID              | `1`                             |

#### Application Secrets

| Secret Name                  | Description                  | How to Generate                                                    |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `MONGODB_URI`                | MongoDB connection string    | `mongodb://mongodb:27017/firevision-iptv`                          |
| `REDIS_URL`                  | Redis connection string      | `redis://redis:6379`                                               |
| `JWT_SECRET`                 | JWT signing secret           | `openssl rand -base64 32`                                          |
| `JWT_REFRESH_SECRET`         | Refresh token secret         | `openssl rand -base64 32`                                          |
| `API_KEY`                    | Admin API key                | `openssl rand -hex 32`                                             |
| `GITHUB_TOKEN`               | GitHub personal access token | From GitHub Settings → Developer settings → Personal access tokens |
| `GITHUB_REPO_OWNER`          | GitHub repository owner      | `akshaynikhare`                                                    |
| `GITHUB_REPO_NAME`           | GitHub repository name       | `FireVisionIPTV`                                                   |
| `OAUTH_GOOGLE_CLIENT_ID`     | Google OAuth client ID       | From Google Cloud Console                                          |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth secret          | From Google Cloud Console                                          |
| `OAUTH_GITHUB_CLIENT_ID`     | GitHub OAuth client ID       | From GitHub OAuth Apps                                             |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth secret          | From GitHub OAuth Apps                                             |
| `BREVO_HOST`                 | Brevo SMTP host              | `smtp-relay.brevo.com`                                             |
| `BREVO_PORT`                 | Brevo SMTP port              | `587`                                                              |
| `BREVO_USER`                 | Brevo SMTP key               | From Brevo dashboard                                               |
| `BREVO_PASSWORD`             | Brevo SMTP password          | From Brevo dashboard                                               |

### 3. Test the Deployment Workflow

#### Create a Test Release

```bash
# Create a test tag
git tag v1.0.0-test
git push origin v1.0.0-test
```

This will trigger the **Build and Publish** workflow, which will:

- Build the Docker image
- Push to GHCR (`ghcr.io/akshaynikhare/firevisioniptvserver`)
- Create a GitHub release

#### Deploy to Portainer

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Portainer** workflow
3. Click **Run workflow**
4. Select **production** environment
5. Leave version empty (will use latest)
6. Click **Run workflow**

The workflow will:

- Fetch the latest release (`v1.0.0-test`)
- Extract the Docker image tag
- Update the Portainer stack
- Wait for containers to start
- Run health checks
- Report deployment status

### 4. Monitor Deployment

#### GitHub Actions

Watch the workflow execution in the Actions tab. The workflow will show:

- ✅ Each step's success/failure
- 📊 Deployment summary
- 🏥 Health check results

#### Portainer

1. Go to **Stacks** → `firevision-iptv-production`
2. Check container status
3. View logs for each service

#### Application Health

Visit the health endpoint:

```bash
curl https://tv.cadnative.com/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 10.5,
  "mongodb": "connected",
  "redis": "connected",
  "version": "1.0.0-test"
}
```

## Deployment Workflow Details

### Workflow File

`.github/workflows/docker-publish.yml`

### Trigger

Manual via `workflow_dispatch` with inputs:

- `version` (optional): Specific version to deploy
- `environment` (required): Target environment (production/staging)

### Steps

1. **Checkout repository**: Get the latest code
2. **Get latest release**: Fetch release info from GitHub API
3. **Extract Docker image tag**: Parse image tag from release
4. **Prepare production docker-compose**: Create compose file with secrets
5. **Deploy to Portainer**: Update stack via Portainer API
6. **Wait for deployment**: Allow containers to start (30s)
7. **Health check**: Verify service health (10 retries, 10s interval)
8. **Deployment summary**: Generate summary report
9. **Comment on release**: Add deployment info to GitHub release

### Health Check Logic

The workflow performs comprehensive health checks:

```bash
# Check endpoint availability
GET https://tv.cadnative.com/health

# Verify response status
HTTP 200 OK

# Verify service connections
{
  "mongodb": "connected",
  "redis": "connected"
}
```

If health checks fail after 10 attempts (100 seconds), the workflow fails and reports the issue.

## Troubleshooting

### Deployment Fails

**Check Portainer API Token:**

```bash
curl -H "X-API-Key: YOUR_TOKEN" \
  https://portainer.example.com/api/status
```

**Check Stack ID:**

```bash
curl -H "X-API-Key: YOUR_TOKEN" \
  https://portainer.example.com/api/stacks
```

**Check Endpoint ID:**

```bash
curl -H "X-API-Key: YOUR_TOKEN" \
  https://portainer.example.com/api/endpoints
```

### Health Check Fails

**Check container logs in Portainer:**

1. Go to **Stacks** → `firevision-iptv-production`
2. Click on a container
3. View **Logs**

**Check MongoDB connection:**

```bash
docker exec firevision-mongodb mongosh --eval "db.adminCommand('ping')"
```

**Check Redis connection:**

```bash
docker exec firevision-redis redis-cli ping
```

**Check API logs:**

```bash
docker logs firevision-api
```

### Image Not Found

**Verify image exists on GHCR:**

```bash
docker pull ghcr.io/akshaynikhare/firevisioniptvserver:1.0.0
```

**GHCR authentication uses GITHUB_TOKEN automatically -- no extra secrets needed.**

### Environment Variables Not Set

**Verify secrets are configured in GitHub:**

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Check all required secrets are present

**Check Portainer stack environment:**

1. Go to **Stacks** → `firevision-iptv-production`
2. Click **Editor**
3. Verify environment variables are set

## Rollback Procedure

If a deployment fails or causes issues:

### Option 1: Deploy Previous Version

1. Go to **Actions** → **Deploy to Portainer**
2. Click **Run workflow**
3. Enter the previous version (e.g., `v1.0.0`)
4. Click **Run workflow**

### Option 2: Manual Rollback in Portainer

1. Go to **Stacks** → `firevision-iptv-production`
2. Click **Editor**
3. Change the image tag to previous version
4. Click **Update the stack**

### Option 3: Redeploy from Portainer

1. Go to **Stacks** → `firevision-iptv-production`
2. Click **Redeploy**
3. Select **Pull latest image**
4. Click **Redeploy**

## Best Practices

### Version Tagging

Use semantic versioning for releases:

- `v1.0.0` - Major release
- `v1.1.0` - Minor release (new features)
- `v1.1.1` - Patch release (bug fixes)

### Pre-deployment Checklist

- [ ] All tests pass in CI
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Environment variables updated
- [ ] Backup created
- [ ] Rollback plan ready

### Post-deployment Checklist

- [ ] Health check passes
- [ ] All services connected
- [ ] API endpoints responding
- [ ] No errors in logs
- [ ] Monitor for 15 minutes
- [ ] Update documentation

### Monitoring

Set up monitoring for:

- Application uptime
- API response times
- Error rates
- Database connections
- Memory/CPU usage

## Security Considerations

### Secrets Management

- Never commit secrets to Git
- Rotate secrets regularly (every 90 days)
- Use strong, randomly generated secrets
- Limit access to GitHub Secrets
- Use separate secrets for staging/production

### API Token Security

- Create dedicated API tokens for automation
- Set appropriate permissions (minimum required)
- Rotate tokens regularly
- Revoke unused tokens
- Monitor token usage

### Network Security

- Use HTTPS for all connections
- Configure firewall rules
- Limit Portainer API access
- Use VPN for sensitive operations
- Enable audit logging

## Support

For issues or questions:

- Check GitHub Actions logs
- Review Portainer container logs
- Consult the main README.md
- Open a GitHub issue
- Contact: support@cadnative.com
