# FireVision IPTV Server - API Documentation

## Table of Contents

- [Authentication](#authentication)
- [JWT Authentication](#jwt-authentication)
- [Public Signup](#public-signup)
- [User Management](#user-management)
- [User Playlist](#user-playlist)
- [Channel Management](#channel-management)
- [Admin Operations](#admin-operations)
- [TV/Playlist](#tvplaylist)
- [PIN-Based TV Pairing](#pin-based-tv-pairing)
- [App Version Management](#app-version-management)
- [Config Endpoints](#config-endpoints)
- [Proxy Endpoints](#proxy-endpoints)

---

## Base URL

```
http://localhost:8009/api/v1
```

## Authentication

All authenticated endpoints require either the `X-Session-Id` header with a valid session ID obtained from login, or an `Authorization: Bearer <token>` header with a valid JWT access token.

### Headers

```
X-Session-Id: <session_id>
Content-Type: application/json
```

or

```
Authorization: Bearer <access_token>
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
    "channelListCode": "ABC123",
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
    "channelListCode": "ABC123",
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

## JWT Authentication

### 1. JWT Login

**POST** `/jwt/login`

Authenticate user and receive JWT access and refresh tokens.

**Request Body:**

```json
{
  "username": "user",
  "password": "pass"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "user",
    "role": "User",
    "channelListCode": "ABC123"
  }
}
```

---

### 2. Refresh Access Token

**POST** `/jwt/refresh`

Exchange a refresh token for a new access token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 3. JWT Logout

**POST** `/jwt/logout`

Invalidate a refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 4. Get Current User (JWT)

**GET** `/jwt/me`

**Headers:** `Authorization: Bearer <access_token>`

**Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "user",
    "email": "user@example.com",
    "role": "User",
    "channelListCode": "ABC123",
    "isActive": true
  }
}
```

---

### 5. Get Playlist (JWT)

**GET** `/jwt/playlist.m3u`

Returns the authenticated user's M3U playlist.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200 OK):**

```m3u
#EXTM3U
#EXTINF:-1 tvg-id="hbo-hd" tvg-name="HBO HD" tvg-logo="http://example.com/logos/hbo.png" group-title="Movies",HBO HD
http://example.com/stream/hbo.m3u8
```

---

## Public Signup

### 1. Register New Account

**POST** `/public/signup`

Create a new user account. Rate limited to 10 requests per hour.

**Auth:** Not required

**Request Body:**

```json
{
  "username": "new_user",
  "email": "newuser@example.com",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "64f7a8b9c1d2e3f4a5b6c7d8",
    "username": "new_user",
    "email": "newuser@example.com",
    "role": "User",
    "channelListCode": "XYZ789"
  }
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
      "channelListCode": "XYZ789",
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
    "channelListCode": "DEF456",
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
    "channelListCode": "DEF456",
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
  "channelIds": ["64f7a8b9c1d2e3f4a5b6c7d8", "64f7a8b9c1d2e3f4a5b6c7d9"]
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
  "channelIds": ["64f7a8b9c1d2e3f4a5b6c7da"]
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
  "channelIds": ["64f7a8b9c1d2e3f4a5b6c7d8"]
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
    "channelListCode": "GHI789"
  }
}
```

---

## User Playlist

Endpoints for users to manage their own channel playlists.

### 1. Get My Channels

**GET** `/user-playlist/me/channels`

**Auth Required:** Yes (Session or JWT)

**Response (200 OK):**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "64f7a8b9c1d2e3f4a5b6c7d8",
      "channelName": "HBO HD",
      "channelUrl": "http://example.com/stream/hbo.m3u8",
      "channelImg": "http://example.com/logos/hbo.png",
      "channelGroup": "Movies"
    }
  ]
}
```

---

### 2. Replace My Channels

**PUT** `/user-playlist/me/channels`

Replace all channels in the user's playlist.

**Auth Required:** Yes (Session or JWT)

**Request Body:**

```json
{
  "channelIds": ["64f7a8b9c1d2e3f4a5b6c7d8", "64f7a8b9c1d2e3f4a5b6c7d9"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Channels updated successfully",
  "data": {
    "channelsCount": 2
  }
}
```

---

### 3. Add Channels to My Playlist

**POST** `/user-playlist/me/channels/add`

Add channels without removing existing ones.

**Auth Required:** Yes (Session or JWT)

**Request Body:**

```json
{
  "channelIds": ["64f7a8b9c1d2e3f4a5b6c7da"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Added 1 channels",
  "data": {
    "channelsCount": 6,
    "addedCount": 1
  }
}
```

---

### 4. Remove Channels from My Playlist

**POST** `/user-playlist/me/channels/remove`

**Auth Required:** Yes (Session or JWT)

**Request Body:**

```json
{
  "channelIds": ["64f7a8b9c1d2e3f4a5b6c7d8"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Removed 1 channels",
  "data": {
    "channelsCount": 5,
    "removedCount": 1
  }
}
```

---

### 5. Get My M3U Playlist

**GET** `/user-playlist/me/playlist.m3u`

Returns the authenticated user's channels as an M3U playlist file.

**Auth Required:** Yes (Session or JWT)

**Response (200 OK):**

```m3u
#EXTM3U
#EXTINF:-1 tvg-id="hbo-hd" tvg-name="HBO HD" tvg-logo="http://example.com/logos/hbo.png" group-title="Movies",HBO HD
http://example.com/stream/hbo.m3u8
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

## Stream Metrics Endpoints

### 1. Report Stream Status

**POST** `/channels/:id/report-status`

**Auth:** TV code or session auth

**Request Body:**

```json
{
  "status": "dead",
  "deviceId": "device-abc-123"
}
```

- `status` (required): One of `dead`, `alive`, `unresponsive`
- `deviceId` (required): Unique device identifier

**Rate Limit:** 1 report per channel per device per 5 minutes

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "channelId": "64f7a8b9c1d2e3f4a5b6c7d8",
    "status": "dead",
    "metrics": {
      "deadCount": 5,
      "aliveCount": 42,
      "unresponsiveCount": 1,
      "playCount": 30,
      "lastDeadAt": "2026-03-18T10:00:00.000Z"
    }
  }
}
```

---

### 2. Report Successful Playback

**POST** `/channels/:id/report-play`

**Auth:** TV code or session auth

**Request Body:**

```json
{
  "deviceId": "device-abc-123"
}
```

**Rate Limit:** 1 report per channel per device per 1 minute

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "channelId": "64f7a8b9c1d2e3f4a5b6c7d8",
    "metrics": {
      "deadCount": 5,
      "aliveCount": 42,
      "unresponsiveCount": 1,
      "playCount": 31,
      "lastPlayedAt": "2026-03-18T10:05:00.000Z"
    }
  }
}
```

---

### 3. Bulk Health Sync

**POST** `/channels/health-sync`

**Auth:** TV code or session auth

**Request Body:**

```json
{
  "deviceId": "device-abc-123",
  "reports": [
    { "channelId": "64f7a8b9c1d2e3f4a5b6c7d8", "status": "alive" },
    { "channelId": "64f7a8b9c1d2e3f4a5b6c7d9", "status": "dead" },
    { "channelId": "64f7a8b9c1d2e3f4a5b6c7da", "status": "played" }
  ]
}
```

- `reports` array: max 100 items, each with `channelId` and `status` (dead, alive, unresponsive, played)

**Rate Limit:** 1 sync per device per 5 minutes

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "updated": 2,
    "failed": 0,
    "skipped": 1
  }
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
    "channelListCode": "XYZ789"
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
  "code": "XYZ789",
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
    "channelListCode": "XYZ789"
  }
}
```

---

## PIN-Based TV Pairing

A secure pairing flow where the TV displays a PIN that the user enters on the web dashboard.

### 1. Request Pairing PIN

**POST** `/tv/pairing/request`

TV generates a PIN to display on screen. The user then enters this PIN on the web dashboard.

**Auth:** Not required

**Request Body:**

```json
{
  "deviceName": "Samsung TV",
  "deviceModel": "QN65"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "pin": "842736",
  "expiresAt": "2026-03-16T10:10:00.000Z",
  "expiryMinutes": 10,
  "message": "Enter this PIN on the web dashboard to pair your device"
}
```

---

### 2. Check Pairing Status

**GET** `/tv/pairing/status/:pin`

TV polls this endpoint to check whether the user has confirmed pairing.

**Auth:** Not required

**Response (200 OK) - Pending:**

```json
{
  "success": true,
  "status": "pending",
  "message": "Waiting for user to confirm pairing"
}
```

**Response (200 OK) - Completed:**

```json
{
  "success": true,
  "status": "completed",
  "user": {
    "username": "john_doe",
    "channelListCode": "5T6FEP",
    "role": "User"
  }
}
```

**Response (410 Gone) - Expired:**

```json
{
  "success": false,
  "status": "expired",
  "message": "Pairing PIN has expired"
}
```

---

### 3. Confirm Pairing

**POST** `/tv/pairing/confirm`

Web dashboard confirms the pairing by submitting the PIN.

**Auth Required:** Yes
**Headers:** `X-Session-Id: <session_id>`

**Request Body:**

```json
{
  "pin": "842736",
  "sessionId": "abc123..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Device paired successfully",
  "device": {
    "name": "Samsung TV",
    "model": "QN65"
  },
  "user": {
    "username": "john_doe",
    "channelListCode": "5T6FEP",
    "role": "User"
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
  "latestVersion": "v1.5",
  "latestVersionCode": 5,
  "currentVersion": 100,
  "isMandatory": false,
  "releaseNotes": "Bug fixes and improvements",
  "downloadUrl": "https://github.com/akshaynikhare/FireVisionIPTV/releases/download/v1.5/app-release.apk",
  "minCompatibleVersion": 1
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
  "data": {
    "versionName": "v1.5",
    "versionCode": 5,
    "releaseNotes": "Bug fixes and improvements",
    "apkFileName": "app-release.apk",
    "apkFileSize": 25600000,
    "downloadUrl": "https://github.com/.../app-release.apk",
    "isMandatory": false,
    "releasedAt": "2026-01-15T10:00:00.000Z"
  }
}
```

---

### 3. Download Latest APK

**GET** `/app/apk`

**Auth:** Not required

Redirects to the latest APK download URL on GitHub Releases.

---

### 4. Get Download URL

**GET** `/app/download-url`

Returns the download URL as JSON instead of redirecting.

**Auth:** Not required

**Response (200 OK):**

```json
{
  "success": true,
  "downloadUrl": "https://github.com/akshaynikhare/FireVisionIPTV/releases/download/v1.5/app-release.apk"
}
```

---

### 5. Get Version History

**GET** `/app/versions`

Returns version history. Versions are managed via GitHub Releases.

**Auth:** Not required

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "versionName": "v1.5",
      "versionCode": 5,
      "releaseNotes": "Bug fixes and improvements",
      "downloadUrl": "https://github.com/.../app-release.apk",
      "releasedAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

---

## Config Endpoints

### 1. Get Default Configuration

**GET** `/config/defaults`

Returns default configuration values for client applications.

**Auth:** Not required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "defaultTvCode": "5T6FEP",
    "defaultServerUrl": "https://tv.cadnative.com",
    "pairingPinExpiryMinutes": 10,
    "appName": "FireVision IPTV",
    "version": "1.0.0"
  }
}
```

---

### 2. Get Server Info

**GET** `/config/info`

Returns server name, version, and available features.

**Auth:** Not required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "name": "FireVision IPTV Server",
    "version": "1.0.0",
    "features": {
      "publicSignup": true,
      "pinPairing": true,
      "jwtAuth": true
    }
  }
}
```

---

## Proxy Endpoints

### 1. Image Proxy

**GET** `/image-proxy?url=<encoded_url>`

Proxies and caches channel logo images. Cached with a 24-hour TTL.

**Auth:** Not required

**Query Parameters:**

- `url` (required): URL-encoded image URL

**Response:** Proxied image with appropriate content-type headers.

---

### 2. Stream Proxy

**GET** `/stream-proxy?url=<encoded_url>`

Proxies HLS and other media streams with CORS headers.

**Auth Required:** Yes
**Headers:** `X-Session-Id: <session_id>`

**Query Parameters:**

- `url` (required): URL-encoded stream URL

**Response:** Proxied stream content with CORS headers.

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
- `410 Gone`: Resource expired (e.g., pairing PIN)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

Rate limiting is enabled: 1000 requests per 15 minutes for general API endpoints, 20 requests per 15 minutes for auth endpoints (`/auth/login`, `/auth/register`, `/jwt/login`).

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
3. Use strong, unique values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `SUPER_ADMIN_PASSWORD`
4. Enable rate limiting in production
5. Configure CORS `ALLOWED_ORIGINS` properly
6. Never commit `.env` file to version control
7. Regularly rotate JWT secrets and credentials

---

## Quick Start

1. Copy `.env.example` to `.env` and configure variables
2. Update super admin credentials in `.env`
3. Start the server: `docker-compose up -d`
4. Access admin dashboard: `http://localhost:8009/admin`
5. Login with super admin credentials
6. Create additional users and manage channels

---

## Smart Stream Grouping & Fallback Endpoints

### 1. Get Grouped Channels (IPTV-org)

`GET /api/v1/iptv-org/api/grouped`

Returns IPTV-org channels grouped by channelId with ranked streams.

**Query Parameters:** `country`, `language`, `languages`, `category`, `status`, `search`, `limit` (default 50), `skip` (default 0)

**Response:**

```json
{
  "success": true,
  "count": 1234,
  "data": [{
    "channelId": "IndiaToday.in",
    "channelName": "India Today",
    "tvgLogo": "...",
    "country": "IN",
    "categories": ["news"],
    "streamCount": 3,
    "bestStream": { "streamUrl": "...", "quality": "1080p", "liveness": {...} },
    "streams": [...]
  }]
}
```

### 2. Import Grouped Channels

`POST /api/v1/iptv-org/import-grouped` (Admin)

Import channels with primary stream + alternate streams.

**Body:**

```json
{
  "channels": [{
    "channelId": "...",
    "channelName": "...",
    "selectedStreamUrl": "...",
    "alternateStreams": [{ "streamUrl": "...", "quality": "720p", "liveness": {...} }],
    "tvgLogo": "...",
    "channelGroup": "...",
    "metadata": {}
  }],
  "replaceExisting": false
}
```

### 3. Get Channel with Fallbacks

`GET /api/v1/channels/:id/with-fallbacks`

Returns channel with only alive, non-flagged alternate streams sorted by ranking.

### 4. Get User Channels with Fallbacks

`GET /api/v1/user-playlist/me/channels-with-fallbacks`

Same as `/me/channels` but includes filtered alternate streams for each channel.

### 5. Flag Primary Stream

`POST /api/v1/channels/:id/flag` (Any authenticated user)

**Body:** `{ "reason": "looping" | "frozen" | "wrong-content" | "other" }`

### 6. Unflag Primary Stream

`POST /api/v1/channels/:id/unflag` (Admin only)

### 7. Flag Alternate Stream

`POST /api/v1/channels/:id/alternates/:index/flag` (Any authenticated user)

**Body:** `{ "reason": "looping" | "frozen" | "wrong-content" | "other" }`

### 8. Unflag Alternate Stream

`POST /api/v1/channels/:id/alternates/:index/unflag` (Admin only)

---

**Version:** 2.1.0
**Last Updated:** 2026-03-18
