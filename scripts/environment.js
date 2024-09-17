const fs = require('fs');

const manifestPath = './src/manifest-extension.json';
const manifestData = fs.readFileSync(manifestPath, 'utf8');

const manifest = JSON.parse(manifestData);
const environment = process.argv[2];

switch (environment) {
  case 'dev':
    manifest.name = 'Insiteflow Browser Extension Dev';
    break;

  case 'qa':
    manifest.name = 'Insiteflow Browser Extension QA';
    break;

  case 'staging':
    manifest.name = 'Insiteflow Browser Extension Staging';
    break;

  case 'cert':
    manifest.name = 'Insiteflow Browser Extension Cert';
    break;

  case 'prod':
    manifest.name = 'Insiteflow Browser Extension Prod';
    break; 
     
  default:
    manifest.name = 'Insiteflow Browser Extension';
    break;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('Manifest updated successfully.');