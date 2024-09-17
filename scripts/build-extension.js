const fs = require('fs')
const file = './build/css/content.css'
let css = fs.readFileSync(file, 'utf-8')

css = css.split('/css/').join('chrome-extension://__MSG_@@extension_id__/css/')

fs.truncateSync(file, 0)
fs.writeFileSync(file, css)

fs.renameSync('./build/manifest.json', './build/manifest.json.bkp')
fs.copyFileSync('./src/manifest-extension.json', './build/manifest.json')

console.log('build-extension.js: Done.')