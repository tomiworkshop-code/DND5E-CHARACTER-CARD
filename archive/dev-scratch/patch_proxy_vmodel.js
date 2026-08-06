const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

html = html.replace(/v-model\.number="item\?\.qty"/g, 'v-model.number="item.qty"');

fs.writeFileSync('v2/index.html', html);
