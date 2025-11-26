# PIN-Based Pairing System - Testing Guide

## Overview
Implemented a complete PIN-based TV pairing system that replaces manual code entry with an easy-to-use PIN flow.

## Implementation Summary

### ✅ Server-Side Components

1. **PairingRequest Model** (`src/models/PairingRequest.js`)
   - Stores pairing requests with 6-digit PINs
   - Auto-expires after configurable time (default 10 minutes)
   - TTL index for automatic cleanup

2. **Pairing API Endpoints** (`src/routes/tv.js`)
   - `POST /api/v1/tv/pairing/request` - TV generates PIN
   - `POST /api/v1/tv/pairing/confirm` - Web confirms pairing
   - `GET /api/v1/tv/pairing/status/:pin` - TV polls for completion

3. **Config API** (`src/routes/config.js`)
   - `GET /api/v1/config/defaults` - Returns default settings
   - `GET /api/v1/config/info` - Returns server information

4. **Environment Configuration** (`.env`)
   ```env
   DEFAULT_TV_CODE=5T6FEP
   DEFAULT_SERVER_URL=https://tv.cadnative.com
   PAIRING_PIN_EXPIRY_MINUTES=10
   ```

5. **Web Dashboard UI**
   - `/admin/pair-device.html` - Admin pairing interface
   - `/user/pair-device.html` - User pairing interface
   - Both added to navigation sidebars

### ✅ Android TV Components

1. **PairingActivity** (`PairingActivity.java`)
   - Generates and displays 6-digit PIN
   - Polls server every 3 seconds for confirmation
   - Shows countdown timer
   - Handles success/error/expiry states

2. **Pairing Layout** (`activity_pairing.xml`)
   - Large PIN display (120sp)
   - Status messages and countdown
   - "Pair with PIN" and "Enter Code Manually" buttons
   - Loading spinner

3. **MainActivity Integration**
   - Checks if TV code is configured on launch
   - Redirects to PairingActivity if using default code (5T6FEP)
   - Allows users with custom codes to skip pairing

4. **SettingsActivity Enhancement**
   - Added "Pair with PIN" button
   - Launches PairingActivity for re-pairing

5. **AndroidManifest**
   - Registered PairingActivity

---

## Testing Steps

### Phase 1: Server Testing

#### 1.1 Test PIN Generation
```bash
# Request a pairing PIN
curl -X POST http://localhost:8009/api/v1/tv/pairing/request \
  -H "Content-Type: application/json" \
  -d '{
    "deviceName": "Test TV",
    "deviceModel": "Samsung QN65"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "pin": "123456",
  "expiresAt": "2024-11-26T11:00:00.000Z",
  "expiryMinutes": 10,
  "message": "Enter this PIN on the web dashboard to pair your device"
}
```

#### 1.2 Test PIN Status Check
```bash
# Check status (should be pending)
curl http://localhost:8009/api/v1/tv/pairing/status/123456
```

**Expected Response:**
```json
{
  "success": true,
  "paired": false,
  "status": "pending",
  "expiresAt": "2024-11-26T11:00:00.000Z",
  "message": "Waiting for user to confirm pairing on web dashboard..."
}
```

#### 1.3 Test PIN Confirmation (Web Dashboard)
```bash
# Login first to get session ID
curl -X POST http://localhost:8009/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'

# Use sessionId from response
SESSION_ID="your-session-id-here"

# Confirm pairing
curl -X POST http://localhost:8009/api/v1/tv/pairing/confirm \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{
    "pin": "123456",
    "sessionId": "'$SESSION_ID'"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Device paired successfully",
  "device": {
    "name": "Test TV",
    "model": "Samsung QN65"
  },
  "user": {
    "username": "admin",
    "channelListCode": "5T6FEP",
    "role": "Admin"
  }
}
```

#### 1.4 Test Status After Confirmation
```bash
# Check status again (should be completed)
curl http://localhost:8009/api/v1/tv/pairing/status/123456
```

**Expected Response:**
```json
{
  "success": true,
  "paired": true,
  "status": "completed",
  "channelListCode": "5T6FEP",
  "username": "admin",
  "role": "Admin",
  "message": "Device paired successfully!"
}
```

