const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

html = html.replace(/it\.name_zh/g, 'it?.name_zh');
html = html.replace(/it\.name_en/g, 'it?.name_en');
html = html.replace(/it\.name/g, 'it?.name');
html = html.replace(/it\.id/g, 'it?.id');

fs.writeFileSync('v2/index.html', html);
