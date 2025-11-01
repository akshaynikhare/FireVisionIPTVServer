#!/usr/bin/env node

/**
 * Helper script to add a new APK version to versions.json
 *
 * Usage:
 *   node add-version.js <apk-file-path> <version-name> <version-code> [release-notes]
 *
 * Example:
 *   node add-version.js ../FireVisionIPTV/app/build/outputs/apk/release/app-release.apk 1.1.0 2 "Bug fixes and improvements"
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Usage: node add-version.js <apk-file-path> <version-name> <version-code> [release-notes]');
  console.error('Example: node add-version.js ./my-app.apk 1.1.0 2 "Bug fixes"');
  process.exit(1);
}

const [apkFilePath, versionName, versionCodeStr, ...releaseNotesParts] = args;
const versionCode = parseInt(versionCodeStr);

if (isNaN(versionCode)) {
  console.error('Error: Version code must be a number');
  process.exit(1);
}

const releaseNotes = releaseNotesParts.join(' ') || `Release v${versionName}`;

// Paths
const VERSIONS_FILE = path.join(__dirname, 'versions.json');
const APKS_DIR = path.join(__dirname, 'apks');
const apkFileName = `firevision-iptv-${versionName}.apk`;
const apkDestPath = path.join(APKS_DIR, apkFileName);

async function main() {
  try {
    // Check if APK file exists
    if (!fs.existsSync(apkFilePath)) {
      console.error(`Error: APK file not found: ${apkFilePath}`);
      process.exit(1);
    }

    // Get file size
    const stats = fs.statSync(apkFilePath);
    const fileSize = stats.size;

    console.log(`\n📱 Adding APK version ${versionName} (code: ${versionCode})`);
    console.log(`   File: ${apkFilePath}`);
    console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Create apks directory if it doesn't exist
    if (!fs.existsSync(APKS_DIR)) {
      fs.mkdirSync(APKS_DIR, { recursive: true });
      console.log(`✅ Created apks directory`);
    }

    // Copy APK file
    console.log(`\n📦 Copying APK to ${apkDestPath}...`);
    fs.copyFileSync(apkFilePath, apkDestPath);
    console.log(`✅ APK copied successfully`);

    // Read existing versions.json
    let versionsData = { versions: [], latestVersion: null };
    if (fs.existsSync(VERSIONS_FILE)) {
      const data = fs.readFileSync(VERSIONS_FILE, 'utf8');
      versionsData = JSON.parse(data);
    }

    // Check if version code already exists
    const existingVersion = versionsData.versions.find(v => v.versionCode === versionCode);
    if (existingVersion) {
      console.error(`\n❌ Error: Version code ${versionCode} already exists`);
      console.error(`   Existing version: ${existingVersion.versionName}`);
      process.exit(1);
    }

    // Create new version entry
    const newVersion = {
      versionName,
      versionCode,
      apkFileName,
      apkFileSize: fileSize,
      releaseNotes,
      isActive: true,
      isMandatory: false,
      minCompatibleVersion: 1,
      releasedAt: new Date().toISOString()
    };

    // Add to versions array (at the beginning for newest first)
    versionsData.versions.unshift(newVersion);

    // Update latest version
    versionsData.latestVersion = {
      versionName,
      versionCode
    };

    // Write back to file
    console.log(`\n💾 Updating versions.json...`);
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versionsData, null, 2));
    console.log(`✅ versions.json updated successfully`);

    // Summary
    console.log(`\n✨ Version ${versionName} added successfully!`);
    console.log(`\nVersion Details:`);
    console.log(`   Name: ${versionName}`);
    console.log(`   Code: ${versionCode}`);
    console.log(`   File: ${apkFileName}`);
    console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Release Notes: ${releaseNotes}`);
    console.log(`\nDownload URL: /api/v1/app/apk`);
    console.log(`\nNext steps:`);
    console.log(`   1. Restart your server to load the new version`);
    console.log(`   2. Test the download endpoint`);
    console.log(`   3. Commit changes: git add versions.json apks/`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
