# FireVision IPTV Server - API Documentation

## Table of Contents
- [Authentication](#authentication)
- [User Management](#user-management)
- [Channel Management](#channel-management)
- [Admin Operations](#admin-operations)
- [TV/Playlist](#tvplaylist)
- [App Version Management](#app-version-management)

---

## Base URL
```
http://localhost:8009/api/v1
```

## Authentication

All authenticated endpoints require the `X-Session-Id` header with a valid session ID obtained from login.

### Headers
```
X-Session-Id: <session_id>
Content-Type: application/json
```

---

## Authentication Endpoints

### 1. Login
**POST** `/auth/login`

Authenticate user and create a session.

**Request Body:**
```json
{
  "username": "superadmin",
  "password": "ChangeMeNow123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "sessionId": "abc123def456...",
  "user": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "superadmin",
    "email": "admin@firevision.local",
    "role": "Admin",
    "playlistCode": "ABC123",
    "isActive": true,
    "lastLogin": "2024-11-19T10:30:00.000Z"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

### 2. Logout
**POST** `/auth/logout`

**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 3. Get Current User
**GET** `/auth/me`

**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "superadmin",
    "email": "admin@firevision.local",
    "role": "Admin",
    "playlistCode": "ABC123",
    "isActive": true,
    "lastLogin": "2024-11-19T10:30:00.000Z",
    "channels": [],
    "metadata": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-11-19T10:30:00.000Z"
  }
}
```

---

### 4. Change Password
**POST** `/auth/change-password`

**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully. Other sessions have been logged out."
}
```

---

### 5. Get All Sessions
**GET** `/auth/sessions`

Get all active sessions for the current user.

**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "64f7a8b9c1d2e3f4a5b6c7d8",
      "sessionId": "abc123def456...",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-11-19T10:00:00.000Z",
      "expiresAt": "2024-11-20T10:00:00.000Z",
      "lastActivity": "2024-11-19T10:30:00.000Z",
      "isCurrent": true
    }
  ]
}
```

---

### 6. Revoke Session
**DELETE** `/auth/sessions/:sessionId`

**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

## User Management Endpoints

### 1. Get All Users
**GET** `/users`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "64f7a8b9c1d2e3f4a5b6c7d8",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "User",
      "playlistCode": "XYZ789",
      "isActive": true,
      "lastLogin": "2024-11-19T09:00:00.000Z",
      "channels": [
        {
          "channelName": "HBO",
          "channelGroup": "Movies"
        }
      ],
      "createdAt": "2024-01-15T00:00:00.000Z",
      "updatedAt": "2024-11-19T09:00:00.000Z"
    }
  ]
}
```

---

### 2. Create User
**POST** `/users`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "username": "jane_doe",
  "password": "SecurePass123!",
  "email": "jane@example.com",
  "role": "User",
  "isActive": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "jane_doe",
    "email": "jane@example.com",
    "role": "User",
    "playlistCode": "DEF456",
    "isActive": true
  }
}
```

---

### 3. Get User by ID
**GET** `/users/:id`

**Auth Required:** Admin or own profile
**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "jane_doe",
    "email": "jane@example.com",
    "role": "User",
    "playlistCode": "DEF456",
    "isActive": true,
    "channels": [],
    "lastLogin": null,
    "createdAt": "2024-11-19T10:00:00.000Z"
  }
}
```

---

### 4. Update User
**PUT** `/users/:id`

**Auth Required:** Admin or own profile
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "username": "jane_smith",
  "email": "jane.smith@example.com",
  "password": "NewPassword123!",
  "role": "Admin",
  "isActive": false
}
```

**Note:** Only admins can change `role` and `isActive` fields.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "jane_smith",
    "email": "jane.smith@example.com",
    "role": "Admin",
    "isActive": false
  }
}
```

---

### 5. Delete User
**DELETE** `/users/:id`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### 6. Assign Channels to User
**POST** `/users/:id/channels`

Replace all user channels with the provided list.

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "channelIds": [
    "64f7a8b9c1d2e3f4a5b6c7d8",
    "64f7a8b9c1d2e3f4a5b6c7d9"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Channels assigned successfully",
  "data": {
    "userId": "64f7a8b9c1d2e3f4a5b6c7d8",
    "channelsCount": 2
  }
}
```

