# Testing Category & Language Navigation

## Quick Start

### 1. Add Sample Data to Server

```bash
cd FireVisionIPTVServer
node insert-sample-data.js
```

This will add 17 test channels with various categories and languages:
- **Categories**: Sports, News, Movies, Entertainment, Music, Kids, Documentary
- **Languages**: English, Hindi, Spanish

### 2. Build and Run Android App

```bash
cd ../FireVisionIPTV
./gradlew assembleDebug
# Or build in Android Studio
```

### 3. Test the Features

#### Test Category Navigation:
1. Open the app on your Android TV
2. Navigate to **"Categories"** in the left sidebar
3. You should see category folders:
   - Sports (2 channels)
   - News (4 channels)
   - Movies (2 channels)
   - Entertainment (4 channels)
   - Music (1 channel)
   - Kids (1 channel)
   - Documentary (2 channels)
4. Click on any category (e.g., "Sports")
5. View channels within that category

#### Test Language Navigation:
1. Navigate to **"Languages"** in the left sidebar (below Categories)
2. You should see language folders:
   - **EN** English (12 channels)
   - **HI** Hindi (3 channels)
   - **ES** Spanish (2 channels)
3. Click on any language (e.g., "EN")
4. View channels in that language

### 4. Verify Features

✅ Check these work correctly:
- [ ] Category cards show proper icons (soccer ball for Sports, newspaper for News, etc.)
- [ ] Language cards show 2-letter codes (EN, HI, ES)
- [ ] Channel counts are displayed and accurate
- [ ] D-pad navigation works smoothly between cards
- [ ] Focus highlights are visible
- [ ] Clicking a category/language opens the channel list
- [ ] Back button returns to category/language list
- [ ] Sidebar remains functional in all screens

### 5. Add Your Own Channels

To add more channels with categories and languages, use the API or MongoDB:

#### Via API:
```javascript
POST /api/admin/channels
{
  "channelName": "Your Channel",
  "channelUrl": "http://...",
  "channelGroup": "Sports",  // Category
  "metadata": {
    "language": "English"     // Language
  }
}
```

#### Via MongoDB:
```javascript
db.channels.insertOne({
  channelId: "custom-001",
  channelName: "My Custom Channel",
  channelUrl: "http://...",
  channelGroup: "Sports",
  metadata: {
    language: "English",
    country: "USA"
  }
})
```

### 6. Remove Sample Data (Optional)

If you want to remove the test data:
```bash
cd FireVisionIPTVServer
node -e "require('mongoose').connect('mongodb://localhost:27017/firevision').then(() => require('./src/models/Channel').deleteMany({ channelId: /^(sport|news|movie|ent|music|kids|doc)-/ }).then(r => console.log('Deleted', r.deletedCount, 'channels')))"
```

## Troubleshooting

### No categories showing?
- Check if server is running: `npm start`
- Verify TV code is configured in app settings
- Check server URL is correct
- Verify sample data was inserted: Check MongoDB

### Language not displaying?
- Ensure channels have `metadata.language` field
- Check the server API response includes metadata
- Verify Channel.java is properly parsing metadata

### Icons not showing?
- Check drawable resources are included in build
- Verify R.drawable.ic_category_* files exist
- Clean and rebuild the project

### Categories empty after clicking?
- Check MainFragment filtering logic
- Verify channelGroup matches exactly
- Check server response data

## Need Help?

Check the full implementation guide:
```
CATEGORY_LANGUAGE_IMPLEMENTATION.md
```

Enjoy browsing channels by category and language! 🎉
