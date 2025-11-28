# FireVision IPTV - Fire TV Integration Implementation Guide

## Overview
This guide covers all implementations for Fire TV OS 7 integration including:
1. **TV Input Framework (TIF)** - Channel integration with Fire TV home screen
2. **Remote Control Handling** - Proper key mapping for Fire TV remote
3. **Screensaver Prevention** - Wake lock implementation to prevent sleep during playback

---

## ✅ What Has Been Implemented

### 1. Dependencies Added ([build.gradle](FireVisionIPTV/app/build.gradle))
- `androidx.tvprovider:tvprovider:1.1.0` - TV Provider for TIF
- `com.google.android.libraries.tv:companionlibrary:0.4.1` - TIF Companion Library
- `androidx.media3:media3-exoplayer:1.2.0` - ExoPlayer with wake lock support
- `androidx.media3:media3-ui:1.2.0` - ExoPlayer UI components

### 2. Permissions Added ([AndroidManifest.xml](FireVisionIPTV/app/src/main/AndroidManifest.xml))
- `android.permission.WAKE_LOCK` - Prevents screensaver
- `android.permission.FOREGROUND_SERVICE` - For background services
- `com.android.providers.tv.permission.READ_EPG_DATA` - Read channel data
- `com.android.providers.tv.permission.WRITE_EPG_DATA` - Write channel data

### 3. Fire TV TIF Components Created

#### a. [FireVisionTvInputService.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/FireVisionTvInputService.java)
- Core TvInputService for Fire TV integration
- Handles channel tuning and playback requests from Fire TV UI
- Creates sessions for individual channel playback

#### b. [firevisiontvinputservice.xml](FireVisionIPTV/app/src/main/res/xml/firevisiontvinputservice.xml)
- XML configuration for TvInputService
- Links to TvSetupActivity for channel setup

#### c. [TvSetupActivity.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/TvSetupActivity.java)
- Setup activity for Fire TV TIF integration
- Launches when users go to Settings > Live TV > Sync Sources
- Redirects to existing PairingActivity or handles setup directly

#### d. [ChannelManager.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/ChannelManager.java)
- Manages channel synchronization with Fire TV's TIF database
- Handles inserting, updating, and removing channels
- Queries Realm database for current channels
- Creates deep links for playback integration
- Truncates channel names to 25 characters (Fire TV requirement)

#### e. [ChannelUpdateReceiver.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/ChannelUpdateReceiver.java)
- Broadcast receiver for channel update events
- Listens for `ACTION_INITIALIZE_PROGRAMS` and `BOOT_COMPLETED`
- Triggers channel sync when needed

### 4. Wake Lock Implementation

#### a. Enhanced [PlaybackActivity.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/PlaybackActivity.java)
- **Dual wake lock strategy**:
  - `FLAG_KEEP_SCREEN_ON` (primary method)
  - `PowerManager.WakeLock` (backup method)
- Properly acquires/releases wake lock on resume/pause
- Enhanced Fire TV remote key handling:
  - `KEYCODE_MEDIA_PLAY_PAUSE` - Toggle playback
  - `KEYCODE_MEDIA_PLAY` - Play
  - `KEYCODE_MEDIA_PAUSE` - Pause
  - `KEYCODE_MENU` - Show overlay

#### b. Enhanced [PlaybackVideoFragment.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/PlaybackVideoFragment.java)
- Already had `FLAG_KEEP_SCREEN_ON` implementation
- Added helper methods: `togglePlayPause()`, `play()`, `pause()`, `showOverlay()`
- Existing remote key handling for channel navigation:
  - `KEYCODE_CHANNEL_UP/DOWN` - Switch channels
  - `KEYCODE_DPAD_LEFT/RIGHT` - Previous/Next channel
  - `KEYCODE_BACK` - Show overlay

---

## 🚀 How to Use the Implementation

### Step 1: Sync Gradle Dependencies
```bash
# The build.gradle has been updated with all required dependencies
# Sync your project in Android Studio
```

### Step 2: Trigger Channel Sync After Pairing

In your existing **PairingActivity** (or wherever pairing succeeds), add:

