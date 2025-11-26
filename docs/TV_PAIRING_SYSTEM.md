# TV Pairing System - Technical Documentation

## Overview

The FireVision IPTV server implements **two distinct pairing methods** for Android TV devices:
1. **Legacy Code-Based Pairing** - Direct channel list code entry
2. **PIN-Based Pairing** - Modern PIN-flow for easier pairing

This document explains both systems, their architecture, and how TV device information is stored.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Models](#data-models)
3. [Pairing Method 1: Code-Based](#method-1-code-based-pairing)
4. [Pairing Method 2: PIN-Based](#method-2-pin-based-pairing)
5. [TV Storage in Database](#tv-storage-in-database)
6. [API Endpoints](#api-endpoints)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Android TV │ ◄─────► │   API Server │ ◄─────► │   MongoDB   │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                         │
      │                        │                         │
      ├─ Generate PIN          ├─ Store Pairing         ├─ Users
      ├─ Enter Code            ├─ Validate Code         ├─ Channels
      ├─ Poll Status           ├─ Authenticate          ├─ PairingRequests
      └─ Fetch Playlist        └─ Return Data           └─ Sessions
```

### Key Components

1. **Android TV App** (`FireVisionIPTV/`)
   - `PairingActivity.java` - Handles PIN-based pairing
   - `SettingsActivity.java` - Allows manual code entry
   - `MainActivity.java` - Fetches and displays channels

2. **Server Routes** (`FireVisionIPTVServer/src/routes/`)
   - `tv.js` - TV-specific endpoints (no auth required)
   - `auth.js` - Web dashboard authentication
   - `channels.js` - Channel management

3. **Database Models** (`FireVisionIPTVServer/src/models/`)
   - `User.js` - User accounts with channel list codes
   - `PairingRequest.js` - Temporary PIN-based pairing records
   - `Channel.js` - IPTV channel definitions

---

## Data Models

### User Model

The `User` model is the primary entity for TV pairing. Each user has:

```javascript
{
  _id: ObjectId,
  username: String,           // Unique username
  email: String,              // User email
  password: String,           // Hashed password (bcrypt)
  role: "Admin" | "User",     // Access level
  channelListCode: String,    // 6-character unique code (e.g., "5T6FEP")
  isActive: Boolean,          // Account status
  channels: [ObjectId],       // Assigned channel IDs (User role only)
  
  // TV Device Metadata
  metadata: {
    deviceName: String,       // e.g., "Samsung Smart TV"
    deviceModel: String,      // e.g., "QN65Q80AAFXZA"
    lastPairedDevice: String, // Last paired device name
    pairedAt: Date            // Timestamp of last pairing
  },
  
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Important Notes:**
- `channelListCode` is **generated automatically** when a user is created
- This code is used by TV devices to identify the user
- **No separate TV device records** are stored (see [TV Storage](#tv-storage-in-database))

### PairingRequest Model

Temporary pairing records used for PIN-based flow:

```javascript
{
  _id: ObjectId,
  pin: String,                // 6-digit numeric PIN (e.g., "123456")
  deviceName: String,         // TV device name
  deviceModel: String,        // TV model number
  status: "pending" | "completed" | "expired",
  userId: ObjectId,           // Linked user (null until confirmed)
  expiresAt: Date,            // PIN expiry time (default: 10 minutes)
  ipAddress: String,          // TV IP address
  userAgent: String,          // TV user agent
  createdAt: Date,
  updatedAt: Date
}
```

**Important Notes:**
- PINs are **temporary** and expire after 10 minutes (configurable)
- MongoDB **TTL index** automatically deletes expired records after 1 hour
- No permanent TV device records are created

---

## Method 1: Code-Based Pairing

### How It Works

The TV user manually enters a **6-character channel list code** provided by the admin.

### Step-by-Step Flow

```
1. Admin creates user account
   └─> Server generates unique channelListCode (e.g., "5T6FEP")

2. Admin shares channelListCode with end user
   └─> Via email, phone, or in-person

3. User opens Android TV app settings
   └─> Enters server URL: https://tv.cadnative.com
   └─> Enters channel list code: 5T6FEP

4. TV app makes API call
   └─> POST /api/v1/tv/pair
       Body: { code: "5T6FEP", deviceName: "Samsung TV", deviceModel: "QN65" }

5. Server validates code
   └─> Finds User where channelListCode = "5T6FEP" AND isActive = true
   └─> Updates user.metadata with device info
   └─> Returns success with username and channel count

6. TV app stores code locally
   └─> SharedPreferences: { tv_code: "5T6FEP", server_url: "..." }

7. TV app fetches playlist
   └─> GET /api/v1/tv/playlist/5T6FEP/json
   └─> Server returns user's assigned channels
```

### API Endpoint: Pair Device

**POST** `/api/v1/tv/pair`

**Request Body:**
```json
{
  "code": "5T6FEP",
  "deviceName": "Samsung Smart TV",
  "deviceModel": "QN65Q80AAFXZA"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Device paired successfully",
  "data": {
    "username": "john_doe",
    "channelListCode": "5T6FEP",
    "channelsCount": 42
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid or inactive channel list code"
}
```

### Database Changes

When pairing happens:
```javascript
// User document is updated
{
  username: "john_doe",
  channelListCode: "5T6FEP",
  metadata: {
    lastPairedDevice: "Samsung Smart TV",    // ← Updated
    deviceModel: "QN65Q80AAFXZA",             // ← Updated
    pairedAt: "2025-11-27T10:30:00.000Z"      // ← Updated
  },
  lastLogin: "2025-11-27T10:30:00.000Z"       // ← Updated
}
```

**No separate TV device record is created.**

---

## Method 2: PIN-Based Pairing

### How It Works

Modern pairing flow using a **temporary 6-digit PIN** displayed on TV, entered on web dashboard.

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: TV Generates PIN                                  │
└─────────────────────────────────────────────────────────────┘

1. User opens Android TV app
   └─> First launch OR clicks "Pair with PIN" in settings

2. TV app requests pairing PIN
   └─> POST /api/v1/tv/pairing/request
       Body: { deviceName: "Samsung TV", deviceModel: "QN65" }

3. Server generates unique PIN
   └─> Creates PairingRequest document with 6-digit PIN (e.g., "842736")
   └─> Sets expiry time (now + 10 minutes)
   └─> Returns PIN to TV

4. TV displays PIN on screen
   └─> Large 120sp text: "842736"
   └─> Shows countdown timer: "Expires in 9:45"
   └─> Instructions: "Visit tv.cadnative.com and enter this PIN"


┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: User Confirms on Web Dashboard                   │
└─────────────────────────────────────────────────────────────┘

5. User logs into web dashboard (admin or user portal)
   └─> POST /api/v1/auth/login
   └─> Receives sessionId

6. User navigates to "Pair TV Device" page
   └─> /admin/pair-device.html OR /user/pair-device.html

7. User enters PIN in web form
   └─> Input: "842736"
   └─> Clicks "Pair Device"

8. Web dashboard confirms pairing
   └─> POST /api/v1/tv/pairing/confirm
       Headers: { X-Session-Id: "abc123..." }
       Body: { pin: "842736", sessionId: "abc123..." }

9. Server validates and links
   └─> Finds PairingRequest where pin = "842736" AND status = "pending"
   └─> Validates user session (X-Session-Id)
   └─> Links PairingRequest.userId = session.userId
   └─> Updates PairingRequest.status = "completed"
   └─> Updates User.metadata with device info


┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: TV Detects Confirmation                           │
└─────────────────────────────────────────────────────────────┘

10. TV app polls for status
    └─> Every 3 seconds: GET /api/v1/tv/pairing/status/842736

11. Server returns completion
    └─> { paired: true, status: "completed", channelListCode: "5T6FEP" }

12. TV app receives channel list code
    └─> Saves to SharedPreferences: { tv_code: "5T6FEP" }
    └─> Shows success message: "Welcome, john_doe!"
    └─> Redirects to MainActivity

13. TV app loads channels
    └─> GET /api/v1/tv/playlist/5T6FEP/json
    └─> Displays user's channel list
```

### API Endpoints: PIN-Based Pairing

#### 1. Request Pairing PIN

**POST** `/api/v1/tv/pairing/request`

**Request Body:**
```json
{
  "deviceName": "Samsung Smart TV",
  "deviceModel": "QN65Q80AAFXZA"
}
```

**Response:**
```json
{
  "success": true,
  "pin": "842736",
  "expiresAt": "2025-11-27T10:40:00.000Z",
  "expiryMinutes": 10,
  "message": "Enter this PIN on the web dashboard to pair your device"
}
```

#### 2. Check Pairing Status (Polling)

**GET** `/api/v1/tv/pairing/status/:pin`

**Request:**
```
GET /api/v1/tv/pairing/status/842736
```

**Response (Pending):**
```json
{
  "success": true,
  "paired": false,
  "status": "pending",
  "expiresAt": "2025-11-27T10:40:00.000Z",
  "message": "Waiting for user to confirm pairing on web dashboard..."
}
```

**Response (Completed):**
```json
{
  "success": true,
  "paired": true,
  "status": "completed",
  "channelListCode": "5T6FEP",
  "username": "john_doe",
  "role": "User",
  "message": "Device paired successfully!"
}
```

**Response (Expired):**
```json
{
  "success": false,
  "paired": false,
  "status": "expired",
  "message": "PIN has expired. Please request a new one."
}
```

#### 3. Confirm Pairing (Web Dashboard)

**POST** `/api/v1/tv/pairing/confirm`

**Headers:**
```
X-Session-Id: abc123def456...
```

**Request Body:**
```json
{
  "pin": "842736",
  "sessionId": "abc123def456..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Device paired successfully",
  "device": {
    "name": "Samsung Smart TV",
    "model": "QN65Q80AAFXZA"
  },
  "user": {
    "username": "john_doe",
    "channelListCode": "5T6FEP",
    "role": "User"
  }
}
```

**Response (Error - Invalid PIN):**
```json
{
  "success": false,
  "error": "Invalid or expired PIN. The TV may have generated a new PIN or the PIN has already been used."
}
```

**Response (Error - Not Logged In):**
```json
{
  "success": false,
  "error": "Authentication required. Please log in."
}
```

### Database Changes

#### PairingRequest Document Lifecycle

**Created (Step 2):**
```javascript
{
  _id: ObjectId("..."),
  pin: "842736",
  deviceName: "Samsung Smart TV",
  deviceModel: "QN65Q80AAFXZA",
  status: "pending",
  userId: null,                          // Not yet linked
  expiresAt: "2025-11-27T10:40:00.000Z",
  ipAddress: "192.168.1.100",
  userAgent: "Dalvik/2.1.0 (Linux; U; Android 11)",
  createdAt: "2025-11-27T10:30:00.000Z",
  updatedAt: "2025-11-27T10:30:00.000Z"
}
```

**Updated (Step 9 - After Confirmation):**
```javascript
{
  _id: ObjectId("..."),
  pin: "842736",
  deviceName: "Samsung Smart TV",
  deviceModel: "QN65Q80AAFXZA",
  status: "completed",                   // ← Changed
  userId: ObjectId("user_123"),          // ← Linked to user
  expiresAt: "2025-11-27T10:40:00.000Z",
  ipAddress: "192.168.1.100",
  userAgent: "Dalvik/2.1.0 (Linux; U; Android 11)",
  createdAt: "2025-11-27T10:30:00.000Z",
  updatedAt: "2025-11-27T10:32:15.000Z"  // ← Updated
}
```

**Auto-Deleted (1 Hour After Expiry):**
MongoDB TTL index automatically removes documents 1 hour after `expiresAt`.

#### User Document Updated

```javascript
{
  _id: ObjectId("user_123"),
  username: "john_doe",
  channelListCode: "5T6FEP",
  metadata: {
    lastPairedDevice: "Samsung Smart TV",     // ← Updated
    deviceModel: "QN65Q80AAFXZA",              // ← Updated
    pairedAt: "2025-11-27T10:32:15.000Z"       // ← Updated
  },
  lastLogin: "2025-11-27T10:32:15.000Z"        // ← Updated
}
```

---

## TV Storage in Database

### ❌ TVs Are NOT Stored as Separate Records

**Key Point:** The system **does not create dedicated TV device documents**. Instead:

1. **Device metadata is stored in User model**
   - Each user's `metadata` object contains info about the **last paired device**
   - This includes: `deviceName`, `deviceModel`, `pairedAt`

2. **PairingRequest records are temporary**
   - Only exist during the PIN-based pairing process
   - Automatically deleted 1 hour after expiry
   - Not used for long-term device tracking

### Why This Design?

#### Pros:
✅ **Simple Architecture** - One code per user, stored in User model  
✅ **No Device Clutter** - Database doesn't accumulate old TV records  
✅ **Easy Revocation** - Changing/resetting code unpairs all devices  
✅ **Stateless for TVs** - TVs don't need accounts, just use the code  

#### Cons:
❌ **No Multi-Device Tracking** - Can't see list of all paired TVs per user  
❌ **Last Device Only** - Only stores info about most recent pairing  
❌ **No Device Management** - Can't selectively unpair specific TVs  

### Example: Multiple TVs, One User

**Scenario:**
- User "john_doe" has code "5T6FEP"
- Pairs TV #1 (Living Room) → `metadata.lastPairedDevice = "Living Room TV"`
- Pairs TV #2 (Bedroom) → `metadata.lastPairedDevice = "Bedroom TV"` (overwrites)

**Result:**
- Both TVs can use code "5T6FEP" to access channels
- User document only shows "Bedroom TV" (last pairing)
- No record of "Living Room TV" exists

**Database State:**
```javascript
// Single User document
{
  username: "john_doe",
  channelListCode: "5T6FEP",
  metadata: {
    lastPairedDevice: "Bedroom TV",           // Only latest device
    deviceModel: "TCL 55S425",
    pairedAt: "2025-11-27T12:00:00.000Z"      // Only latest pairing time
  }
}

// No TV device documents exist
```

### Checking Active TVs

**Current Limitation:**
- Cannot query "how many TVs are actively using code 5T6FEP"
- `lastLogin` timestamp shows last access, but not per-device

**Workaround:**
- Check server logs for `/api/v1/tv/playlist/5T6FEP` requests
- Analyze IP addresses and User-Agent strings
- Use external analytics tools

### Future Enhancement: Multi-Device Support

To track multiple devices per user, consider:

```javascript
// Modified User schema
{
  username: "john_doe",
  channelListCode: "5T6FEP",
  devices: [                                  // Array of devices
    {
      deviceId: "unique_device_id_1",
      deviceName: "Living Room TV",
      deviceModel: "Samsung QN65",
      pairedAt: "2025-11-27T10:00:00.000Z",
      lastSeen: "2025-11-27T15:30:00.000Z",
      ipAddress: "192.168.1.100"
    },
    {
      deviceId: "unique_device_id_2",
      deviceName: "Bedroom TV",
      deviceModel: "TCL 55S425",
      pairedAt: "2025-11-27T12:00:00.000Z",
      lastSeen: "2025-11-27T16:00:00.000Z",
      ipAddress: "192.168.1.101"
    }
  ]
}
```

**Benefits:**
- Admin can see all paired devices
- Can revoke individual devices
- Better analytics and monitoring

**Implementation Needed:**
- TV app generates unique `deviceId` (UUID)
- Include `deviceId` in all API requests
- Server updates `devices[]` array on each login

---

## API Endpoints Summary

### TV Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tv/playlist/:code` | Get M3U playlist by code |
| GET | `/api/v1/tv/playlist/:code/json` | Get JSON playlist by code |
| POST | `/api/v1/tv/pair` | Pair device with code (legacy) |
| GET | `/api/v1/tv/verify/:code` | Verify code validity |
| POST | `/api/v1/tv/pairing/request` | Generate PIN for pairing |
| GET | `/api/v1/tv/pairing/status/:pin` | Check PIN status (polling) |
| POST | `/api/v1/tv/pairing/confirm` | Confirm pairing (web dashboard) |

### Authentication Required

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | None | Login to get session |
| POST | `/api/v1/tv/pairing/confirm` | Session | Confirm PIN pairing |

---

## Security Considerations

### 1. Channel List Code Protection

**Security Measure:**
- Codes are **6 characters** (alphanumeric)
- Possible combinations: **2.2 billion** (36^6)
- Brute-force impractical

**Recommendations:**
- Use HTTPS to encrypt code transmission
- Implement rate limiting on `/api/v1/tv/pair` endpoint
- Monitor for suspicious code verification attempts

### 2. PIN Expiry

**Security Measure:**
- PINs expire after **10 minutes** (configurable)
- Prevents stale PIN abuse
- TTL index auto-deletes old records

**Configuration:**
```env
PAIRING_PIN_EXPIRY_MINUTES=10
```

### 3. Session Validation

**Security Measure:**
- PIN confirmation requires **valid session ID**
- Session must belong to active user
- Prevents unauthorized pairing

**Implementation:**
```javascript
// Verify session in pairing confirm
const session = await Session.findOne({ sessionId }).populate('userId');
if (!session || !session.isValid()) {
  return res.status(401).json({ error: 'Invalid session' });
}
```

### 4. No TV Authentication

**Design Decision:**
- TV endpoints do NOT require authentication
- TVs use channel list code as "password"
- Simplifies TV app development

**Trade-offs:**
- ✅ Easier for end users (no login on TV)
- ❌ Anyone with code can access channels
- ⚠️ Suitable for household use, not enterprise

### 5. IP Logging

**Security Measure:**
- PairingRequest stores IP address
- Helps identify suspicious activity
- Can implement IP-based rate limiting

**Example:**
```javascript
{
  pin: "842736",
  ipAddress: "192.168.1.100",     // Logged
  userAgent: "Dalvik/2.1.0 ..."    // Logged
}
```

### 6. HTTPS in Production

**Critical:**
```nginx
# Nginx config
server {
  listen 443 ssl;
  server_name tv.cadnative.com;
  ssl_certificate /etc/letsencrypt/live/tv.cadnative.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tv.cadnative.com/privkey.pem;
  
  location /api/ {
    proxy_pass http://localhost:8009;
  }
}
```

---

## Troubleshooting

### Problem: TV Can't Generate PIN

**Symptoms:**
- "Connection error" message on TV
- PairingActivity shows loading spinner indefinitely

**Possible Causes:**
1. Server not running
2. Wrong server URL in TV settings
3. Network connectivity issue
4. Firewall blocking port

**Solutions:**
```bash
# 1. Check if server is running
docker-compose ps
# Should show 'api' container as 'Up'

# 2. Test endpoint from TV network
curl -X POST https://tv.cadnative.com/api/v1/tv/pairing/request \
  -H "Content-Type: application/json" \
  -d '{"deviceName":"Test","deviceModel":"Test"}'

# 3. Check server logs
docker-compose logs -f api

# 4. Verify firewall rules
sudo ufw status
# Port 8009 should be allowed
```

### Problem: PIN Expired Before User Confirmed

**Symptoms:**
- Web dashboard shows "PIN has expired" error
- TV shows expired status

**Solutions:**
1. **Increase expiry time:**
   ```env
   # .env file
   PAIRING_PIN_EXPIRY_MINUTES=30
   ```

2. **Generate new PIN:**
   - TV: Press "Generate New PIN" button
   - Confirm quickly on web dashboard

3. **Check clock sync:**
   ```bash
   # On server
   timedatectl status
   # Ensure NTP is active
   ```

### Problem: Pairing Confirmed But TV Not Updating

**Symptoms:**
- Web dashboard shows success
- TV still shows "Waiting for confirmation..."

**Possible Causes:**
1. TV polling stopped (app backgrounded)
2. Network dropped on TV
3. Database write failed

**Solutions:**
1. **Keep TV app in foreground**
   - Ensure PairingActivity is active
   - Don't press Home button

2. **Check MongoDB:**
   ```javascript
   db.pairingrequests.findOne({ pin: "842736" })
   // Verify status is "completed" and userId is set
   ```

3. **Restart pairing:**
   - Press "Generate New PIN" on TV
   - Start over

### Problem: Invalid Code Error

**Symptoms:**
- TV shows "Invalid or inactive channel list code"

**Solutions:**
1. **Verify code in database:**
   ```javascript
   db.users.findOne({ channelListCode: "5T6FEP" })
   // Check if user exists and isActive: true
   ```

2. **Check for typos:**
   - Code is case-insensitive on server
   - Must be exactly 6 characters

3. **Verify user is active:**
   ```javascript
   db.users.updateOne(
     { channelListCode: "5T6FEP" },
     { $set: { isActive: true } }
   )
   ```

### Problem: Multiple Devices Overwriting Metadata

**Symptoms:**
- User pairs multiple TVs
- Only last device shows in `metadata`

**Explanation:**
- This is **expected behavior**
- Current design only stores last paired device
- See [TV Storage in Database](#tv-storage-in-database)

**Solution:**
- Implement multi-device tracking (see Future Enhancement)
- Or create separate user accounts per TV

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_TV_CODE` | `5T6FEP` | Default channel list code for testing |
| `DEFAULT_SERVER_URL` | `https://tv.cadnative.com` | Server base URL |
| `PAIRING_PIN_EXPIRY_MINUTES` | `10` | Minutes until PIN expires |
| `PORT` | `8009` | Server port |
| `MONGODB_URI` | `mongodb://...` | MongoDB connection string |

### Android TV App Settings

**SharedPreferences Keys:**

| Key | Type | Description |
|-----|------|-------------|
| `server_url` | String | Server base URL (e.g., "https://tv.cadnative.com") |
| `tv_code` | String | User's channel list code (e.g., "5T6FEP") |
| `autoload_channel_id` | String | Auto-play channel ID |
| `autoload_channel_name` | String | Auto-play channel name |

### MongoDB Indexes

**Automatic Indexes:**
```javascript
// User model
channelListCode: { unique: true, index: true }
email: { unique: true, index: true }
username: { unique: true, index: true }

// PairingRequest model
pin: { unique: true, index: true }
status: { index: true }
expiresAt: { index: true, expireAfterSeconds: 3600 }  // TTL index
```

---

## Summary

### Key Takeaways

1. **Two Pairing Methods:**
   - Legacy: Manual code entry
   - Modern: PIN-based flow

2. **No Dedicated TV Records:**
   - Device info stored in `User.metadata`
   - Only last paired device is tracked
   - PairingRequests are temporary

3. **Security:**
   - Codes have 2.2B combinations
   - PINs expire in 10 minutes
   - Session-based confirmation
   - IP logging for audit

4. **Stateless TV Access:**
   - TVs use code to fetch playlists
   - No TV authentication required
   - Suitable for consumer use

5. **Database Efficiency:**
   - TTL indexes auto-clean old PINs
   - No accumulation of device records
   - Simple User model

### When to Use Each Method

| Scenario | Recommended Method | Reason |
|----------|-------------------|--------|
| New user setup | **PIN-based** | Easier, no manual code sharing |
| Multiple TVs | **Code-based** | Same code works on all devices |
| Offline setup | **Code-based** | Doesn't require internet during pairing |
| Tech-savvy users | Either | Both work equally well |
| Non-tech users | **PIN-based** | More intuitive UX |

---

## Further Reading

- [PAIRING_SYSTEM_TESTING.md](./PAIRING_SYSTEM_TESTING.md) - Complete testing guide
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Full API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Production deployment steps

---

**Document Version:** 1.0  
**Last Updated:** November 27, 2025  
**Author:** FireVision IPTV Team
