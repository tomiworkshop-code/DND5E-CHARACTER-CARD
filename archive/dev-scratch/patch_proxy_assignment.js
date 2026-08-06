const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Fix invalid left-hand side assignment
html = html.replace(/item\?\.equipped = !item\?\.equipped;/g, 'if (item) item.equipped = !item.equipped;');

fs.writeFileSync('v2/index.html', html);