---

### 7. Add Channels to User
**POST** `/users/:id/channels/add`

Add channels to user without removing existing ones.

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "channelIds": [
    "64f7a8b9c1d2e3f4a5b6c7da"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Added 1 channels",
  "data": {
    "userId": "64f7a8b9c1d2e3f4a5b6c7d8",
    "channelsCount": 3,
    "addedCount": 1
  }
}
```

---

### 8. Remove Channels from User
**POST** `/users/:id/channels/remove`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "channelIds": [
    "64f7a8b9c1d2e3f4a5b6c7d8"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Removed 1 channels",
  "data": {
    "userId": "64f7a8b9c1d2e3f4a5b6c7d8",
    "channelsCount": 2,
    "removedCount": 1
  }
}
```

---

### 9. Regenerate Playlist Code
**PUT** `/users/:id/regenerate-code`

**Auth Required:** Admin or own profile
**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Playlist code regenerated successfully",
  "data": {
    "playlistCode": "GHI789"
  }
}
```

---

## Channel Management Endpoints

### 1. Get All Channels
**GET** `/channels`

**Auth:** Not required

**Response (200 OK):**
```json
{
  "success": true,
  "count": 150,
  "data": [
    {
      "id": "64f7a8b9c1d2e3f4a5b6c7d8",
      "channelId": "hbo-hd",
      "channelName": "HBO HD",
      "channelUrl": "http://example.com/stream/hbo.m3u8",
      "channelImg": "http://example.com/logos/hbo.png",
      "channelGroup": "Movies",
      "isActive": true,
      "order": 1
    }
  ]
}
```

---

### 2. Get Channels Grouped by Category
**GET** `/channels/grouped`

**Auth:** Not required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "Movies": [
      {
        "id": "64f7a8b9c1d2e3f4a5b6c7d8",
        "channelName": "HBO HD",
        "channelUrl": "http://example.com/stream/hbo.m3u8"
      }
    ],
    "Sports": []
  }
}
```

---

### 3. Search Channels
**GET** `/channels/search?q=hbo`

**Auth:** Not required

**Query Parameters:**
- `q` (required): Search query

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "64f7a8b9c1d2e3f4a5b6c7d8",
      "channelName": "HBO HD",
      "channelGroup": "Movies"
    }
  ]
}
```

---

## Admin Channel Endpoints

### 1. Get All Channels (Including Inactive)
**GET** `/admin/channels`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "count": 200,
  "data": []
}
```

---

### 2. Create Channel
**POST** `/admin/channels`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "channelId": "espn-hd",
  "channelName": "ESPN HD",
  "channelUrl": "http://example.com/stream/espn.m3u8",
  "channelImg": "http://example.com/logos/espn.png",
  "channelGroup": "Sports",
  "isActive": true,
  "order": 10
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "channelId": "espn-hd",
    "channelName": "ESPN HD"
  }
}
```

---

### 3. Update Channel
**PUT** `/admin/channels/:id`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "channelName": "ESPN HD Updated",
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "channelName": "ESPN HD Updated",
    "isActive": false
  }
}
```

---