#### 1.5 Test Config Endpoint
```bash
curl http://localhost:8009/api/v1/config/defaults
```

**Expected Response:**
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

### Phase 2: Web Dashboard Testing

#### 2.1 Test Admin Pairing UI
1. Login to admin dashboard: `http://localhost:8009/admin/index.html`
2. Navigate to "Pair TV Device" in sidebar
3. Should see:
   - Instructions on how to pair
   - PIN input field (6 digits)
   - "Pair Device" button
   - Device info section

#### 2.2 Test Pairing Flow (Admin)
1. Open PairingActivity on TV (or simulate with curl)
2. Get the 6-digit PIN
3. Enter PIN in web dashboard
4. Click "Pair Device"
5. Should see success message with:
   - Device name and model
   - Channel list code
   - Username

#### 2.3 Test User Pairing UI
1. Login as regular user: `http://localhost:8009/user/login.html`
2. Navigate to "Pair TV Device" in sidebar
3. Repeat pairing flow
4. Verify user's channel list code is assigned to TV

---

### Phase 3: Android TV App Testing

#### 3.1 Test First-Run Flow
1. Install app on Android TV
2. Launch app for first time
3. **Expected**: Automatically redirects to PairingActivity
4. Should see:
   - Large PIN display (e.g., "123456")
   - "Generating PIN..." then "Waiting for confirmation..."
   - Countdown timer showing expiry
   - Server URL at bottom
   - "Pair with PIN" and "Enter Code Manually" buttons

#### 3.2 Test Pairing Completion
1. Note the PIN displayed on TV
2. Go to web dashboard on phone/computer
3. Enter PIN and confirm
4. **Expected on TV**:
   - Status changes to "✓ Paired successfully!"
   - Toast message: "Welcome, [username]!"
   - App redirects to MainActivity after 2 seconds
   - Channels load with user's assigned list

#### 3.3 Test PIN Expiry
1. Generate new PIN on TV
2. Wait 10 minutes (or change `PAIRING_PIN_EXPIRY_MINUTES` to 1 for faster testing)
3. **Expected**:
   - Countdown reaches 0:00
   - Status changes to "PIN expired. Please generate a new one."
   - "Generate New PIN" button appears

#### 3.4 Test Skip to Manual Entry
1. On PairingActivity, press "Enter Code Manually"
2. **Expected**: Redirects to SettingsActivity
3. User can manually enter server URL and TV code

#### 3.5 Test Re-pairing from Settings
1. After successful pairing, go to Settings
2. Click "Pair with PIN" button
3. **Expected**: Launches PairingActivity
4. Follow pairing flow again

#### 3.6 Test Network Errors
1. Disconnect TV from internet
2. Try to generate PIN
3. **Expected**: "Connection error" message
4. "Generate New PIN" button to retry

---

### Phase 4: Edge Cases & Error Handling

#### 4.1 Invalid PIN Format
```bash
curl -X POST http://localhost:8009/api/v1/tv/pairing/confirm \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d '{"pin": "12345", "sessionId": "'$SESSION_ID'"}'
```
**Expected**: 400 error, "Invalid PIN format. PIN must be 6 digits."

#### 4.2 Non-existent PIN
```bash
curl http://localhost:8009/api/v1/tv/pairing/status/999999
```
**Expected**:
```json
{
  "success": false,
  "paired": false,
  "status": "invalid",
  "message": "PIN not found"
}
```

#### 4.3 Expired PIN Confirmation
1. Generate PIN
2. Wait for expiry
3. Try to confirm expired PIN on web
**Expected**: 400 error, "PIN has expired. Please generate a new one on your TV."

#### 4.4 Unauthenticated Confirmation
```bash
curl -X POST http://localhost:8009/api/v1/tv/pairing/confirm \
  -H "Content-Type: application/json" \
  -d '{"pin": "123456"}'
```
**Expected**: 401 error, "Session ID required for authentication"

#### 4.5 Multiple Concurrent Pairings
1. Generate PIN on TV #1
2. Generate PIN on TV #2
3. Both PINs should be unique
4. Confirm TV #1 PIN → only TV #1 gets paired
5. Confirm TV #2 PIN → only TV #2 gets paired

---

