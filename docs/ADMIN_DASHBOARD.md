# Admin Dashboard - User Guide

## Access the Dashboard

**URL**: http://localhost:8009/admin (or https://tv.cadnative.com/admin for production)

**Default Credentials**:
- Username: `admin`
- Password: `admin123`

**Important**: Change these credentials in production by setting environment variables:
```env
ADMIN_USERNAME=your-username
ADMIN_PASSWORD=your-secure-password
```

## Features

### 1. 📋 Channel Management

Manage your IPTV channels with a complete CRUD interface.

#### View Channels
- **Search**: Filter channels by name or category
- **Stats**: View total channels, active channels, working status, and categories
- **Table View**: See all channel details including:
  - Logo
  - Name
  - Category/Group
  - Active status
  - Working status (after testing)
  - Stream URL
  - Action buttons

#### Add New Channel
1. Click "**+ Add Channel**" button
2. Fill in the form:
   - **Channel ID**: Unique identifier (e.g., `cnn_news`)
   - **Channel Name**: Display name (e.g., `CNN International`)
   - **Stream URL**: M3U8 or stream link
   - **Logo URL**: Channel logo image URL
   - **Category/Group**: Channel category (e.g., `News`, `Sports`)
   - **Active**: Toggle to enable/disable channel
3. Click "**Save**"

#### Edit Channel
1. Click the **✏️ Edit** button on any channel row
2. Modify the details
3. Click "**Save**"

#### Delete Channel
- **Single Delete**: Click **🗑️ Delete** button on channel row
- **Bulk Delete**:
  1. Select multiple channels using checkboxes
  2. Click "**Delete Selected**" button

#### Test Channel
- **Single Test**: Click **🔍 Test** button to check if stream is working
- **Bulk Test**: Select channels and click "**Test Selected**"

### 2. 🌐 Import from IPTV-org

Auto-fetch channels from the public IPTV-org repository.

#### Available Playlists
- **All Channels**: Complete list of all available channels
- **By Country**: Channels grouped by country
- **By Category**: Channels grouped by category (News, Sports, etc.)
- **By Language**: Channels grouped by language

#### How to Import
1. Click "**🌐 IPTV-org Fetch**" in sidebar
2. Select a playlist type (click on card)
3. Wait for channels to load (may take 10-30 seconds)
4. **Filter** channels using search box
5. **Select** channels to import:
   - Use checkboxes to select individual channels
   - Click "**Select All**" to select all visible channels
   - Click "**Deselect All**" to clear selection
6. **Optional**: Check "**Replace all existing channels**" to delete current channels
7. Click "**Import Selected**"

**Note**: IPTV-org has thousands of channels. Be selective!

### 3. ✅ Test Channels

Verify that channel streams are accessible.

#### Test Methods

**Test All Channels**
1. Click "**✅ Test Channels**" in sidebar
2. Click "**Test All Channels**"
3. Wait for testing to complete
4. View results in table

**Test Selected Channels**
1. Select specific channels using checkboxes
2. Click "**Test Selected Only**"

#### Test Results
- **Status**: ✓ Working / ✗ Not Working
- **Response Time**: Time taken to connect (in milliseconds)
- **Last Tested**: Timestamp of last test
- **Color Coding**:
  - Green badge: Stream is working
  - Red badge: Stream is not accessible

**Testing Process**:
- Makes HTTP HEAD request to stream URL
- Checks for successful response (HTTP 200-399)
- Times the response
- Updates channel metadata in database

### 4. 📊 Statistics

View comprehensive statistics about your channels.

#### Metrics
- **Total Channels**: All channels in database
- **Active Channels**: Channels marked as active
- **Inactive Channels**: Channels marked as inactive
- **App Versions**: Number of APK versions uploaded

#### Charts
- **Channels by Category**: Bar chart showing distribution of channels across categories

### 5. Bulk Operations

Perform actions on multiple channels at once.

#### Select Channels
- Check individual channel checkboxes
- Use "**Select All**" checkbox in table header
- Selection persists across operations

#### Available Bulk Actions
- **Delete Selected**: Remove multiple channels
- **Test Selected**: Test multiple channels for working status

## API Endpoints (for advanced users)

### Authentication
```bash
# Login
curl -X POST http://localhost:8009/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Returns: {"success":true,"sessionId":"...","user":{...}}

# Logout
curl -X POST http://localhost:8009/api/v1/auth/logout \
  -H "X-Session-Id: your-session-id"
```

