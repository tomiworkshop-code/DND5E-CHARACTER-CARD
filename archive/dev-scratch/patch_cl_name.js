const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

html = html.replace(/cl\.name/g, 'cl?.name');

fs.writeFileSync('v2/index.html', html);