### Phase 5: Database Verification

#### 5.1 Check PairingRequest Collection
```javascript
// MongoDB shell
use firevision-iptv

// Find all pairing requests
db.pairingrequests.find().pretty()

// Find pending requests
db.pairingrequests.find({ status: 'pending' }).pretty()

// Find completed requests
db.pairingrequests.find({ status: 'completed' }).pretty()

// Verify TTL index
db.pairingrequests.getIndexes()
```

#### 5.2 Check User Metadata
```javascript
// Find user by channel list code
db.users.findOne({ channelListCode: '5T6FEP' })

// Verify device metadata was updated
db.users.find({ 
  'metadata.lastPairedDevice': { $exists: true } 
}).pretty()
```

---

## Known Issues & Limitations

### Current Implementation

1. **Default Code Detection**: MainActivity checks if code is "5T6FEP" to trigger pairing
   - **Impact**: Users with demo code "5T6FEP" must pair
   - **Workaround**: Change default code in `.env` if needed

2. **PIN Collision**: Extremely rare (1 in 1,000,000) but possible
   - **Mitigation**: `generatePin()` checks for existing active PINs
   - **Impact**: Negligible in normal usage

3. **Polling Frequency**: TV polls every 3 seconds
   - **Impact**: Slight delay (max 3s) between confirmation and TV response
   - **Consideration**: Could be reduced to 1-2s if server load is low

4. **No Multi-Device Management**: User metadata stores only last paired device
   - **Impact**: Can't see list of all paired devices
   - **Future**: Extend to `devices: []` array in User model

5. **No PIN Rate Limiting**: Can generate unlimited PINs
   - **Impact**: Potential DoS if abused
   - **Future**: Add rate limit (e.g., 10 PINs per device per hour)

### Browser Compatibility

- Works in all modern browsers (Chrome, Firefox, Edge, Safari)
- Requires JavaScript enabled
- Mobile-responsive design

---

## Performance Metrics

### Expected Response Times
- PIN generation: < 100ms
- PIN confirmation: < 200ms
- Status check: < 50ms
- Total pairing flow: 3-30 seconds (user-dependent)

### Database Operations
- PairingRequest creation: 1 write
- Status polling: 1 read per 3 seconds
- Confirmation: 1 read + 2 writes (PairingRequest + User)
- TTL cleanup: Automatic after 1 hour

---

## Security Considerations

### Current Security Measures

1. **PIN Expiry**: 10-minute timeout prevents stale PINs
2. **Unique PINs**: Collision detection ensures no duplicates
3. **Session Validation**: Confirmation requires valid session ID
4. **HTTPS**: Use HTTPS in production to encrypt PIN transmission
5. **User Association**: PIN directly links to authenticated user

### Recommendations for Production

1. **Rate Limiting**: 
   ```javascript
   // Add to server.js
   const pinRateLimiter = rateLimit({
     windowMs: 60 * 60 * 1000, // 1 hour
     max: 10, // 10 PINs per hour per IP
     message: 'Too many pairing attempts'
   });
   app.use('/api/v1/tv/pairing/request', pinRateLimiter);
   ```

2. **PIN Hashing**: Store hashed PINs in database
   ```javascript
   const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
   ```

3. **IP Whitelisting**: Optionally restrict pairing to local network

4. **Audit Logging**: Log all pairing attempts for security monitoring

---

## Troubleshooting

### TV Can't Generate PIN

**Symptoms**: "Connection error" on TV

**Causes**:
1. Server not running
2. Wrong server URL in settings
3. Network connectivity issue
4. Firewall blocking port 8009

**Solutions**:
- Check server status: `docker-compose ps`
- Verify server URL in SettingsActivity
- Test with curl from same network
- Check Docker logs: `docker-compose logs api`

### PIN Expired Before Confirmation

**Symptoms**: "PIN has expired" error on web

**Causes**:
1. User took > 10 minutes
2. Clock skew between server and TV

**Solutions**:
- Increase `PAIRING_PIN_EXPIRY_MINUTES` in `.env`
- Generate new PIN on TV
- Sync system clocks (NTP)

### Pairing Confirmed But TV Not Updating

**Symptoms**: TV still showing "Waiting for confirmation..."