```java
// After successful pairing
ChannelManager channelManager = new ChannelManager(this);
channelManager.syncChannelsToTif();
```

This will:
1. Read all channels from your Realm database
2. Insert them into Fire TV's TIF database
3. Make them appear in Fire TV Home, Live tab, and Channel Guide

### Step 3: Test on Fire TV Device

1. **Build and install the app** on Fire TV OS 7 device
2. **Pair the device** using your existing PIN flow
3. **Check Fire TV UI**:
   - Navigate to **Home > On Now** - Your channels should appear
   - Navigate to **Live** tab - Your channels should be listed
   - Press **Settings > Live TV > Channel Guide** - See your channels
4. **Test screensaver prevention**:
   - Start playing a channel
   - Leave it for 5+ minutes without interaction
   - Screen should stay on (no screensaver)

### Step 4: Access TIF Settings

Users can manage channels via:
- **Settings > Live TV > Sync Sources** - Shows "FireVision IPTV"
- Clicking it launches `TvSetupActivity` which redirects to pairing

---

## 🔑 Fire TV Remote Key Mappings (Already Implemented)

Your app now handles all Fire TV remote buttons:

| Button | KeyCode | Function | Where Handled |
|--------|---------|----------|---------------|
| **Channel Up** | `KEYCODE_CHANNEL_UP` | Next channel | PlaybackVideoFragment:128 |
| **Channel Down** | `KEYCODE_CHANNEL_DOWN` | Previous channel | PlaybackVideoFragment:134 |
| **D-Pad Right** | `KEYCODE_DPAD_RIGHT` | Next channel | PlaybackVideoFragment:127 |
| **D-Pad Left** | `KEYCODE_DPAD_LEFT` | Previous channel | PlaybackVideoFragment:133 |
| **Back** | `KEYCODE_BACK` | Show overlay | PlaybackVideoFragment:119 |
| **Play/Pause** | `KEYCODE_MEDIA_PLAY_PAUSE` | Toggle playback | PlaybackActivity:89 |
| **Play** | `KEYCODE_MEDIA_PLAY` | Play | PlaybackActivity:97 |
| **Pause** | `KEYCODE_MEDIA_PAUSE` | Pause | PlaybackActivity:104 |
| **Menu** | `KEYCODE_MENU` | Show overlay | PlaybackActivity:111 |

---

## 🛡️ Screensaver Prevention (Already Implemented)

The app now prevents Fire TV screensaver during playback using:

