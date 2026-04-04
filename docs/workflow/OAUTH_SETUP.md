# OAuth Setup

Configure Google and/or GitHub OAuth for "Sign in with..." on the dashboard.

## Quick Reference

| Provider | Console                                                                                 | Redirect URI (dev)                                  | Redirect URI (prod)                            |
| -------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Google   | [console.developers.google.com](https://console.developers.google.com/apis/credentials) | `http://localhost:8009/api/v1/auth/google/callback` | `https://<domain>/api/v1/auth/google/callback` |
| GitHub   | [github.com/settings/developers](https://github.com/settings/developers)                | `http://localhost:8009/api/v1/auth/github/callback` | `https://<domain>/api/v1/auth/github/callback` |

## Environment Variables

Create OAuth credentials in each provider's console, then add to `.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_REDIRECT_URI=http://localhost:8009/api/v1/auth/google/callback

# GitHub OAuth
GH_OAUTH_CLIENT_ID=<client-id>
GH_OAUTH_CLIENT_SECRET=<client-secret>
GH_OAUTH_REDIRECT_URI=http://localhost:8009/api/v1/auth/github/callback
```

Restart the server after updating `.env`.

## Production

Update redirect URIs in both the provider console and `.env` to use your production domain with HTTPS:

```env
GOOGLE_REDIRECT_URI=https://tv.cadnative.com/api/v1/auth/google/callback
GH_OAUTH_REDIRECT_URI=https://tv.cadnative.com/api/v1/auth/github/callback
```

## Troubleshooting

| Error                     | Fix                                                               |
| ------------------------- | ----------------------------------------------------------------- |
| "OAuth is not configured" | Verify env vars are set (not placeholder values), restart server  |
| Redirect URI mismatch     | Env var must match console exactly — protocol, domain, port, path |
| User creation fails       | Check MongoDB connection, check server logs                       |
