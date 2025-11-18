# FireVision IPTV Server - Setup Guide

## Overview

This guide will help you set up the FireVision IPTV Server with proper user management, authentication, and security features.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Super Admin Setup](#super-admin-setup)
5. [Building and Running](#building-and-running)
6. [First Login](#first-login)
7. [User Management](#user-management)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- MongoDB (included in docker-compose)
- Basic understanding of IPTV and M3U playlists

---

## Initial Setup

### 1. Clone or Navigate to Project Directory

```bash
cd FireVisionIPTVServer
```

### 2. Create Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

---

## Configuration

### 1. Edit `.env` File

Open `.env` and configure the following critical settings:

#### Server Configuration
```env
NODE_ENV=production
PORT=3000
```

#### Database Configuration
```env
MONGODB_URI=mongodb://mongodb:27017/firevision-iptv
```

#### Security Configuration (IMPORTANT - Change These!)
```env
API_KEY=your-unique-api-key-min-32-chars
SESSION_SECRET=your-unique-session-secret-min-32-chars
ALLOWED_ORIGINS=*
```

**Generate Secure Keys:**
```bash
# Generate random API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate random session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Super Admin Setup

### 1. Configure Super Admin Credentials

**CRITICAL SECURITY STEP:** Change these default credentials in `.env`:

```env
# Super Admin Initial Credentials
SUPER_ADMIN_USERNAME=your_admin_username
SUPER_ADMIN_PASSWORD=YourSecurePassword123!
SUPER_ADMIN_EMAIL=admin@yourdomain.com
```

**Password Requirements:**
- Minimum 6 characters
- Include uppercase, lowercase, numbers, and special characters
- Avoid common passwords

### 2. How Super Admin Works

- On first startup, the system automatically creates a super admin user
- Credentials are taken from environment variables
- Password is securely hashed using bcrypt (10 salt rounds)
- If super admin already exists, it won't be recreated
- A unique 6-character playlist code is automatically generated

### 3. Force Update Admin Password (Optional)

If you need to reset the super admin password:

```env
FORCE_UPDATE_ADMIN_PASSWORD=true
```

**WARNING:** This will update the password on next restart. Remove this variable after updating.

---

## Building and Running

### Using Docker Compose (Recommended)

#### 1. Build and Start Services

```bash
docker-compose up -d --build
```

This will:
- Build the Node.js API container
- Start MongoDB container
- Start Nginx reverse proxy
- Initialize the super admin user
- Expose services on configured ports

#### 2. Check Service Status

```bash
docker-compose ps
```

You should see:
- `firevision-mongodb` - Running
- `firevision-api` - Running
- `firevision-nginx` - Running

#### 3. View Logs

```bash
# All services
docker-compose logs -f

# API only
docker-compose logs -f api

# Look for super admin creation message
docker-compose logs api | grep "Super Admin"
```

Expected output:
```
✅ Super Admin user created successfully
   Username: your_admin_username
   Email: admin@yourdomain.com
   Playlist Code: ABC123
```

#### 4. Stop Services

```bash
docker-compose down
```

#### 5. Stop and Remove Data

```bash
docker-compose down -v
```

**WARNING:** This will delete all data including users and channels!

---

### Using Node.js Directly (Development)

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Start MongoDB Separately

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Or use local MongoDB installation
```

#### 3. Update MongoDB URI in `.env`

```env
MONGODB_URI=mongodb://localhost:27017/firevision-iptv
```

#### 4. Start the Server

```bash
npm start
```

---

## First Login

### 1. Access Admin Dashboard

Open your browser and navigate to:
```
http://localhost:8009/admin
```

Or if using Nginx:
```
http://localhost/admin
```

### 2. Login with Super Admin Credentials

Use the credentials you configured in `.env`:
- **Username:** `your_admin_username` (or `SUPER_ADMIN_USERNAME` value)
- **Password:** `YourSecurePassword123!` (or `SUPER_ADMIN_PASSWORD` value)

### 3. Verify Login

After successful login, you should see:
- Admin Dashboard with navigation menu
- User Management section
- Channel Management section
- Statistics overview

---

## User Management

### Creating Additional Users

#### 1. Navigate to User Management

Click "User Management" in the admin dashboard sidebar.

#### 2. Add New User

Click "Add User" button and fill in:
- **Username:** Unique username (3-50 characters)
- **Email:** Valid email address
- **Password:** Minimum 6 characters
- **Role:** Choose "Admin" or "User"
  - **Admin:** Full access to dashboard and all features
  - **User:** Only access to their playlist
- **Active:** Enable/disable user account

#### 3. Assign Channels to User

1. Find the user in the user list
2. Click "Assign Channels" button
3. Select channels from the list
4. Click "Save"

**Note:**
- Admins get access to ALL channels automatically
- Regular users only get assigned channels

#### 4. Generate Playlist Code

Each user gets a unique 6-character playlist code (e.g., `ABC123`)

Users can access their playlist at:
```
http://localhost:8009/api/v1/tv/playlist/ABC123
```

---

## API Usage

### Authentication

All API calls (except public endpoints) require authentication.

#### 1. Login to Get Session ID

```bash
curl -X POST http://localhost:8009/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_admin_username",
    "password": "YourSecurePassword123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123def456...",
  "user": { ... }
}
```

#### 2. Use Session ID in Subsequent Requests

```bash
curl -X GET http://localhost:8009/api/v1/users \
  -H "X-Session-Id: abc123def456..."
```

### Session Management

- Sessions expire after 24 hours
- Sessions are stored in MongoDB
- Users can have multiple active sessions
- View active sessions: `GET /api/v1/auth/sessions`
- Revoke session: `DELETE /api/v1/auth/sessions/:sessionId`

---

## Security Best Practices

### 1. Change Default Credentials

- Never use default credentials in production
- Use strong, unique passwords
- Store credentials securely

### 2. Use HTTPS in Production

Update Nginx configuration to enable SSL:
```bash
# Place SSL certificates in nginx/ssl/
# Edit nginx/nginx.conf to enable SSL
```

### 3. Configure CORS Properly

In production, set specific origins:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

### 4. Enable Rate Limiting

Uncomment rate limiting in `src/server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);
```

### 5. Regular Security Updates

```bash
# Update dependencies
npm audit
npm audit fix

# Rebuild containers
docker-compose build --no-cache
```

### 6. Backup Database

```bash
# Backup MongoDB data
docker-compose exec mongodb mongodump --out=/backup

# Copy backup from container
docker cp firevision-mongodb:/backup ./mongodb-backup
```

### 7. Monitor Logs

```bash
# Watch for suspicious activity
docker-compose logs -f api | grep "401\|403\|500"
```

---

## Troubleshooting

### Super Admin Not Created

**Problem:** Can't login with super admin credentials

**Solution:**
1. Check logs:
   ```bash
   docker-compose logs api | grep -i "admin"
   ```

2. Verify environment variables:
   ```bash
   docker-compose exec api env | grep SUPER_ADMIN
   ```

3. Manually check database:
   ```bash
   docker-compose exec mongodb mongosh firevision-iptv
   db.users.find({role: 'Admin'}).pretty()
   ```

4. Force recreate super admin:
   ```env
   FORCE_UPDATE_ADMIN_PASSWORD=true
   ```
   Then restart: `docker-compose restart api`

---

### Login Returns "Invalid credentials"

**Possible Causes:**

1. **Wrong credentials** - Double-check `.env` file
2. **User not active** - Check `isActive` field in database
3. **Database not connected** - Check MongoDB container status
4. **Password hash mismatch** - Force update password

**Fix:**
```bash
# Restart all services
docker-compose restart

# Check MongoDB connection
docker-compose logs mongodb

# Verify user exists
docker-compose exec mongodb mongosh firevision-iptv --eval "db.users.find().pretty()"
```

---

### Session Expired Error

**Problem:** Session expires too quickly

**Solution:**

1. Check session duration in `src/routes/auth.js`:
   ```javascript
   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
   ```

2. Extend session duration by modifying the value

3. Clear expired sessions:
   ```bash
   curl -X POST http://localhost:8009/api/v1/auth/cleanup-sessions
   ```

---

### Can't Access Admin Dashboard

**Problem:** 404 error or blank page

**Solution:**

1. Verify static files are being served:
   ```bash
   ls -la public/admin/
   ```

2. Check server logs:
   ```bash
   docker-compose logs api
   ```

3. Access directly via port 8009:
   ```
   http://localhost:8009/admin
   ```

4. Check Nginx configuration if using reverse proxy

---

### Database Connection Errors

**Problem:** "MongoDB connection error"

**Solution:**

1. Check MongoDB container status:
   ```bash
   docker-compose ps mongodb
   ```

2. Verify MongoDB is healthy:
   ```bash
   docker-compose exec mongodb mongosh --eval "db.serverStatus()"
   ```

3. Check MongoDB URI in `.env`:
   ```env
   MONGODB_URI=mongodb://mongodb:27017/firevision-iptv
   ```

4. Restart MongoDB:
   ```bash
   docker-compose restart mongodb
   ```

---

### Port Already in Use

**Problem:** "Port 8009 is already in use"

**Solution:**

1. Change port in `docker-compose.yml`:
   ```yaml
   ports:
     - "8010:3000"  # Change 8009 to 8010
   ```

2. Or stop conflicting service:
   ```bash
   # Find process using port 8009
   lsof -i :8009

   # Kill process
   kill -9 <PID>
   ```

---

## Next Steps

1. ✅ Login to admin dashboard
2. ✅ Change super admin password via UI
3. ✅ Create additional admin and user accounts
4. ✅ Import channels via M3U or add manually
5. ✅ Assign channels to users
6. ✅ Test playlist access via TV apps
7. ✅ Configure SSL for production
8. ✅ Set up automated backups

---

## Additional Resources

- [API Documentation](./API_DOCUMENTATION.md)
- [User Management Guide](./docs/user-management.md)
- [Channel Management Guide](./docs/channel-management.md)
- [Deployment Guide](./docs/deployment.md)

---

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review API documentation
- Check MongoDB data directly
- Verify environment configuration

---

**Version:** 1.0.0
**Last Updated:** 2024-11-19