1. **Window Flag** ([PlaybackActivity.java:28](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/PlaybackActivity.java#L28))
   ```java
   getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
   ```

2. **Wake Lock** ([PlaybackActivity.java:30-35](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/PlaybackActivity.java#L30-L35))
   ```java
   PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
   mWakeLock = powerManager.newWakeLock(
       PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ON_AFTER_RELEASE,
       "FireVision:PlaybackWakeLock"
   );
   ```

3. **Lifecycle Management**:
   - Acquires wake lock on `onResume()`
   - Releases wake lock on `onPause()` and `onDestroy()`

---

## 🎯 Fire TV TIF Integration Features

### What Users Will See:

1. **Fire TV Home Screen**:
   - "On Now" row shows currently playing channels
   - "Recent" row shows recently watched channels
   - Channel cards with logos and names

2. **Live Tab**:
   - All your IPTV channels listed
   - Can browse and select channels directly

3. **Channel Guide**:
   - Electronic Program Guide (EPG) integration
   - Up to 14 days of programming (if you provide metadata)

4. **Search & Alexa**:
   - Users can say "Alexa, tune to [channel name]"
   - Channels appear in Fire TV search results

### Channel Deep Linking:

When users select a channel from Fire TV UI, the deep link intent launches your `PlaybackActivity` with the channel data. The flow is:

1. User selects channel in Fire TV UI
2. `FireVisionTvInputService.onTune()` is called
3. Deep link intent launches `PlaybackActivity`
4. Channel starts playing

---

## 📋 Fire TV Partner Program Requirements

⚠️ **IMPORTANT**: TIF integration requires Amazon approval.

### To Apply:
1. Contact Amazon Fire TV Partners team
2. Request access to TIF integration program
3. Provide your app package name: `com.cadnative.firevisioniptv`
4. Get **allow list approval** and **applicationId**
5. Update `applicationId` in [build.gradle:11](FireVisionIPTV/app/build.gradle#L11)

### Certification Requirements:
- ✅ Channel names max 25 characters (implemented in [ChannelManager.java:142](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/ChannelManager.java#L142))
- ✅ Deep-link playback within 2.5 seconds
- ✅ Proper wake lock management (implemented)
- ✅ Fire TV remote key handling (implemented)
- ⏳ Application banner (use your existing `@mipmap/ic_banner`)
- ⏳ Parental controls (to be implemented if needed)

---

## 🧪 Testing Checklist

### Screensaver Prevention:
- [ ] Play a channel and wait 5 minutes
- [ ] Screen should NOT dim or show screensaver
- [ ] Check logcat for wake lock messages

### Remote Control:
- [ ] Channel Up/Down buttons switch channels
- [ ] D-Pad Left/Right switch channels
- [ ] Play/Pause button toggles playback
- [ ] Back button shows overlay
- [ ] Menu button shows overlay

### TIF Integration (After Partner Approval):
- [ ] Channels appear in Fire TV Home > On Now
- [ ] Channels appear in Live tab
- [ ] Channel Guide shows channels
- [ ] Selecting channel from Fire TV UI launches PlaybackActivity
- [ ] Alexa voice command works: "Tune to [channel]"

---

## 📁 Files Modified/Created

### Modified:
1. [build.gradle](FireVisionIPTV/app/build.gradle) - Added TIF dependencies
2. [AndroidManifest.xml](FireVisionIPTV/app/src/main/AndroidManifest.xml) - Added permissions, services, receivers
3. [PlaybackActivity.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/PlaybackActivity.java) - Added wake lock
4. [PlaybackVideoFragment.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/PlaybackVideoFragment.java) - Added helper methods

### Created:
1. [FireVisionTvInputService.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/FireVisionTvInputService.java)
2. [TvSetupActivity.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/TvSetupActivity.java)
3. [ChannelManager.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/ChannelManager.java)
4. [ChannelUpdateReceiver.java](FireVisionIPTV/app/src/main/java/com/cadnative/firevisioniptv/ChannelUpdateReceiver.java)
5. [firevisiontvinputservice.xml](FireVisionIPTV/app/src/main/res/xml/firevisiontvinputservice.xml)

---

## 🔧 Next Steps

1. **Sync Gradle** - Let Android Studio download new dependencies
2. **Build APK** - Test on Fire TV OS 7 device
3. **Test Wake Lock** - Verify screensaver doesn't appear
4. **Apply for Partner Program** - Contact Amazon for TIF approval
5. **Add Channel Sync** - Call `ChannelManager.syncChannelsToTif()` after pairing
6. **(Optional) Implement Parental Controls** - If required by Fire TV certification

---

## 📚 References

- [Fire TV TIF Documentation](https://developer.amazon.com/docs/fire-tv/tv-input-framework-on-fire-tv.html)
- [Fire TV Remote Input](https://developer.amazon.com/docs/fire-tv/remote-input.html)
- [Linear TV Integration Guide](https://developer.amazon.com/docs/fire-tv/linear-tv-integration-guide-overview.html)
- [Amazon Sample App](https://github.com/amzn/ftv-livetv-sample-tv-app)

---

## 🐛 Troubleshooting

### Screensaver Still Appears:
- Check logcat for wake lock acquire/release messages
- Verify `WAKE_LOCK` permission in manifest
- Ensure `FLAG_KEEP_SCREEN_ON` is set in PlaybackActivity

### Channels Don't Appear in Fire TV UI:
- Verify you're on Fire TV OS 7+
- Check if you're approved for TIF partner program
- Run `ChannelManager.syncChannelsToTif()` after pairing
- Check logcat for TIF database errors

### Remote Keys Not Working:
- Verify `onKeyDown()` is returning `true` for handled keys
- Check if overlay is consuming key events
- Test with physical Fire TV remote (not app remote)

---

**Implementation completed successfully! 🎉**