### Channel Testing
```bash
# Test single channel
curl -X POST http://localhost:8009/api/v1/test/test-channel \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: your-session-id" \
  -d '{"channelId":"channel-id-here"}'

# Test multiple channels
curl -X POST http://localhost:8009/api/v1/test/test-batch \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: your-session-id" \
  -d '{"channelIds":["id1","id2","id3"]}'
```

### IPTV-org Integration
```bash
# List available playlists
curl http://localhost:8009/api/v1/iptv-org/playlists \
  -H "X-Session-Id: your-session-id"

# Fetch playlist
curl "http://localhost:8009/api/v1/iptv-org/fetch?url=https://iptv-org.github.io/iptv/index.m3u" \
  -H "X-Session-Id: your-session-id"

# Import channels
curl -X POST http://localhost:8009/api/v1/iptv-org/import \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: your-session-id" \
  -d '{"channels":[...],"replaceExisting":false}'
```

## Tips & Best Practices

### Channel Management
1. **Organize with Groups**: Use consistent category names (News, Sports, Entertainment)
2. **Test Regularly**: Test channels weekly to ensure they're still working
3. **Remove Dead Streams**: Delete non-working channels to keep list clean
4. **Use Clear Names**: Make channel names descriptive for users

### Importing from IPTV-org
1. **Start Small**: Don't import all channels at once
2. **Test After Import**: Run batch test on imported channels
3. **Filter by Country**: Import channels relevant to your audience
4. **Check Quality**: Not all IPTV-org channels are high quality

### Testing Channels
1. **Batch Testing**: Test 50-100 channels at a time for faster results
2. **Schedule Tests**: Test channels during off-peak hours
3. **Monitor Results**: Channels with high response times may buffer
4. **Automatic Cleanup**: Consider removing channels that fail multiple tests

### Security
1. **Change Default Password**: Always change from admin/admin123
2. **Use HTTPS**: In production, always use HTTPS
3. **Limit Access**: Only give admin access to trusted users
4. **Session Management**: Logout when done to invalidate session

## Troubleshooting

### Can't Login
- Check username and password in `.env` file
- Verify server is running: `curl http://localhost:8009/health`
- Clear browser cache and localStorage
- Check browser console for errors

### Channels Not Loading
- Check API response: `curl http://localhost:8009/api/v1/channels`
- Verify MongoDB is connected
- Check server logs: `docker-compose logs -f api`

### IPTV-org Import Fails
- Verify internet connection
- IPTV-org servers may be slow, try again
- Check server logs for specific errors
- Try a smaller playlist (by country or category)

### Testing Takes Too Long
- Test fewer channels at once
- Some streams may timeout (10 second timeout per channel)
- Use "Test Selected" instead of "Test All"

### Bulk Operations Not Working
- Ensure channels are selected (checkboxes checked)
- Check browser console for JavaScript errors
- Verify session is still valid (may need to re-login)

## Keyboard Shortcuts

- `Ctrl/Cmd + K`: Focus search box
- `Escape`: Close modal dialogs
- Click outside modal to close

## Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Note**: Some features may not work on older browsers.

## Performance

### Large Channel Lists
- Pagination: Table loads all channels (use search to filter)
- Search: Instant client-side filtering
- Testing: ~10 seconds per channel (with 10s timeout)

### Recommendations
- Keep channel list under 1000 for optimal performance
- Use categories to organize channels
- Regularly clean up non-working channels

## Updates & Maintenance

### Update Admin Dashboard
1. Pull latest code
2. Rebuild Docker containers: `docker-compose up -d --build`
3. Clear browser cache

### Backup Channels
```bash
# Export as M3U
curl http://localhost:8009/api/v1/channels/playlist.m3u > backup.m3u

# Database backup
./scripts/manage.sh backup
```

### Restore Channels
```bash
# Via API
curl -X POST http://localhost:8009/api/v1/admin/channels/import-m3u \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d "{\"m3uContent\": \"$(cat backup.m3u)\", \"clearExisting\": true}"
```

## Support

For issues or questions:
- Check server logs: `docker-compose logs -f`
- Review API documentation: [README.md](README.md)
- GitHub Issues: [your-repo/issues]

---

**Version**: 1.0.0
**Last Updated**: 2024-10-30