### 4. Delete Channel
**DELETE** `/admin/channels/:id`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Channel deleted successfully"
}
```

---

### 5. Import M3U Playlist
**POST** `/admin/channels/import-m3u`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**
```json
{
  "m3uUrl": "http://example.com/playlist.m3u",
  "replaceExisting": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Imported 50 channels successfully",
  "imported": 50,
  "skipped": 5,
  "errors": 0
}
```

---

## TV/Playlist Endpoints

### 1. Get Playlist by Code
**GET** `/tv/playlist/:code`

Get M3U playlist for a user by their 6-character playlist code.

**Auth:** Not required

**Response (200 OK):**
```m3u
#EXTM3U
#EXTINF:-1 tvg-id="hbo-hd" tvg-name="HBO HD" tvg-logo="http://example.com/logos/hbo.png" group-title="Movies",HBO HD
http://example.com/stream/hbo.m3u8
```

---

### 2. Get Playlist as JSON
**GET** `/tv/playlist/:code/json`

**Auth:** Not required

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "username": "john_doe",
    "playlistCode": "XYZ789"
  },
  "channels": [
    {
      "channelName": "HBO HD",
      "channelUrl": "http://example.com/stream/hbo.m3u8",
      "channelGroup": "Movies"
    }
  ]
}
```

---

### 3. Verify Playlist Code
**GET** `/tv/verify/:code`

**Auth:** Not required

**Response (200 OK):**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "username": "john_doe",
    "isActive": true
  }
}
```

---

### 4. Pair Device
**POST** `/tv/pair`

**Auth:** Not required

**Request Body:**
```json
{
  "playlistCode": "XYZ789",
  "deviceName": "Samsung Smart TV",
  "deviceModel": "QN65Q80TAFXZA"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device paired successfully",
  "user": {
    "username": "john_doe",
    "playlistCode": "XYZ789"
  }
}
```

---

## App Version Management

### 1. Check for Updates
**GET** `/app/version?currentVersion=100`

**Auth:** Not required

**Query Parameters:**
- `currentVersion` (required): Current app version code

**Response (200 OK):**
```json
{
  "success": true,
  "updateAvailable": true,
  "latestVersion": {
    "versionName": "1.2.0",
    "versionCode": 120,
    "downloadUrl": "http://localhost:8009/apks/firevision-v1.2.0.apk",
    "releaseNotes": "Bug fixes and improvements",
    "isMandatory": false,
    "apkFileSize": 25600000
  }
}
```

---

### 2. Get Latest Version
**GET** `/app/latest`

**Auth:** Not required

**Response (200 OK):**
```json
{
  "success": true,
  "version": {
    "versionName": "1.2.0",
    "versionCode": 120,
    "downloadUrl": "http://localhost:8009/apks/firevision-v1.2.0.apk",
    "releaseNotes": "Bug fixes and improvements"
  }
}
```

---

### 3. Download Latest APK
**GET** `/app/apk`

**Auth:** Not required

Downloads the latest APK file.

---

### 4. Upload New APK (Admin)
**POST** `/admin/app/upload`

**Auth Required:** Admin only
**Headers:** `X-Session-Id: <session_id>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `apk`: APK file
- `versionName`: Version name (e.g., "1.2.0")
- `versionCode`: Version code (e.g., 120)
- `releaseNotes`: Release notes
- `isMandatory`: Boolean (optional)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "APK uploaded successfully",
  "version": {
    "versionName": "1.2.0",
    "versionCode": 120,
    "downloadUrl": "http://localhost:8009/apks/firevision-v1.2.0.apk"
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limiting

Currently disabled. Can be enabled in production by uncommenting rate limiting middleware in `server.js`.

---

## Session Management

- Sessions expire after 24 hours
- Sessions are stored in MongoDB
- Use `X-Session-Id` header for all authenticated requests
- Multiple sessions per user are supported
- Users can view and revoke their active sessions

---

## Security Notes

1. Always use HTTPS in production
2. Change default super admin credentials before deployment
3. Use strong, unique values for `API_KEY` and `SESSION_SECRET`
4. Enable rate limiting in production
5. Configure CORS `ALLOWED_ORIGINS` properly
6. Never commit `.env` file to version control
7. Regularly rotate session secrets and API keys

---

## Quick Start

1. Copy `.env.example` to `.env` and configure variables
2. Update super admin credentials in `.env`
3. Start the server: `docker-compose up -d`
4. Access admin dashboard: `http://localhost:8009/admin`
5. Login with super admin credentials
6. Create additional users and manage channels

---

**Version:** 1.0.0
**Last Updated:** 2024-11-19