**Causes**:
1. Polling stopped (app backgrounded)
2. Network dropped
3. Server didn't save confirmation

**Solutions**:
- Keep TV app in foreground
- Check network connectivity
- Verify in MongoDB that status is 'completed'
- Press "Generate New PIN" to retry

### Multiple Devices Paired to Same Code

**Symptoms**: Wrong channels showing on TV

**Causes**:
- Two TVs paired with same user account
- Last pairing overwrites previous

**Solutions**:
- This is expected behavior (one code = one user)
- Create separate user accounts for multiple TVs
- Future: Implement multi-device support

---

## Next Steps & Future Enhancements

### Recommended Additions

1. **QR Code Pairing**: 
   - Generate QR code with embedded PIN
   - TV scans QR instead of manual entry
   - Requires camera permission on TV

2. **Email/SMS Code Delivery**:
   - User enters email on TV
   - Server sends email with pairing link
   - Click link on phone to confirm

3. **Device Management Dashboard**:
   - Admin page showing all paired devices
   - Ability to unpair/revoke devices
   - Last active timestamp per device

4. **Auto-Discovery**:
   - TV broadcasts on local network
   - Web dashboard auto-detects TV IP
   - One-click pairing without PIN

5. **Biometric Confirmation**:
   - User confirms pairing with fingerprint/face on mobile
   - Higher security for sensitive content

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_TV_CODE` | `5T6FEP` | Default channel list code |
| `DEFAULT_SERVER_URL` | `https://tv.cadnative.com` | Default server URL |
| `PAIRING_PIN_EXPIRY_MINUTES` | `10` | Minutes until PIN expires |
| `SUPER_ADMIN_CHANNEL_LIST_CODE` | `5T6FEP` | Super admin's code |

### SharedPreferences Keys (Android)

| Key | Type | Description |
|-----|------|-------------|
| `server_url` | String | Server base URL |
| `tv_code` | String | User's channel list code |
| `autoload_channel_id` | String | Auto-load channel ID |
| `autoload_channel_name` | String | Auto-load channel name |

---

## Success Criteria

### Definition of Done

✅ All tasks completed:
1. ✅ PairingRequest model created
2. ✅ Pairing API endpoints implemented
3. ✅ Config API endpoint created
4. ✅ Environment variables configured
5. ✅ Android PairingActivity built
6. ✅ Pairing layout designed
7. ✅ MainActivity first-run check added
8. ✅ Settings re-pair button added
9. ✅ Admin pairing UI created
10. ✅ User pairing UI created
11. ✅ Navigation menus updated
12. ✅ Routes registered in server.js

### Testing Checklist

Before production deployment:

- [ ] Server can generate unique PINs
- [ ] Web dashboard can confirm pairings
- [ ] TV receives confirmation within 5 seconds
- [ ] Expired PINs are rejected
- [ ] Invalid PINs show error messages
- [ ] TV code is saved to SharedPreferences
- [ ] MainActivity redirects properly
- [ ] Settings button launches pairing
- [ ] Navigation links work
- [ ] Mobile responsive on web UI
- [ ] Works on 1080p and 4K TVs
- [ ] Handles network interruptions gracefully

---

## Support & Documentation

### API Documentation
See `API_DOCUMENTATION.md` for complete API reference.

### User Guide
Create user-facing guide:
1. Install FireVision IPTV app
2. App shows 6-digit PIN on first launch
3. Visit dashboard on phone/computer
4. Enter PIN to link TV to your account
5. Start watching!

### Admin Guide
Administrator steps:
1. User registers on web dashboard
2. Admin assigns channels to user
3. User pairs TV using PIN
4. User watches assigned channels
5. Admin can view paired devices in future update

---

## Conclusion

The PIN-based pairing system is **fully implemented** and **ready for testing**. The system provides:

✅ **Easy Pairing**: 6-digit PIN flow is simpler than manual code entry  
✅ **Secure**: Session-based authentication with expiry  
✅ **User-Friendly**: Clear instructions and error messages  
✅ **Configurable**: Environment variables for customization  
✅ **Scalable**: Database-backed with auto-cleanup  

Follow the testing steps above to validate all functionality before deploying to production.
