# OAuth Setup Guide

This guide will help you configure Google and GitHub OAuth authentication for FireVision IPTV.

## Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.developers.google.com/apis/credentials
   - Sign in with your Google account

2. **Create a New Project** (if you don't have one)
   - Click "Select a project" → "New Project"
   - Enter project name: "FireVision IPTV"
   - Click "Create"

3. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Configure consent screen if prompted:
     - User Type: External
     - App name: FireVision IPTV
     - User support email: your email
     - Developer contact: your email
   - Application type: Web application
   - Name: FireVision IPTV Web Client
   - Authorized redirect URIs:
     - `http://localhost:8009/api/v1/auth/google/callback`
     - `http://your-domain.com/api/v1/auth/google/callback` (for production)
   - Click "Create"

5. **Copy Credentials**
   - Copy the Client ID
   - Copy the Client Secret
   - Add them to your `.env` file:
     ```
     GOOGLE_CLIENT_ID=your-client-id-here
     GOOGLE_CLIENT_SECRET=your-client-secret-here
     GOOGLE_REDIRECT_URI=http://localhost:8009/api/v1/auth/google/callback
     ```

## GitHub OAuth Setup

1. **Go to GitHub Developer Settings**
   - Visit: https://github.com/settings/developers
   - Sign in to your GitHub account

2. **Create a New OAuth App**
   - Click "OAuth Apps" → "New OAuth App"
   - Fill in the details:
     - Application name: FireVision IPTV
     - Homepage URL: `http://localhost:8009` (or your domain)
     - Application description: IPTV Channel Management System
     - Authorization callback URL: `http://localhost:8009/api/v1/auth/github/callback`
   - Click "Register application"

3. **Generate Client Secret**
   - Click "Generate a new client secret"
   - Copy the secret immediately (it won't be shown again)

4. **Copy Credentials**
   - Copy the Client ID
   - Copy the Client Secret
   - Add them to your `.env` file:
     ```
     GITHUB_CLIENT_ID=your-client-id-here
     GITHUB_CLIENT_SECRET=your-client-secret-here
     GITHUB_REDIRECT_URI=http://localhost:8009/api/v1/auth/github/callback
     ```

## Environment Variables

Your final `.env` file should include:

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789
GOOGLE_REDIRECT_URI=http://localhost:8009/api/v1/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=Ov23litABCDEF123456
GITHUB_CLIENT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
GITHUB_REDIRECT_URI=http://localhost:8009/api/v1/auth/github/callback
```

## Testing OAuth

1. **Restart the server** after updating environment variables
2. **Navigate to login page**: http://localhost:8009/user/login.html
3. **Click on "Sign in using Google"** or **"Sign in using GitHub"**
4. You should be redirected to the OAuth provider
5. After authorization, you'll be redirected back and logged in

## Production Deployment

For production:

1. **Update redirect URIs** in both Google and GitHub consoles to use your production domain
2. **Update .env file** with production URLs:
   ```env
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/v1/auth/google/callback
   GITHUB_REDIRECT_URI=https://yourdomain.com/api/v1/auth/github/callback
   ```

## Troubleshooting

### "OAuth is not configured" Error
- Check that environment variables are set correctly
- Restart the server after changing .env
- Verify the client IDs are not set to default values like "your-google-client-id"

### Redirect URI Mismatch
- Ensure the redirect URI in your .env matches exactly what you configured in OAuth console
- Include the protocol (http:// or https://)
- Port number must match (e.g., :8009)

### User Creation Issues
- Check MongoDB connection
- Verify User model has all required fields
- Check server logs for detailed error messages

## Security Notes

- Never commit `.env` file to version control
- Keep client secrets secure
- Use HTTPS in production
- Regularly rotate OAuth secrets
- Review OAuth scopes - only request what you need
