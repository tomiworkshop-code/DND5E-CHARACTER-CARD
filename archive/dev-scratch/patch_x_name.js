const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

html = html.replace(/x\.name_en/g, 'x?.name_en');
html = html.replace(/c\.name_en/g, 'c?.name_en');
html = html.replace(/c\.name_zh/g, 'c?.name_zh');

fs.writeFileSync('v2/index.html', html);
