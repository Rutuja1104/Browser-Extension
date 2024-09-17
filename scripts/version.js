const fs = require('fs');

const manifestPath = './src/manifest-extension.json';
const manifestData = fs.readFileSync(manifestPath, 'utf8');

const manifest = JSON.parse(manifestData);
const currentVersion = manifest.version;

// Increment the version number
const versionParts = currentVersion.split('.');
versionParts[versionParts.length - 1] = String(Number(versionParts[versionParts.length - 1]) + 1);
const newVersion = versionParts.join('.');

// Update the version number in the manifest
manifest.version = newVersion;

// Write the updated manifest.json back to file
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

